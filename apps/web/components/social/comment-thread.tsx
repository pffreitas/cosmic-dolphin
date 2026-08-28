"use client";

import * as React from "react";
import Link from "next/link";
import { Flag, MessageCircle, Pencil, Trash2 } from "lucide-react";
import type { Comment } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { focusRing } from "@/components/ui/focus-ring";
import { useOptionalToast } from "@/components/ui/toast";
import { formatSavedAt } from "@/components/bookmark/library/row-data";
import {
  CommentRequestError,
  CommentsClientAPI,
} from "@/lib/api/comments-client";

import { ReportDialog } from "./report-dialog";

/**
 * A comment thread — pages.md § Bookmark detail, step 5: a `divide-y` thread
 * with 36px avatars, then the current user's input.
 *
 * The thread is flat in the DOM and one level deep in meaning. The server
 * returns it already ordered — each top-level comment followed by its replies —
 * so this component never sorts and never nests: it reads `parentId` only to
 * decide an indent. That is not laziness, it is the one-level rule made
 * structural. There is no recursion here to accidentally grow a third level in.
 *
 * Three behaviours are worth knowing before changing anything:
 *
 *  - **The server decides where a reply lands.** Replying to a reply sends that
 *    reply's id as `parentId`, and the response comes back attached to its
 *    *parent*. The list is rebuilt from the response, never from the request,
 *    so the re-point is visible immediately and correctly.
 *
 *  - **Edit is offered only while `canEdit`.** The server computes it from the
 *    comment's own age and re-checks on `PATCH`, so a stale flag is refused
 *    rather than honoured. This component does not run a timer to take the
 *    control away mid-session; a refusal after the window closes is explained
 *    by the server's own sentence.
 *
 *  - **Nothing is optimistic.** A like can be guessed at and reconciled; a
 *    comment cannot — it can be refused for the rate limit, for length, or
 *    because the bookmark stopped being public between load and submit, and
 *    text appearing and then vanishing is worse than a moment's wait.
 */

export interface CommentThreadProps {
  bookmarkId: string;
  /**
   * Rendered above the thread. The detail page passes a count so the heading
   * can say "4 comments" before the fetch lands.
   */
  initialCount?: number;
  /** Bubbles the server's count up so an action row can stay in step. */
  onCountChange?: (count: number) => void;
  /** Suppresses the network entirely — the state gallery and tests. */
  offline?: boolean;
  className?: string;
  /** Drops the heading; the drawer draws its own. */
  hideHeading?: boolean;
  /** Where the sign-in prompt on `/s/{slug}` points. */
  signInHref?: string;
}

