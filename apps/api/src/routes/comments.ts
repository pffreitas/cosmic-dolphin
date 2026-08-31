import { FastifyInstance, FastifyReply } from "fastify";
import {
  Comment,
  CommentForbiddenError,
  CommentValidationError,
  CommentsResponse,
  CreateReportResult,
  DeleteCommentResult,
  MAX_COMMENT_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  ServiceContainer,
  createDatabase,
  createServiceContainer,
} from "@cosmic-dolphin/shared";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../config/environment";
import { authMiddleware } from "../middleware/auth";
import { RATE_LIMITS, rateLimited } from "../plugins/rate-limit";
import { firstZodMessage } from "./collections";

/**
 * Comments and reports.
 *
 * Almost nothing this deliverable promises is implemented in this file, and
 * that is deliberate — each rule sits at the layer that cannot forget it:
 *
 *  - **A reply to a reply lands on the parent** — `CommentService.resolveParent`.
 *    A route that did this would have to do it again on the next route that
 *    creates a comment.
 *  - **An edit at 16 minutes is refused** — a predicate on the UPDATE in
 *    `CommentRepository.updateOwn`, against the database's clock. Comparing
 *    timestamps here would compare against this container's clock and would
 *    race with the write besides.
 *  - **Un-sharing hides the thread** — `CommentService` asks the parent
 *    bookmark whether it is public before it reads a single comment, so the
 *    thread stops being reachable the moment the flag flips and no comment is
 *    touched.
 *  - **Reported content stays visible** — there is no code anywhere that hides
 *    it, here least of all.
 *
 * What this file owns is the wire: parse, choose a status code, answer.
 *
 * One status choice is worth stating, because it goes against the grain of the
 * social routes next door. `PATCH /comments/{id}` answers **403** on a frozen
 * comment, where `users.ts` answers 404 for everything. The reason the social
 * routes hide behind 404 is that a 403 there would confirm an account exists;
 * here the caller is the *author* of the thing they are asking about, so there
 * is nothing to withhold — and "you cannot edit this any more" is a far better
 * answer than pretending their own comment is gone.
 */

const uuidSchema = z.string().uuid("Invalid id");

/**
 * Trimmed before it is measured, so a body of spaces fails as empty and a
 * 2,000-character comment with a trailing newline is not one over the limit.
 * The service normalises identically — this is the fast refusal, not the rule.
 */
const bodySchema = z
  .string({ error: "A comment cannot be empty." })
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "A comment cannot be empty.")
  .refine(
    (value) => value.length <= MAX_COMMENT_LENGTH,
    `A comment must be at most ${MAX_COMMENT_LENGTH} characters.`
  );

export const createCommentSchema = z.object({
  body: bodySchema,
  // Not validated against the thread here on purpose: whether this id is a
  // top-level comment or a reply changes where the comment lands, and that is
  // the service's decision to make.
  parentId: uuidSchema.nullish(),
});

export const updateCommentSchema = z.object({
  body: bodySchema,
});

/**
 * Exactly one target, checked in the schema so the 400 names the problem.
 * The service checks it again — it is also a CHECK constraint — because this
 * schema is not the only way into `report()`.
 */
export const createReportSchema = z
  .object({
    bookmarkId: uuidSchema.nullish(),
    commentId: uuidSchema.nullish(),
    reason: z
      .string({ error: "A reason is required." })
      .transform((value) => value.trim())
      .refine((value) => value.length > 0, "A reason is required.")
      .refine(
        (value) => value.length <= MAX_REPORT_REASON_LENGTH,
        `A reason must be at most ${MAX_REPORT_REASON_LENGTH} characters.`
      ),
  })
  .refine(
    (value) => Boolean(value.bookmarkId) !== Boolean(value.commentId),
    "Report exactly one of bookmarkId or commentId."
  );

/**
 * A rule the caller broke is a 400; a comment that is frozen or deleted is a
 * 403. Everything else falls through to the handler's 500.
 */
export function replyForCommentError(
  reply: FastifyReply,
  error: unknown
): FastifyReply | null {
  if (error instanceof CommentValidationError) {
    return reply.status(400).send({ error: error.message });
  }
  if (error instanceof CommentForbiddenError) {
    return reply.status(403).send({ error: error.message });
  }
  return null;
}

