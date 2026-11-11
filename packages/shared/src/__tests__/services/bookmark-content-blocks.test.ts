import { bookmarkContentBlocks, limitBookmarkContent } from "../../services/bookmark-content-blocks";

it("maps supported article tags to their text-only reading kinds in source order", () => {
  expect(bookmarkContentBlocks('<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><p>A <strong>paragraph</strong>.</p><blockquote>A quote.</blockquote><ul><li>A list item.</li></ul>')).toEqual([
    ...["One", "Two", "Three", "Four"].map(text => ({ kind: "heading", text })),
    { kind: "paragraph", text: "A paragraph." }, { kind: "quote", text: "A quote." }, { kind: "list_item", text: "A list item." },
  ]);
});
it("bounds returned source blocks to 2,000 in their original order", () => {
  const blocks = bookmarkContentBlocks(Array.from({ length: 2001 }, (_, n) => `<p>Paragraph ${n}</p>`).join(""));
  expect(blocks).toHaveLength(2000);
  expect(blocks.at(-1)).toEqual({ kind: "paragraph", text: "Paragraph 1999" });
});
it("falls back to blank-line paragraphs and sentence-ended runs of at most 600 characters", () => {
  const first = "A first sentence. ".repeat(30).trim();
  const second = "B second sentence. ".repeat(30).trim();
  const blocks = bookmarkContentBlocks(`${first} ${second}\n\nLast paragraph.`);
  expect(blocks.length).toBeGreaterThan(1);
  expect(blocks.every(block => block.kind === "paragraph" && block.text.length <= 600 && block.text.endsWith("."))).toBe(true);
  expect(blocks.map(block => block.text).join(" ")).toBe(`${first} ${second} Last paragraph.`);
  expect(blocks.at(-1)?.text).toBe("Last paragraph.");
  const longWord = "x".repeat(1201);
  const hardRuns = bookmarkContentBlocks(longWord);
  expect(hardRuns.map(block => block.text.length)).toEqual([600, 600, 1]);
  expect(hardRuns.map(block => block.text).join("")).toBe(longWord);
});
it("returns only inert source text from malformed and untrusted HTML", () => {
  expect(bookmarkContentBlocks('<p onclick="steal()">Safe &amp; <a href="javascript:steal()">linked</a><script>PRIVATE_SCRIPT_SENTINEL</script><style>CSS_SENTINEL</style> text<p>Second')).toEqual([
    { kind: "paragraph", text: "Safe & linked text" }, { kind: "paragraph", text: "Second" },
  ]);
  expect(bookmarkContentBlocks('<script>unsafe()</script><style>body{}</style>')).toEqual([]);
});
it("does not duplicate paragraphs nested in quotes or list items", () => {
  expect(bookmarkContentBlocks('<blockquote><p>Quoted text.</p></blockquote><ul><li><p>List text.</p></li></ul>')).toEqual([
    { kind: "quote", text: "Quoted text." }, { kind: "list_item", text: "List text." },
  ]);
});

it("reports a partial article at the block ceiling and counts only delivered words", () => {
  const blocks = bookmarkContentBlocks(Array.from({ length: 2001 }, (_, n) => `<p>Paragraph ${n}</p>`).join(""), 2001);
  const result = limitBookmarkContent({ blocks, wordCount: 4002, source: "extracted", updatedAt: new Date("2026-11-09T00:00:00Z") });
  expect(result.truncated).toBe(true);
  expect(result.blocks).toHaveLength(2000);
  expect(result.blocks.at(-1)?.text).toBe("Paragraph 1999");
  expect(result.wordCount).toBe(4000);
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(500000);
});
it("retains a complete response unchanged when it fits", () => {
  const value = { blocks: [{ kind: "paragraph" as const, text: "Complete article." }], wordCount: 2, source: "pasted" as const, updatedAt: new Date() };
  expect(limitBookmarkContent(value)).toBe(value);
});
