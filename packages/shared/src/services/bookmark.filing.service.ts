import { z } from "zod";
import { Bookmark, CollectionSuggestion } from "../types";
import { CollectionRepository } from "../repositories/collection.repository";
import { CollectionSuggestionRow } from "../database/schema";
import { AI } from "../ai";
import { Session } from "../ai/types";
import {
  buildCollectionTreeText,
  buildFilingPrompt,
} from "./bookmark.filing.prompt";
import { BOOKMARK_MODEL_IDS } from "./bookmark.model-ids";
import { BookmarkProcessingPhaseReporter } from "./bookmark-processing-reporter.service";
import { BookmarkService } from "./bookmark.service";

/**
 * How many bookmarks must point at a proposed collection before the user is
 * asked about it — docs/functional-spec/03-ai-pipeline.md § Filing.
 *
 * One bookmark is a coincidence. Offering to create a collection on the
 * strength of a single save is how a tree grows sixty branches nobody asked
 * for, which is the state this deliverable is undoing.
 */
export const MIN_SUGGESTION_SUPPORT = 5;

/**
 * Below this, an answer naming an existing collection is treated as no answer
 * and the bookmark stays in the Inbox. The threshold is deliberately the same
 * one the old categoriser used, so the only behaviour that changes here is what
 * happens when it is *not* met.
 */
export const FILING_CONFIDENCE_THRESHOLD = 0.7;

/** How long a dismissal is remembered before a proposal may return (D7). */
export const SUGGESTION_DISMISSAL_DAYS = 30;

/**
 * The model's answer. Three shapes, not two: `existingCollectionId` and
 * `newCollection` may both be null, and that is a real answer.
 */
