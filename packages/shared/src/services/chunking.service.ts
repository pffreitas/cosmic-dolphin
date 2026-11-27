import * as cheerio from "cheerio";
import type { AnyNode, Element, Text } from "domhandler";

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

// A safety valve for pathological pages, not the model's context limit.
export const MAX_MODEL_CONTENT_CHARS = 160_000;
const ELISION_MARKER = "\n\n[… content elided …]\n\n";

export function budgetText(text: string, maxChars = MAX_MODEL_CONTENT_CHARS): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) return { text, truncated: false };

  const available = maxChars - ELISION_MARKER.length;
  if (available <= 0) return { text: text.slice(0, maxChars), truncated: true };
  const head = Math.ceil(available * 0.75);
  const tail = available - head;
  return {
    text: text.slice(0, head).trimEnd() + ELISION_MARKER + (tail ? text.slice(-tail).trimStart() : ""),
    truncated: true,
  };
}

const PARAGRAPH_SEPARATORS = ["\n\n", "\n"];
const SENTENCE_ENDINGS = /(?<=[.!?])\s+/;
const WORD_BOUNDARY = /\s+/;

export interface ChunkingService {
  chunkHtml(html: string, options?: ChunkingOptions): ChunkResult[];
  stripHtml(html: string): string;
}

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "dd", "details", "div", "dl", "dt", "fieldset",
  "figcaption", "figure", "footer", "form", "header", "hr", "main", "nav", "p",
  "section", "summary", "table", "tbody", "tfoot", "thead", "tr",
]);

/** Plain text, not markup: X posts are stored as text unless they carry a linked article. */
const looksLikeHtml = (text: string) => /<(?:[a-z][a-z0-9-]*|!--)[\s>/]/i.test(text);

function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class ChunkingServiceImpl implements ChunkingService {
  /**
   * Readable text with the source's structure: blocks separated by blank lines,
   * `#` headings, `-` and numbered list items, `>` quotes and image alt text.
   * The summary, tags, search and embeddings all read this.
   */
  stripHtml(html: string): string {
    if (!looksLikeHtml(html)) return tidy(html);
    const $ = cheerio.load(html);
    $("script, style, nav, footer, aside, noscript, template, iframe, svg").remove();
    // A page's own header holds the article title; a site header holds chrome.
    $("header").filter((_, element) => $(element).find("h1").length === 0).remove();

    const render = (nodes: AnyNode[]): string => nodes.map(renderNode).join("");
    const renderNode = (node: AnyNode): string => {
      if (node.type === "text") return (node as Text).data.replace(/\s+/g, " ");
      if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return "";
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      const children = element.children as AnyNode[];
      if (tag === "br") return "\n";
      if (tag === "img") {
        const alt = $(element).attr("alt")?.replace(/\s+/g, " ").trim();
        return alt ? `\n\n[Image: ${alt}]\n\n` : "";
      }
      if (/^h[1-6]$/.test(tag)) {
        return `\n\n${"#".repeat(Number(tag[1]))} ${tidy(render(children)).replace(/\n+/g, " ")}\n\n`;
      }
      if (tag === "ul" || tag === "ol") {
        const items = children.filter((child) => child.type === "tag" && (child as Element).tagName.toLowerCase() === "li") as Element[];
        const lines = items.map((item, index) => {
          const marker = tag === "ol" ? `${index + 1}. ` : "- ";
          const [first = "", ...rest] = tidy(render(item.children as AnyNode[])).replace(/\n{2,}/g, "\n").split("\n");
          return [marker + first, ...rest.map((line) => `  ${line}`)].join("\n");
        });
        return `\n\n${lines.join("\n")}\n\n`;
      }
      if (tag === "li") return `\n- ${tidy(render(children))}\n`;
      if (tag === "blockquote") {
        const quoted = tidy(render(children)).split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n");
        return `\n\n${quoted}\n\n`;
      }
      if (tag === "pre") return `\n\n${$(element).text()}\n\n`;
      if (tag === "td" || tag === "th") return `${render(children)} `;
      if (BLOCK_TAGS.has(tag)) return `\n\n${render(children)}\n\n`;
      return render(children);
    };

    return tidy(render(($("body")[0]?.children ?? []) as AnyNode[]));
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

    // A long paragraph among short blocks must still fit the chunk, overlap included.
    const limit = Math.max(1, maxSize - overlap - 1);
    segments = segments.flatMap((segment) =>
      segment.length > limit ? this.splitLong(segment, limit) : [segment]
    );

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

  /** Exact slices of `text`, each at most `limit` long, cut at a sentence end, else a space. */
  private splitLong(text: string, limit: number): string[] {
    const pieces: string[] = [];
    let rest = text.trim();
    while (rest.length > limit) {
      const window = rest.slice(0, limit + 1);
      let cut = 0;
      for (const match of window.matchAll(/[.!?](?=\s)/g)) cut = match.index! + 1;
      if (cut <= 0) cut = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\n"));
      if (cut <= 0) cut = limit;
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);
    return pieces.filter(Boolean);
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
