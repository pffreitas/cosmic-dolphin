import { ChunkingServiceImpl } from "../../services/chunking.service";

const chunking = new ChunkingServiceImpl();

describe("stripHtml keeps article structure", () => {
  it("keeps adjacent blocks distinct", () => {
    expect(chunking.stripHtml("<div><span>Alex Konrad</span></div><div>Nov 11, 2026</div><p>One.</p><p>Two.</p>"))
      .toBe("Alex Konrad\n\nNov 11, 2026\n\nOne.\n\nTwo.");
  });

  it("marks headings, list items and quotes", () => {
    const html = "<h2>Why it matters</h2><ul><li>Fewer approvals</li><li>Faster <b>verification</b></li></ul>"
      + "<ol><li>Triage</li><li>Ship</li></ol><blockquote><p>First line.</p><p>Second line.</p></blockquote>";
    expect(chunking.stripHtml(html)).toBe([
      "## Why it matters",
      "- Fewer approvals\n- Faster verification",
      "1. Triage\n2. Ship",
      "> First line.\n>\n> Second line.",
    ].join("\n\n"));
  });

  it("keeps a header holding the h1 and drops site headers", () => {
    const html = "<header><a href='/'>Home</a><a href='/about'>About</a></header>"
      + "<article><header><h1>Shipping 100+ PRs</h1><p>By Will Larson</p></header><p>Body.</p></article>";
    expect(chunking.stripHtml(html)).toBe("# Shipping 100+ PRs\n\nBy Will Larson\n\nBody.");
  });

  it("keeps image alt text and drops images without it", () => {
    expect(chunking.stripHtml('<p>Results:</p><figure><img src="a.png" alt="Bar chart: 115 PRs in one week"><img src="b.png"></figure>'))
      .toBe("Results:\n\n[Image: Bar chart: 115 PRs in one week]");
  });

  it("drops scripts, styles and page chrome and decodes entities", () => {
    expect(chunking.stripHtml("<nav>Menu</nav><script>x()</script><style>p{}</style><p>Tom &amp; Jerry\n   ran.</p><footer>©</footer><aside>Ad</aside>"))
      .toBe("Tom & Jerry ran.");
  });

  it("leaves plain text paragraphs alone", () => {
    expect(chunking.stripHtml("Will Larson (@Lethain) · 2026-11-22\n\nIt took a while.  \nNo silver bullets."))
      .toBe("Will Larson (@Lethain) · 2026-11-22\n\nIt took a while.\nNo silver bullets.");
  });
});

describe("chunkHtml keeps embedding bounds", () => {
  const sentence = (n: number) => `Sentence number ${n} explains one more bottleneck in the delivery pipeline.`;

  it("splits a long paragraph between short blocks within the chunk size", () => {
    const long = Array.from({ length: 60 }, (_, n) => sentence(n)).join(" ");
    const chunks = chunking.chunkHtml(`<p>Short opener.</p><p>${long}</p><p>Short closer.</p>`);

    expect(chunks.length).toBeGreaterThan(4);
    for (const chunk of chunks) expect(chunk.size).toBeLessThanOrEqual(800);
    const joined = chunks.map((chunk) => chunk.content).join(" ");
    for (let n = 0; n < 60; n++) expect(joined).toContain(`Sentence number ${n} `);
    expect(joined).toContain("Short opener.");
    expect(joined).toContain("Short closer.");
  });

  it("splits a long run without sentence endings by words", () => {
    const words = Array.from({ length: 900 }, (_, n) => `word${n}`).join(" ");
    const chunks = chunking.chunkHtml(`<p>Intro.</p><p>${words}</p>`);

    for (const chunk of chunks) expect(chunk.size).toBeLessThanOrEqual(800);
    expect(chunks.map((chunk) => chunk.content).join(" ")).toContain("word899");
  });
});
