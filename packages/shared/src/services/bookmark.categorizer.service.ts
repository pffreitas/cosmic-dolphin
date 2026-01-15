import { z } from "zod";
import { Bookmark, ScrapedUrlContents } from "../types";
import { CollectionRepository } from "../repositories/collection.repository";
import { AI } from "../ai";
import { Session } from "../ai/types";
import { Identifier } from "../ai/id";
import { EventBus } from "../ai/bus";
import {
  buildCategoryTreeText,
  buildCategorizationPrompt,
} from "./bookmark.categorizer.prompt";

// Zod schema for LLM response validation
export const CategorizationResponseSchema = z.object({
  existingCategoryId: z.string().nullable(),
  newCategoryPath: z.array(z.string()).nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type CategorizationResponse = z.infer<typeof CategorizationResponseSchema>;

export interface CategorizationResult {
  categoryId: string;
  categoryPath: string[];
  isNewCategory: boolean;
  confidence: number;
}

export interface BookmarkCategorizerService {
  categorize(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<CategorizationResult>;
}

export class BookmarkCategorizerServiceImpl implements BookmarkCategorizerService {
  constructor(
    private collectionRepository: CollectionRepository,
    private ai: AI,
    private eventBus: EventBus
  ) {}

  async categorize(
    session: Session,
    bookmark: Bookmark,
    content: ScrapedUrlContents
  ): Promise<CategorizationResult> {
    const task = await this.ai.newTask(session.sessionID, "Categorizing bookmark");
    const subTask = await this.ai.newSubTask("Analyzing content for categorization");
    task.subTasks[subTask.taskID] = subTask;
    await this.eventBus.publishToBookmark(bookmark.id, "task.started", task);

    try {
      // Fetch user's existing category tree
      const categories = await this.collectionRepository.findTreeByUser(bookmark.userId);

      // Build category tree text for the LLM
      const categoryTree = buildCategoryTreeText(
        categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parent_id,
        }))
      );

      // Build the categorization prompt
      const prompt = buildCategorizationPrompt({
        categoryTree,
        title: bookmark.title || content.title || "",
        url: bookmark.sourceUrl,
        summary: bookmark.cosmicSummary || "",
        tags: bookmark.cosmicTags || [],
      });

      // Call LLM for categorization
      const response = await this.ai.generateObject({
        sessionID: session.sessionID,
        modelId: "x-ai/grok-code-fast-1",
        prompt,
        schema: CategorizationResponseSchema,
      });

      // Process the response
      let categoryId: string;
      let categoryPath: string[];
      let isNewCategory: boolean;

      if (response.existingCategoryId && response.confidence >= 0.7) {
        // Use existing category
        categoryId = response.existingCategoryId;
        categoryPath = this.buildPathFromId(categories, response.existingCategoryId);
        isNewCategory = false;
      } else if (response.newCategoryPath && response.newCategoryPath.length > 0) {
        // Create new category path
        const newCategory = await this.collectionRepository.createPath(
          bookmark.userId,
          response.newCategoryPath
        );
        categoryId = newCategory.id;
        categoryPath = response.newCategoryPath;
        isNewCategory = true;
      } else {
        // Fallback: create an "Uncategorized" category
        const uncategorized = await this.collectionRepository.createPath(
          bookmark.userId,
          ["Uncategorized"]
        );
        categoryId = uncategorized.id;
        categoryPath = ["Uncategorized"];
        isNewCategory = true;
      }

      task.subTasks[subTask.taskID].status = "completed";
      await this.eventBus.publishToBookmark(bookmark.id, "task.completed", task);

      return {
        categoryId,
        categoryPath,
        isNewCategory,
        confidence: response.confidence,
      };
    } catch (error) {
      console.error("Failed to categorize bookmark", error);
      task.subTasks[subTask.taskID].status = "failed";
      await this.eventBus.publishToBookmark(bookmark.id, "task.failed", task);
      throw error;
    }
  }

  private buildPathFromId(
    categories: Array<{ id: string; name: string; parent_id: string | null }>,
    categoryId: string
  ): string[] {
    const path: string[] = [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    let current = categoryMap.get(categoryId);
    while (current) {
      path.unshift(current.name);
      current = current.parent_id ? categoryMap.get(current.parent_id) : undefined;
    }

    return path;
  }
}
