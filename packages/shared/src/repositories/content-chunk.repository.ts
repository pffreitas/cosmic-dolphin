import { Kysely } from "kysely";
import { BaseRepository } from "./base.repository";
import {
  Database,
  ContentChunk,
  NewContentChunk,
  ContentChunkUpdate,
  NewTextChunk,
  NewImageChunk,
} from "../database/schema";
import {
  BaseContentChunk,
  TextChunk as TypeScriptTextChunk,
  ImageChunk as TypeScriptImageChunk,
  ContentChunk as TypeScriptContentChunk,
} from "../types";

export interface CreateTextChunkData {
  scrapedContentId: string;
  content: string;
  index: number;
  size: number;
  startPosition: number;
  endPosition: number;
}

export interface CreateImageChunkData {
  scrapedContentId: string;
  imageData: Buffer;
  mimeType: string;
  altText?: string;
  originalUrl?: string;
  index: number;
  size: number;
  startPosition: number;
  endPosition: number;
}

export interface ContentChunkRepository {
  createTextChunk(data: CreateTextChunkData): Promise<TypeScriptTextChunk>;
  createImageChunk(data: CreateImageChunkData): Promise<TypeScriptImageChunk>;
  findByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptContentChunk[]>;
  findTextChunksByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptTextChunk[]>;
  findImageChunksByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptImageChunk[]>;
  findById(id: string): Promise<TypeScriptContentChunk | null>;
  deleteByScrapedContentId(scrapedContentId: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export class ContentChunkRepositoryImpl
  extends BaseRepository
  implements ContentChunkRepository
{
  constructor(db: Kysely<Database>) {
    super(db);
  }

  async createTextChunk(
    data: CreateTextChunkData
  ): Promise<TypeScriptTextChunk> {
    return this.executeQuery(async () => {
      return await this.db.transaction().execute(async (trx) => {
        // Insert base chunk
        const baseChunk = await trx
          .insertInto("content_chunks")
          .values({
            scraped_content_id: data.scrapedContentId,
            chunk_type: "text",
            index: data.index,
            size: data.size,
            start_position: data.startPosition,
            end_position: data.endPosition,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Insert text-specific data
        await trx
          .insertInto("text_chunks")
          .values({
            chunk_id: baseChunk.id,
            content: data.content,
          })
          .execute();

        return {
          id: baseChunk.id,
          createdAt: baseChunk.created_at,
          updatedAt: baseChunk.updated_at,
          scrapedContentId: data.scrapedContentId,
          chunkType: "text" as const,
          index: data.index,
          size: data.size,
          startPosition: data.startPosition,
          endPosition: data.endPosition,
          content: data.content,
        };
      });
    }, "createTextChunk");
  }

  async createImageChunk(
    data: CreateImageChunkData
  ): Promise<TypeScriptImageChunk> {
    return this.executeQuery(async () => {
      return await this.db.transaction().execute(async (trx) => {
        // Insert base chunk
        const baseChunk = await trx
          .insertInto("content_chunks")
          .values({
            scraped_content_id: data.scrapedContentId,
            chunk_type: "image",
            index: data.index,
            size: data.size,
            start_position: data.startPosition,
            end_position: data.endPosition,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Insert image-specific data
        await trx
          .insertInto("image_chunks")
          .values({
            chunk_id: baseChunk.id,
            image_data: data.imageData,
            mime_type: data.mimeType,
            alt_text: data.altText || null,
            original_url: data.originalUrl || null,
          })
          .execute();

        return {
          id: baseChunk.id,
          createdAt: baseChunk.created_at,
          updatedAt: baseChunk.updated_at,
          scrapedContentId: data.scrapedContentId,
          chunkType: "image" as const,
          index: data.index,
          size: data.size,
          startPosition: data.startPosition,
          endPosition: data.endPosition,
          imageData: data.imageData,
          mimeType: data.mimeType,
          altText: data.altText,
          originalUrl: data.originalUrl,
        };
      });
    }, "createImageChunk");
  }

  async findByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptContentChunk[]> {
    return this.executeQuery(async () => {
      const textChunks =
        await this.findTextChunksByScrapedContentId(scrapedContentId);
      const imageChunks =
        await this.findImageChunksByScrapedContentId(scrapedContentId);

      const allChunks: TypeScriptContentChunk[] = [
        ...textChunks,
        ...imageChunks,
      ];

      // Sort by index to maintain order
      return allChunks.sort((a, b) => a.index - b.index);
    }, "findByScrapedContentId");
  }

  async findTextChunksByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptTextChunk[]> {
    return this.executeQuery(async () => {
      const results = await this.db
        .selectFrom("content_chunks")
        .innerJoin("text_chunks", "content_chunks.id", "text_chunks.chunk_id")
        .selectAll("content_chunks")
        .select("text_chunks.content")
        .where("content_chunks.scraped_content_id", "=", scrapedContentId)
        .where("content_chunks.chunk_type", "=", "text")
        .orderBy("content_chunks.index", "asc")
        .execute();

      return results.map((result) => ({
        id: result.id,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        scrapedContentId,
        chunkType: "text" as const,
        index: result.index,
        size: result.size,
        startPosition: result.start_position,
        endPosition: result.end_position,
        content: result.content,
      }));
    }, "findTextChunksByScrapedContentId");
  }

  async findImageChunksByScrapedContentId(
    scrapedContentId: string
  ): Promise<TypeScriptImageChunk[]> {
    return this.executeQuery(async () => {
      const results = await this.db
        .selectFrom("content_chunks")
        .innerJoin("image_chunks", "content_chunks.id", "image_chunks.chunk_id")
        .selectAll("content_chunks")
        .select([
          "image_chunks.image_data",
          "image_chunks.mime_type",
          "image_chunks.alt_text",
          "image_chunks.original_url",
        ])
        .where("content_chunks.scraped_content_id", "=", scrapedContentId)
        .where("content_chunks.chunk_type", "=", "image")
        .orderBy("content_chunks.index", "asc")
        .execute();

      return results.map((result) => ({
        id: result.id,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        scrapedContentId,
        chunkType: "image" as const,
        index: result.index,
        size: result.size,
        startPosition: result.start_position,
        endPosition: result.end_position,
        imageData: result.image_data,
        mimeType: result.mime_type,
        altText: result.alt_text || undefined,
        originalUrl: result.original_url || undefined,
      }));
    }, "findImageChunksByScrapedContentId");
  }

  async findById(id: string): Promise<TypeScriptContentChunk | null> {
    return this.executeQuery(async () => {
      const baseChunk = await this.db
        .selectFrom("content_chunks")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!baseChunk) {
        return null;
      }

      if (baseChunk.chunk_type === "text") {
        const textData = await this.db
          .selectFrom("text_chunks")
          .selectAll()
          .where("chunk_id", "=", id)
          .executeTakeFirst();

        if (!textData) {
          throw new Error(`Text chunk data not found for chunk ${id}`);
        }

        return {
          id: baseChunk.id,
          createdAt: baseChunk.created_at,
          updatedAt: baseChunk.updated_at,
          scrapedContentId: baseChunk.scraped_content_id,
          chunkType: "text" as const,
          index: baseChunk.index,
          size: baseChunk.size,
          startPosition: baseChunk.start_position,
          endPosition: baseChunk.end_position,
          content: textData.content,
        };
      } else {
        const imageData = await this.db
          .selectFrom("image_chunks")
          .selectAll()
          .where("chunk_id", "=", id)
          .executeTakeFirst();

        if (!imageData) {
          throw new Error(`Image chunk data not found for chunk ${id}`);
        }

        return {
          id: baseChunk.id,
          createdAt: baseChunk.created_at,
          updatedAt: baseChunk.updated_at,
          scrapedContentId: baseChunk.scraped_content_id,
          chunkType: "image" as const,
          index: baseChunk.index,
          size: baseChunk.size,
          startPosition: baseChunk.start_position,
          endPosition: baseChunk.end_position,
          imageData: imageData.image_data,
          mimeType: imageData.mime_type,
          altText: imageData.alt_text || undefined,
          originalUrl: imageData.original_url || undefined,
        };
      }
    }, "findById");
  }

  async deleteByScrapedContentId(scrapedContentId: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db
        .deleteFrom("content_chunks")
        .where("scraped_content_id", "=", scrapedContentId)
        .execute();
    }, "deleteByScrapedContentId");
  }

  async delete(id: string): Promise<void> {
    return this.executeQuery(async () => {
      await this.db.deleteFrom("content_chunks").where("id", "=", id).execute();
    }, "delete");
  }
}