export function CommentThread({
  bookmarkId,
  initialCount = 0,
  onCountChange,
  offline = false,
  className,
  hideHeading = false,
  signInHref = "/sign-in",
}: CommentThreadProps) {
  const toast = useOptionalToast();

  const [comments, setComments] = React.useState<Comment[]>([]);
  const [count, setCount] = React.useState(initialCount);
  const [loading, setLoading] = React.useState(!offline);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // `/s/{slug}` renders for strangers. A 401 there is not a failure, it is the
  // product working — so it gets a sign-in prompt (pages.md § Shared bookmark)
  // rather than "Couldn't load the conversation", which would read as a bug.
  const [needsSignIn, setNeedsSignIn] = React.useState(false);

  const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [reportingId, setReportingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const publishCount = React.useCallback(
    (next: number) => {
      setCount(next);
      onCountChange?.(next);
    },
    [onCountChange],
  );

  const load = React.useCallback(async () => {
    if (offline) return;
    setLoading(true);
    setLoadError(null);
    setNeedsSignIn(false);
    try {
      const thread = await CommentsClientAPI.list(bookmarkId);
      setComments(thread.comments);
      publishCount(thread.commentCount);
    } catch (error) {
      if (error instanceof CommentRequestError && error.status === 401) {
        setNeedsSignIn(true);
      } else {
        setLoadError(
          error instanceof CommentRequestError
            ? error.message
            : "Couldn't load the conversation.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [bookmarkId, offline, publishCount]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const submit = async (body: string, parentId?: string) => {
    if (offline) return;
    // Reload rather than splice. The server may have attached this comment to
    // a different parent than the one asked for — that is the one-level rule
    // doing its job — and re-reading the thread is the only way to render the
    // result of a decision the client did not make.
    await CommentsClientAPI.create(bookmarkId, body, parentId);
    setReplyingTo(null);
    await load();
  };

  const saveEdit = async (id: string, body: string) => {
    if (offline) return;
    const updated = await CommentsClientAPI.update(id, body);
    setComments((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setEditingId(null);
  };

  const remove = async (id: string) => {
    if (offline) return;
    setBusyId(id);
    try {
      const result = await CommentsClientAPI.remove(id);
      publishCount(result.commentCount);

      if (result.deleted) {
        // Gone entirely. Any reply of its own went with it — the server only
        // hard-deletes a childless comment.
        setComments((current) => current.filter((item) => item.id !== id));
      } else if (result.comment) {
        // A tombstone. It stays in place because its replies hang off it.
        const tombstone = result.comment;
        setComments((current) =>
          current.map((item) => (item.id === id ? tombstone : item)),
        );
      }
    } catch (error) {
      toast?.toast({
        title: "Couldn't delete the comment",
        description:
          error instanceof CommentRequestError ? error.message : undefined,
        variant: "danger",
      });
    } finally {
      setBusyId(null);
    }
  };

  const heading =
    count === 0 ? "Comments" : `${count} ${count === 1 ? "comment" : "comments"}`;

  return (
    <section className={cn("flex flex-col gap-4", className)} aria-label="Comments">
      {hideHeading ? null : (
        <h2 className="font-serif text-[17px] font-semibold leading-[1.35] text-fg">
          {heading}
        </h2>
      )}

      {loading ? (
        <p className="font-sans text-[13.5px] leading-[1.55] text-fg-tertiary">
          Loading the conversation…
        </p>
      ) : needsSignIn ? (
        <p className="font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
          <Link
            href={signInHref}
            className={cn("text-accent underline-offset-4 hover:underline", focusRing)}
          >
            Sign in
          </Link>{" "}
          to read the conversation and join it.
        </p>
      ) : loadError ? (
        <p className="font-sans text-[13.5px] leading-[1.55] text-[color:var(--cd-danger)]">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="font-sans text-[13.5px] leading-[1.55] text-fg-tertiary">
          No comments yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn("py-3.5", comment.parentId && "pl-11")}
              data-comment-id={comment.id}
              data-reply={comment.parentId ? "true" : undefined}
            >
              <CommentRow
                comment={comment}
                busy={busyId === comment.id}
                editing={editingId === comment.id}
                replying={replyingTo === comment.id}
                onStartEdit={() => setEditingId(comment.id)}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={(body) => saveEdit(comment.id, body)}
                onStartReply={() =>
                  setReplyingTo((current) =>
                    current === comment.id ? null : comment.id,
                  )
                }
                onCancelReply={() => setReplyingTo(null)}
                // The id sent is the one the user pressed Reply on, even when
                // that is itself a reply. Flattening is the server's call.
                onSubmitReply={(body) => submit(body, comment.id)}
                onDelete={() => remove(comment.id)}
                onReport={() => setReportingId(comment.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* No composer for a stranger — an input that can only fail is worse
          than no input. The sign-in link above is the affordance. */}
      {needsSignIn ? null : (
        <CommentComposer
          placeholder="Add a comment"
          submitLabel="Comment"
          disabled={offline}
          onSubmit={(body) => submit(body)}
        />
      )}

      <ReportDialog
        open={reportingId !== null}
        onOpenChange={(open) => {
          if (!open) setReportingId(null);
        }}
        target={reportingId ? { commentId: reportingId } : null}
        subject="comment"
      />
    </section>
  );
}

interface CommentRowProps {
  comment: Comment;
  busy: boolean;
  editing: boolean;
  replying: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (body: string) => Promise<void>;
  onStartReply: () => void;
  onCancelReply: () => void;
  onSubmitReply: (body: string) => Promise<void>;
  onDelete: () => void;
  onReport: () => void;
}

function CommentRow({
  comment,
  busy,
  editing,
  replying,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onDelete,
  onReport,
}: CommentRowProps) {
  // A tombstone. It has no body and no author by the time it reaches here —
  // the server emptied both — so there is nothing to render but the fact that
  // something was said and withdrawn, and nothing to act on.
  if (comment.isDeleted) {
    return (
      <p className="font-sans text-[13.5px] italic leading-[1.55] text-fg-tertiary">
        Comment deleted
      </p>
    );
  }

  const name = comment.author?.name || comment.author?.handle || "Someone";

  return (
    <article className="flex gap-3">
      <Avatar size="lg">
        {comment.author?.pictureUrl ? (
          <AvatarImage src={comment.author.pictureUrl} alt="" />
        ) : null}
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-sans text-[13px] font-medium leading-[1.4] text-fg">
            {name}
          </span>
          <span className="font-sans text-[12px] leading-[1.4] text-fg-tertiary">
            {formatSavedAt(comment.createdAt)}
          </span>
          {comment.isEdited ? (
            <span className="font-sans text-[12px] leading-[1.4] text-fg-tertiary">
              edited
            </span>
          ) : null}
        </div>

        {editing ? (
          <CommentComposer
            initialValue={comment.body ?? ""}
            submitLabel="Save"
            autoFocus
            onCancel={onCancelEdit}
            onSubmit={onSaveEdit}
          />
        ) : (
          // `whitespace-pre-wrap` and nothing else. The body is plain text plus
          // links, and rendering it as anything richer would be inventing a
          // capability the API deliberately does not offer.
          <p className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-[1.55] text-fg-secondary">
            {comment.body}
          </p>
        )}

        {editing ? null : (
          <div className="-ml-2 flex flex-wrap items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 font-medium [&_svg]:size-[15px]"
              icon={<MessageCircle aria-hidden="true" />}
              onClick={onStartReply}
              aria-expanded={replying}
            >
              Reply
            </Button>

            {comment.isOwn && comment.canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2 font-medium [&_svg]:size-[15px]"
                icon={<Pencil aria-hidden="true" />}
                onClick={onStartEdit}
              >
                Edit
              </Button>
            ) : null}

            {comment.isOwn ? (
              // Never expires. The 15-minute freeze is on editing only: a
              // person can always withdraw what they said.
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2 font-medium [&_svg]:size-[15px]"
                icon={<Trash2 aria-hidden="true" />}
                disabled={busy}
                onClick={onDelete}
              >
                Delete
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 px-2 font-medium [&_svg]:size-[15px]"
                icon={<Flag aria-hidden="true" />}
                onClick={onReport}
              >
                Report
              </Button>
            )}
          </div>
        )}

        {replying ? (
          <CommentComposer
            placeholder={`Reply to ${name}`}
            submitLabel="Reply"
            autoFocus
            onCancel={onCancelReply}
            onSubmit={onSubmitReply}
          />
        ) : null}
      </div>
    </article>
  );
}

/** 2,000 characters, matching the column's CHECK and the API's schema. */
export const MAX_COMMENT_LENGTH = 2000;

interface CommentComposerProps {
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  onSubmit: (body: string) => Promise<void>;
}

/**
 * The one place a comment is written, so the length rule, the disabled state
 * and the error surface exist once.
 *
 * The refusal is rendered inline rather than toasted: the text the user wrote
 * is still in the field, and the explanation belongs next to it, not in a
 * corner of the screen that disappears on a timer.
 */
function CommentComposer({
  initialValue = "",
  placeholder,
  submitLabel,
  autoFocus = false,
  disabled = false,
  onCancel,
  onSubmit,
}: CommentComposerProps) {
  const [value, setValue] = React.useState(initialValue);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_COMMENT_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting && !disabled;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setValue("");
    } catch (caught) {
      setError(
        caught instanceof CommentRequestError
          ? caught.message
          : "Couldn't post that. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <Textarea
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={disabled || submitting}
        aria-label={placeholder ?? submitLabel}
        aria-invalid={tooLong || undefined}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-[72px]"
      />

      {error ? (
        <p className="font-sans text-[12.5px] leading-[1.4] text-[color:var(--cd-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
          {submitting ? "Posting…" : submitLabel}
        </Button>

        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}

        {/* Only once it matters. A character counter on an empty field is
            noise; one at 1,900 characters is information. */}
        {trimmed.length > MAX_COMMENT_LENGTH - 200 ? (
          <span
            className={cn(
              "ml-auto font-sans text-[12px] leading-[1.4]",
              tooLong
                ? "text-[color:var(--cd-danger)]"
                : "text-fg-tertiary",
            )}
          >
            {trimmed.length} / {MAX_COMMENT_LENGTH}
          </span>
        ) : null}
      </div>
    </form>
  );
}
