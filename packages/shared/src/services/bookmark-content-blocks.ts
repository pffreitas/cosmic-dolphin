import { load } from "cheerio";

export interface BookmarkContentBlock {
  kind: "heading" | "paragraph" | "quote" | "list_item";
  text: string;
}

export interface BookmarkContent {
  blocks: BookmarkContentBlock[];
  wordCount: number;
  source: "extracted" | "pasted";
  updatedAt: Date;
}

/** Converts stored source HTML to inert native text. No network or AI work. */
export function bookmarkContentBlocks(content: string): BookmarkContentBlock[] {
  const $ = load(content);
  $("script,style,noscript,template,iframe,object,embed,svg,math").remove();
  const supported = "h1,h2,h3,h4,p,blockquote,li";
  const blocks = $(supported).toArray().filter(element => !$(element).parents(supported).length).map(element => ({
    kind: (element.tagName.startsWith("h") ? "heading" : element.tagName === "blockquote" ? "quote" : element.tagName === "li" ? "list_item" : "paragraph") as BookmarkContentBlock["kind"],
    text: $(element).text().replace(/\s+/g, " ").trim(),
  })).filter(block => block.text).slice(0, 2000);
  if (blocks.length) return blocks;
  return $("body").text().split(/\n\s*\n/).flatMap(paragraph => {
    let remaining = paragraph.replace(/\s+/g, " ").trim();
    const runs: BookmarkContentBlock[] = [];
    while (remaining && runs.length < 2000) {
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
  }).slice(0, 2000);
}
