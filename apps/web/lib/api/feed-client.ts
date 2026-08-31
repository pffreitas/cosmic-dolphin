import {
  BookmarksApi,
  FeedApi,
  FeedFeedbackKind,
  FeedFeedbackResponse,
  FeedResponse,
  FeedScope,
} from "@cosmic-dolphin/api-client";

import { getConfiguration } from "@/lib/api/bookmarks-client";

/**
 * Feed feedback, from an item's overflow menu —
 * docs/functional-spec/05-feed.md § Feedback.
 *
 * Failures are **not** swallowed. Everywhere else in this app a bookkeeping
 * write that fails quietly costs a little accuracy; here it costs the reader
 * their belief that the menu does anything. The caller removes the row
 * optimistically, and a rejection here is how it knows to put it back and say
 * so out loud.
 */
export namespace FeedClientAPI {
  async function api(): Promise<FeedApi> {
    return new FeedApi(await getConfiguration());
  }

  export function notInterested(
    bookmarkId: string
  ): Promise<FeedFeedbackResponse> {
    return send({ kind: FeedFeedbackKind.NotInterested, bookmarkId });
  }

  export function fewerFromDomain(
    domain: string
  ): Promise<FeedFeedbackResponse> {
    return send({ kind: FeedFeedbackKind.FewerDomain, domain });
  }

  export function muteTopic(topic: string): Promise<FeedFeedbackResponse> {
    return send({ kind: FeedFeedbackKind.MuteTopic, topic });
  }

  /**
   * The next page of the feed, with the failure **kept**.
   *
   * `BookmarksClientAPI.feed` answers an error with an empty page, which is
   * right for a first render and wrong here: an empty page and a failed
   * request are indistinguishable to the caller, and one of them needs to put
   * a **Retry** in front of the reader rather than silently ending the scroll.
   *
   * Hand `nextCursor` back verbatim — the cursor carries the ranking session it
   * was produced under, and the set is re-ranked between requests.
   */
  export async function page(query: {
    scope: FeedScope;
    cursor: string;
    limit?: number;
  }): Promise<FeedResponse> {
    return await new BookmarksApi(await getConfiguration()).bookmarksFeed(query);
  }

  async function send(request: {
    kind: FeedFeedbackKind;
    bookmarkId?: string;
    domain?: string;
    topic?: string;
  }): Promise<FeedFeedbackResponse> {
    return await (
      await api()
    ).feedFeedback({ feedFeedbackRequest: request });
  }
}