export default async function commentRoutes(fastify: FastifyInstance) {
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  const db = createDatabase(config.DATABASE_URL);
  const services: ServiceContainer = createServiceContainer(supabase, db);

  const notFound = (reply: FastifyReply) =>
    reply.status(404).send({ error: "Comment not found" });

  fastify.get<{
    Params: { id: string };
    Reply: CommentsResponse | { error: string };
  }>(
    "/bookmarks/:id/comments",
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const parsedId = uuidSchema.safeParse(request.params.id);
        if (!parsedId.success) {
          return reply.status(400).send({ error: "Invalid id" });
        }

        const thread = await services.comment.list(
          parsedId.data,
          request.userId!
        );

        // The same 404 for "no such bookmark" and "not public and not yours".
        // Un-sharing therefore looks, from outside, exactly like the bookmark
        // never existing — which is what un-sharing is for.
        if (!thread) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        return reply.send(thread);
      } catch (error) {
        const handled = replyForCommentError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "List comments error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: unknown;
    Reply: Comment | { error: string };
  }>(
    "/bookmarks/:id/comments",
    {
      preHandler: authMiddleware,
      // 10/min, from the one place limits are declared.
      config: rateLimited(RATE_LIMITS.comments),
    },
    async (request, reply) => {
      try {
        const parsedId = uuidSchema.safeParse(request.params.id);
        if (!parsedId.success) {
          return reply.status(400).send({ error: "Invalid id" });
        }

        const parsed = createCommentSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: firstZodMessage(parsed.error) });
        }

        const comment = await services.comment.create(
          parsedId.data,
          request.userId!,
          { body: parsed.data.body, parentId: parsed.data.parentId }
        );

        if (!comment) {
          return reply.status(404).send({ error: "Bookmark not found" });
        }

        return reply.status(201).send(comment);
      } catch (error) {
        const handled = replyForCommentError(reply, error);
        if (handled) return handled;
        fastify.log.error({ error }, "Create comment error");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: unknown;
    Reply: Comment | { error: string };
  }>("/comments/:id", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsedId = uuidSchema.safeParse(request.params.id);
      if (!parsedId.success) {
        return reply.status(400).send({ error: "Invalid id" });
      }

      const parsed = updateCommentSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const comment = await services.comment.update(
        parsedId.data,
        request.userId!,
        parsed.data.body
      );

      // Not the caller's, or gone. A 403 here would tell one user that another
      // user's comment id is real.
      if (!comment) return notFound(reply);

      return reply.send(comment);
    } catch (error) {
      // The frozen case arrives as CommentForbiddenError → 403.
      const handled = replyForCommentError(reply, error);
      if (handled) return handled;
      fastify.log.error({ error }, "Update comment error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.delete<{
    Params: { id: string };
    Reply: DeleteCommentResult | { error: string };
  }>("/comments/:id", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsedId = uuidSchema.safeParse(request.params.id);
      if (!parsedId.success) {
        return reply.status(400).send({ error: "Invalid id" });
      }

      // Deliberately not rate limited, and deliberately never expiring.
      // Withdrawing what you said is not an action to put a limiter in front
      // of, and the 15-minute freeze applies to editing only: a comment you
      // regret at midnight is still yours to remove.
      const result = await services.comment.remove(
        parsedId.data,
        request.userId!
      );

      if (!result) return notFound(reply);

      return reply.send(result);
    } catch (error) {
      const handled = replyForCommentError(reply, error);
      if (handled) return handled;
      fastify.log.error({ error }, "Delete comment error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  fastify.post<{
    Body: unknown;
    Reply: CreateReportResult | { error: string };
  }>("/reports", { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const parsed = createReportSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: firstZodMessage(parsed.error) });
      }

      const result = await services.comment.report(request.userId!, {
        bookmarkId: parsed.data.bookmarkId,
        commentId: parsed.data.commentId,
        reason: parsed.data.reason,
      });

      if (!result) {
        return reply.status(404).send({ error: "Content not found" });
      }

      // 200, and nothing about the reported content has changed. It stays
      // visible pending review — see the file header.
      return reply.send(result);
    } catch (error) {
      const handled = replyForCommentError(reply, error);
      if (handled) return handled;
      fastify.log.error({ error }, "Create report error");
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