export const FilingResponseSchema = z.object({
  existingCollectionId: z.string().nullable(),
  newCollection: z
    .object({
      name: z.string(),
      parentId: z.string().nullable(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type FilingResponse = z.infer<typeof FilingResponseSchema>;

/**
 * Why a bookmark ended up in the Inbox. All of these are ordinary outcomes;
 * none is an error. They are distinguished so the internal cost view can tell
 * "the model declined" from "the model named a collection that does not exist".
 */
export type InboxReason =
  | "model_declined"
  | "low_confidence"
  | "unknown_collection"
  | "proposal_rejected";

export type FilingResult =
  | {
      /** The pipeline was refused: a person filed this bookmark. */
      outcome: "override";
    }
  | {
      /** Filed into a collection that already existed. The common case. */
      outcome: "filed";
      collectionId: string;
      collectionPath: string[];
      confidence: number;
      reasoning: string;
    }
  | {
      /**
       * A new collection was proposed and now has one more supporting
       * bookmark. Nothing was created; the bookmark stays in the Inbox until
       * the user accepts.
       */
      outcome: "proposed";
      suggestion: CollectionSuggestion;
      supportCount: number;
      /** True once `MIN_SUGGESTION_SUPPORT` bookmarks agree. */
      readyToOffer: boolean;
      confidence: number;
      reasoning: string;
    }
  | {
      /** No good home. A valid resting place, not a failure. */
      outcome: "inbox";
      reason: InboxReason;
      confidence: number;
      reasoning: string;
    };

export interface BookmarkFilingService {
  file(
    session: Session,
    bookmark: Bookmark,
    phaseReporter?: BookmarkProcessingPhaseReporter
  ): Promise<FilingResult>;
}

/**
 * The `file` phase.
 *
 * What changed, and why it is the riskiest change in the revamp: this used to
 * create collections. Every run that could not match the tree called
 * `collectionRepository.createPath` and a branch appeared — including a
 * hardcoded "Uncategorized" fallback, which is an Inbox with extra steps and a
 * row in the user's tree. `createPath` no longer exists.
 *
 * Now the phase proposes. The model returns one of three things
 * (docs/functional-spec/03-ai-pipeline.md § Filing):
 *
 *   1. an existing collection id — filed, through the guarded write;
 *   2. a proposal — recorded in `collection_suggestions`, offered to the user
 *      only once `MIN_SUGGESTION_SUPPORT` bookmarks agree, and the bookmark
 *      stays in the Inbox meanwhile;
 *   3. nothing — the Inbox, which is where a bookmark with no good home
 *      belongs.
 *
 * And it never moves a bookmark a person has filed. That check is here so the
 * run does not spend tokens deciding something it cannot act on, but it is not
 * *enforced* here: the enforcement is the `WHERE filing_source = 'ai'` inside
 * `BookmarkRepository.updateAiFiling`, which holds even for a decision taken
 * before the user refiled and for any future caller that forgets to ask.
 */
export class BookmarkFilingServiceImpl implements BookmarkFilingService {
  constructor(
    private collectionRepository: CollectionRepository,
    private bookmarkService: BookmarkService,
    private ai: AI
  ) {}

  async file(
    session: Session,
    bookmark: Bookmark,
    phaseReporter?: BookmarkProcessingPhaseReporter
  ): Promise<FilingResult> {
    // Cheap pre-check. The real guard is in SQL; this one only saves a model
    // call on a bookmark the pipeline was never going to be allowed to move.
    if (bookmark.filingSource === "user") {
      return { outcome: "override" };
    }

    const collections = await this.collectionRepository.findTreeByUser(
      bookmark.userId
    );

    const prompt = buildFilingPrompt({
      collectionTree: buildCollectionTreeText(
        collections.map((collection) => ({
          id: collection.id,
          name: collection.name,
          parentId: collection.parent_id,
        }))
      ),
      title: bookmark.title || "",
      url: bookmark.sourceUrl,
      summary: bookmark.cosmicSummary || bookmark.cosmicBriefSummary || "",
      tags: bookmark.cosmicTags || [],
    });

    const response = phaseReporter
      ? await phaseReporter.trackTurn(
          "Choose a collection",
          BOOKMARK_MODEL_IDS.small,
          async () =>
            this.ai.generateObjectWithUsage({
              sessionID: session.sessionID,
              modelId: BOOKMARK_MODEL_IDS.small,
              prompt,
              schema: FilingResponseSchema,
            })
        )
      : await this.ai.generateObject({
          sessionID: session.sessionID,
          modelId: BOOKMARK_MODEL_IDS.small,
          prompt,
          schema: FilingResponseSchema,
        });

    return this.applyDecision(bookmark, collections, response);
  }

  private async applyDecision(
    bookmark: Bookmark,
    collections: Array<{ id: string; name: string; parent_id: string | null }>,
    response: FilingResponse
  ): Promise<FilingResult> {
    const { confidence, reasoning } = response;
    const inbox = (reason: InboxReason): FilingResult => ({
      outcome: "inbox",
      reason,
      confidence,
      reasoning,
    });

    if (response.existingCollectionId) {
      const match = collections.find(
        (collection) => collection.id === response.existingCollectionId
      );
      // A model that names a collection the user does not have has not
      // answered the question. Inventing the collection to make the answer
      // true is precisely what this phase no longer does.
      if (!match) return inbox("unknown_collection");
      if (confidence < FILING_CONFIDENCE_THRESHOLD) {
        return inbox("low_confidence");
      }

      const filed = await this.bookmarkService.fileByPipeline(
        bookmark.id,
        match.id
      );
      // Refused by the override rule between the read and the write.
      if (!filed) return { outcome: "override" };

      return {
        outcome: "filed",
        collectionId: match.id,
        collectionPath: this.buildPathFromId(collections, match.id),
        confidence,
        reasoning,
      };
    }

    if (response.newCollection) {
      return this.proposeCollection(
        bookmark,
        collections,
        response.newCollection,
        confidence,
        reasoning
      );
    }

    // The model declined. The bookmark stays wherever it is, which for a new
    // save is the Inbox. Nothing is written: "no opinion" is not a reason to
    // undo a filing an earlier run made on better evidence.
    return inbox("model_declined");
  }

  private async proposeCollection(
    bookmark: Bookmark,
    collections: Array<{ id: string; name: string; parent_id: string | null }>,
    proposal: { name: string; parentId: string | null },
    confidence: number,
    reasoning: string
  ): Promise<FilingResult> {
    const name = proposal.name.trim();
    if (!name) return { outcome: "inbox", reason: "proposal_rejected", confidence, reasoning };

    const parentId = proposal.parentId ?? null;
    if (parentId !== null) {
      const parent = collections.find(
        (collection) => collection.id === parentId
      );
      // Two levels, enforced here as well as in the API (D7): a proposal under
      // a child collection would be a third level the tree does not have.
      if (!parent || parent.parent_id !== null) {
        return {
          outcome: "inbox",
          reason: "proposal_rejected",
          confidence,
          reasoning,
        };
      }
    }

    // A proposal that names a collection the user already has is really an
    // answer of the first kind, arrived at clumsily. File into it.
    const existing = collections.find(
      (collection) =>
        collection.parent_id === parentId &&
        collection.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      const filed = await this.bookmarkService.fileByPipeline(
        bookmark.id,
        existing.id
      );
      if (!filed) return { outcome: "override" };
      return {
        outcome: "filed",
        collectionId: existing.id,
        collectionPath: this.buildPathFromId(collections, existing.id),
        confidence,
        reasoning,
      };
    }

    const suggestion = await this.collectionRepository.recordSuggestionSupport(
      bookmark.userId,
      name,
      parentId,
      bookmark.id
    );
    // The user has already accepted or recently dismissed this name. Their
    // answer stands; the bookmark goes to the Inbox rather than asking again.
    if (!suggestion) {
      return {
        outcome: "inbox",
        reason: "proposal_rejected",
        confidence,
        reasoning,
      };
    }

    const supportCount = suggestion.bookmark_ids.length;
    return {
      outcome: "proposed",
      suggestion: mapSuggestionRow(suggestion),
      supportCount,
      readyToOffer: supportCount >= MIN_SUGGESTION_SUPPORT,
      confidence,
      reasoning,
    };
  }

  private buildPathFromId(
    collections: Array<{ id: string; name: string; parent_id: string | null }>,
    collectionId: string
  ): string[] {
    const path: string[] = [];
    const byId = new Map(collections.map((c) => [c.id, c]));

    let current = byId.get(collectionId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      path.unshift(current.name);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return path;
  }
}

export function mapSuggestionRow(
  row: CollectionSuggestionRow
): CollectionSuggestion {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    parentId: row.parent_id ?? undefined,
    bookmarkIds: row.bookmark_ids,
    status: row.status,
    dismissedUntil: row.dismissed_until
      ? new Date(row.dismissed_until)
      : undefined,
    createdAt: new Date(row.created_at),
  };
}
