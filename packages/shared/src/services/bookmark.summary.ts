import { z } from "zod";

// Keep the schema compatible with strict structured outputs. Enforce length and
// count limits after generation: min/max constraints are not accepted by every
// upstream provider's JSON schema implementation.
export const SUMMARY_SCHEMA = z.object({
  contentStatus: z.enum(["ok", "unusable"]),
  unusableReason: z.string(),
  brief: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
});

export const BRIEF_ONLY_SCHEMA = SUMMARY_SCHEMA.pick({
  contentStatus: true,
  unusableReason: true,
  brief: true,
  keyPoints: true,
});

export type SummaryRecord = z.infer<typeof SUMMARY_SCHEMA>;

function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*]+)\*(?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampText(text: string, maxLength: number): string {
  const clean = plainText(text);
  if (clean.length <= maxLength) return clean;

  const clipped = clean.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > maxLength / 2 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\s]+$/, "")}…`;
}

export function normaliseKeyPoints(points: string[]): string[] {
  return [...new Set(points.map((point) => clampText(point, 140)).filter(Boolean))].slice(0, 5);
}

function safeMarkdown(text: string): string {
  return text
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "### ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderSummaryMarkdown(record: SummaryRecord, points: string[]): string {
  const overview = safeMarkdown(record.overview);
  const sections = record.sections
    .slice(0, 8)
    .map(({ heading, body }) => ({ heading: clampText(heading, 100), body: safeMarkdown(body) }))
    .filter(({ heading, body }) => heading && body);
  // Leave room for key points even when the model writes an oversized overview.
  const pointBlock = points.length > 0
    ? `## Key Points\n\n${points.map((point) => `- ${point}`).join("\n")}`
    : "";
  const overviewBudget = 20_000 - pointBlock.length - (pointBlock ? 2 : 0);
  let markdown = overview.slice(0, overviewBudget).trimEnd();
  if (pointBlock) markdown = [markdown, pointBlock].filter(Boolean).join("\n\n");

  // Drop whole trailing sections rather than cutting through a link or table.
  for (const section of sections) {
    const next = [markdown, `## ${section.heading}\n\n${section.body}`]
      .filter(Boolean)
      .join("\n\n");
    if (next.length > 20_000) continue;
    markdown = next;
  }
  return markdown;
}
