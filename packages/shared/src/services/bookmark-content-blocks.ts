import { load } from "cheerio";

export interface BookmarkContentBlock {
  kind: "heading" | "paragraph" | "quote" | "list_item";
  text: string;
}

export interface BookmarkContent {
  truncated?: boolean;
  blocks: BookmarkContentBlock[];
  wordCount: number;
  source: "extracted" | "pasted";
  updatedAt: Date;
}

/** Converts stored source HTML to inert native text. No network or AI work. */
export function bookmarkContentBlocks(content: string, limit = 2000): BookmarkContentBlock[] {
  const $ = load(content);
  $("script,style,noscript,template,iframe,object,embed,svg,math").remove();
  const supported = "h1,h2,h3,h4,p,blockquote,li";
  const blocks = $(supported).toArray().filter(element => !$(element).parents(supported).length).map(element => ({
    kind: (element.tagName.startsWith("h") ? "heading" : element.tagName === "blockquote" ? "quote" : element.tagName === "li" ? "list_item" : "paragraph") as BookmarkContentBlock["kind"],
    text: $(element).text().replace(/\s+/g, " ").trim(),
  })).filter(block => block.text).slice(0, limit);
  if (blocks.length) return blocks;
  return $("body").text().split(/\n\s*\n/).flatMap(paragraph => {
    let remaining = paragraph.replace(/\s+/g, " ").trim();
    const runs: BookmarkContentBlock[] = [];
    while (remaining && runs.length < limit) {
      let end = Math.min(600, remaining.length);
      if (remaining.length > 600) {
        const sentenceEnds = [...remaining.slice(0, 601).matchAll(/[.!?](?=\s)/g)];
        const lastSentence = sentenceEnds.at(-1);
        const lastSpace = remaining.lastIndexOf(" ", 600);
        end = lastSentence ? lastSentence.index! + 1 : lastSpace > 0 ? lastSpace : 600;
      }
      runs.push({ kind: "paragraph", text: remaining.slice(0, end).trim() });
      remaining = remaining.slice(end).trim();
    }
    return runs;
  }).slice(0, limit);
}

const MAX_CONTENT_BYTES = 500000;
const MAX_CONTENT_BLOCKS = 2000;
const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

/** Keep the opening article text within the complete UTF-8 JSON response budget. */
export function limitBookmarkContent(content: BookmarkContent): BookmarkContent {
  if (content.blocks.length <= MAX_CONTENT_BLOCKS && jsonBytes(content) <= MAX_CONTENT_BYTES) return content;
  const result: BookmarkContent = { ...content, blocks: [], wordCount: 0, truncated: true };
  let bytes = jsonBytes(result);
  const append = (block: BookmarkContentBlock, words: number) => {
    bytes += jsonBytes(block) + (result.blocks.length ? 1 : 0)
      + String(result.wordCount + words).length - String(result.wordCount).length;
    result.blocks.push(block); result.wordCount += words;
  };
  for (const block of content.blocks) {
    if (result.blocks.length === MAX_CONTENT_BLOCKS) break;
    const fits = (candidate: BookmarkContentBlock) => bytes + jsonBytes(candidate)
      + (result.blocks.length ? 1 : 0)
      + String(result.wordCount + wordCount(candidate.text)).length - String(result.wordCount).length <= MAX_CONTENT_BYTES;
    if (fits(block)) { append(block, wordCount(block.text)); continue; }
    let low = 0; let high = block.text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (fits({ ...block, text: block.text.slice(0, middle) })) low = middle;
      else high = middle - 1;
    }
    // Never leave half of a UTF-16 surrogate pair or a partial word when a boundary exists.
    if (low && /[\uD800-\uDBFF]/.test(block.text[low - 1])) --low;
    if (low < block.text.length && !/\s/.test(block.text[low])) {
      const boundary = block.text.lastIndexOf(" ", low - 1);
      if (boundary > 0) low = boundary;
    }
    const text = block.text.slice(0, low).trimEnd();
    if (text) append({ ...block, text }, wordCount(text));
    break;
  }
  return result;
}
