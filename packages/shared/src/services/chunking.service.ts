import * as cheerio from "cheerio";

export interface ChunkResult {
  content: string;
  index: number;
  size: number;
  startPosition: number;
  endPosition: number;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 50;

const PARAGRAPH_SEPARATORS = ["\n\n", "\n"];
const SENTENCE_ENDINGS = /(?<=[.!?])\s+/;
const WORD_BOUNDARY = /\s+/;

export interface ChunkingService {
  chunkHtml(html: string, options?: ChunkingOptions): ChunkResult[];
  stripHtml(html: string): string;
}

export class ChunkingServiceImpl implements ChunkingService {
  stripHtml(html: string): string {
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside").remove();

    const text = $.text();
    return text
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  chunkHtml(html: string, options: ChunkingOptions = {}): ChunkResult[] {
    const text = this.stripHtml(html);
    if (!text || text.length === 0) {
      return [];
    }

    const maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

    return this.recursiveSplit(text, maxChunkSize, chunkOverlap);
  }

  private recursiveSplit(
    text: string,
    maxSize: number,
    overlap: number
  ): ChunkResult[] {
    if (text.length <= maxSize) {
      return [
        {
          content: text,
          index: 0,
          size: text.length,
          startPosition: 0,
          endPosition: text.length,
        },
      ];
    }

    let segments = this.splitBySeparators(text, PARAGRAPH_SEPARATORS);

    if (segments.length <= 1) {
      segments = text.split(SENTENCE_ENDINGS).filter((s) => s.length > 0);
    }

    if (segments.length <= 1) {
      segments = text.split(WORD_BOUNDARY).filter((s) => s.length > 0);
    }

    const chunks: ChunkResult[] = [];
    let currentChunk = "";
    let currentStart = 0;
    let textPos = 0;

    for (const segment of segments) {
      const segmentStart = text.indexOf(segment, textPos);
      if (segmentStart === -1) continue;
      textPos = segmentStart + segment.length;

      if (
        currentChunk.length > 0 &&
        currentChunk.length + segment.length + 1 > maxSize
      ) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          size: currentChunk.trim().length,
          startPosition: currentStart,
          endPosition: currentStart + currentChunk.trim().length,
        });

        const overlapText = this.getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + (overlapText ? " " : "") + segment;
        currentStart = textPos - currentChunk.length;
      } else {
        if (currentChunk.length === 0) {
          currentStart = segmentStart;
        }
        currentChunk +=
          (currentChunk.length > 0 ? " " : "") + segment;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        size: currentChunk.trim().length,
        startPosition: currentStart,
        endPosition: currentStart + currentChunk.trim().length,
      });
    }

    return chunks;
  }

  private splitBySeparators(text: string, separators: string[]): string[] {
    for (const sep of separators) {
      const parts = text.split(sep).filter((s) => s.trim().length > 0);
      if (parts.length > 1) {
        return parts;
      }
    }
    return [text];
  }

  private getOverlapText(chunk: string, overlapChars: number): string {
    if (overlapChars <= 0 || chunk.length <= overlapChars) {
      return "";
    }
    const tail = chunk.slice(-overlapChars);
    const wordBoundary = tail.indexOf(" ");
    if (wordBoundary > 0) {
      return tail.slice(wordBoundary + 1);
    }
    return tail;
  }
}
