import {
  Comment,
  CommentsApi,
  CommentsResponse,
  DeleteCommentResponse,
} from "@cosmic-dolphin/api-client";
import { getConfiguration } from "@/lib/api/bookmarks-client";

/**
 * Comments and reports, for the thread D12 builds.
 *
 * Nothing is swallowed here. A comment is something a person deliberately
 * wrote; a failure to post it has to reach them, unlike a dropped reading
 * progress write which is bookkeeping they never asked for. Every method throws
 * a `CommentRequestError` carrying the server's own message, because the server
 * is the only party that knows *why* — the edit window closed, the limit was
 * hit, the bookmark stopped being public.
 */

/** A refusal the UI has to explain, with the server's wording intact. */
export class CommentRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    /** Seconds, from `Retry-After`, when the refusal was a rate limit. */
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "CommentRequestError";
  }
}

/**
 * The generated runtime throws `ResponseError` with the raw `Response`
 * attached. Pull the API's `{ error }` body out of it so the UI shows the
 * server's sentence rather than "Request failed with status 403".
 */
async function toCommentError(error: unknown): Promise<CommentRequestError> {
  const response: Response | undefined = (error as { response?: Response })
    ?.response;

  if (!response) {
    return new CommentRequestError(
      error instanceof Error ? error.message : "Something went wrong.",
      null,
    );
  }

  let message: string | null = null;
  try {
    const body = await response.clone().json();
    if (body?.error) message = String(body.error);
  } catch {
    // Not JSON. The status alone will have to do.
  }

  const retryAfter = response.headers?.get?.("Retry-After");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;

  return new CommentRequestError(
    message ?? "Something went wrong.",
    response.status,
    Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  );
}

export namespace CommentsClientAPI {
  async function api(): Promise<CommentsApi> {
    return new CommentsApi(await getConfiguration());
  }

  /** The thread, chronological. Throws 404 when the bookmark is not visible. */
  export async function list(bookmarkId: string): Promise<CommentsResponse> {
    try {
      return await (await api()).bookmarkCommentsList({ id: bookmarkId });
    } catch (error) {
      throw await toCommentError(error);
    }
  }

  /**
   * Post a comment or a reply.
   *
   * `parentId` may point at a reply; the server re-points it at that reply's
   * parent and the returned `Comment` says where it actually landed. The
   * caller must trust the response over what it asked for — that is the whole
   * mechanism by which a reply to a reply lands on the parent.
   */
  export async function create(
    bookmarkId: string,
    body: string,
    parentId?: string,
  ): Promise<Comment> {
    try {
      return await (
        await api()
      ).bookmarkCommentsCreate({
        id: bookmarkId,
        createCommentRequest: { body, ...(parentId ? { parentId } : {}) },
      });
    } catch (error) {
      throw await toCommentError(error);
    }
  }

  /** Refused with 403 once the 15-minute window has closed. */
  export async function update(id: string, body: string): Promise<Comment> {
    try {
      return await (
        await api()
      ).commentsUpdate({ id, updateCommentRequest: { body } });
    } catch (error) {
      throw await toCommentError(error);
    }
  }

  /**
   * Soft or hard, decided server-side. `deleted: false` means a tombstone came
   * back in `comment` and the caller must swap it in rather than removing the
   * row — its replies are still hanging off it.
   */
  export async function remove(id: string): Promise<DeleteCommentResponse> {
    try {
      return await (await api()).commentsRemove({ id });
    } catch (error) {
      throw await toCommentError(error);
    }
  }

  /**
   * Report a bookmark or a comment. Exactly one.
   *
   * Nothing about the reported content changes as a result — it stays visible
   * pending review — so there is no local state for the caller to update.
   */
  export async function report(
    target: { bookmarkId: string } | { commentId: string },
    reason: string,
  ): Promise<void> {
    try {
      await (await api()).reportsCreate({
        createReportRequest: { ...target, reason },
      });
    } catch (error) {
      throw await toCommentError(error);
    }
  }
}
