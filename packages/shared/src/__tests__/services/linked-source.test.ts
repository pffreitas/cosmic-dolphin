import {
  assertFollowableUrl,
  eligibleLinks,
  LINKED_READ_BUDGET_MS,
  readLinkedSource,
  RejectedHostError,
} from "../../services/linked-source";
import { ContentExtractionError, ExtractedContent } from "../../services/content-extraction";

const article = (title = "Shipping 100+ PRs"): ExtractedContent => ({
  title,
  content: "<p>Readable article body.</p>",
  images: [],
  links: [],
  metadata: { extraction: { status: "complete", provider: "direct" } },
});

describe("linked source host rules", () => {
  it.each([
    "https://lethain.com/passing-100-prs-in-a-week/",
    "http://news.example.co.uk/a?b=1",
    "https://sub.domain.example:8443/path",
  ])("accepts the public web destination %s", (url) => {
    expect(() => assertFollowableUrl(new URL(url))).not.toThrow();
  });

  it.each([
    "ftp://files.example.com/a",
    "file:///etc/passwd",
    "http://127.0.0.1/admin",
    "http://10.0.0.8/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://[::1]/",
    "http://[fd00::1]:8080/",
    "http://localhost:3000/",
    "http://api.localhost/",
    "http://intranet/",
    "http://metadata./",
    "http://localhost./",
    "http://api.localhost./",
  ])("rejects %s", (url) => {
    expect(() => assertFollowableUrl(new URL(url))).toThrow(RejectedHostError);
  });
});

describe("eligible links", () => {
  it("normalises and deduplicates before counting", () => {
    expect(
      eligibleLinks([
        "https://lethain.com/passing-100-prs-in-a-week/",
        "https://lethain.com/passing-100-prs-in-a-week?utm_source=twitter",
      ]),
    ).toEqual(["https://lethain.com/passing-100-prs-in-a-week"]);
  });

  it("excludes X, t.co, YouTube and PDF links", () => {
    expect(
      eligibleLinks([
        "https://x.com/Lethain/status/1/photo/1",
        "https://twitter.com/a/status/2",
        "https://mobile.twitter.com/a",
        "https://t.co/abc",
        "https://www.youtube.com/watch?v=1",
        "https://youtu.be/1",
        "https://m.youtube.com/watch?v=2",
        "https://arxiv.org/pdf/2401.00001.PDF",
        "https://blog.example.com/post",
      ]),
    ).toEqual(["https://blog.example.com/post"]);
  });

  it("applies the exclusions and deduplication to a host with a trailing dot", () => {
    expect(
      eligibleLinks([
        "https://x.com./a/status/1",
        "https://youtube.com./watch?v=1",
        "https://t.co./abc",
        "https://blog.example.com./post",
        "https://blog.example.com/post",
      ]),
    ).toEqual(["https://blog.example.com/post"]);
  });

  it("keeps several distinct links so the caller makes no follow", () => {
    expect(eligibleLinks(["https://a.example.com/1", "https://b.example.com/2"])).toHaveLength(2);
  });
});

describe("readLinkedSource", () => {
  let info: jest.SpyInstance;
  beforeEach(() => {
    info = jest.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => {
    info.mockRestore();
    jest.useRealTimers();
  });

  it("reads a readable page through the guard and logs one diagnostic without the URL", async () => {
    const reader = jest.fn().mockResolvedValue(article());
    const result = await readLinkedSource("https://lethain.com/passing-100-prs-in-a-week", reader);

    expect(result.linked).toEqual({ url: "https://lethain.com/passing-100-prs-in-a-week", status: "complete", title: "Shipping 100+ PRs" });
    expect(result.article?.content).toBe("<p>Readable article body.</p>");
    const [, options] = reader.mock.calls[0];
    expect(options.quiet).toBe(true);
    expect(() => options.guard(new URL("http://169.254.169.254/latest"))).toThrow(RejectedHostError);
    expect(info).toHaveBeenCalledTimes(1);
    const [message, fields] = info.mock.calls[0];
    expect(message).toBe("Linked source");
    expect(Object.keys(fields).sort()).toEqual(["duration_ms", "host", "provider", "status"]);
    expect(fields).toMatchObject({ host: "lethain.com", status: "complete", provider: "direct" });
    expect(JSON.stringify(fields)).not.toContain("passing-100");
  });

  it("rejects an invalid destination before any dispatch", async () => {
    const reader = jest.fn();
    const result = await readLinkedSource("http://127.0.0.1:8080/admin", reader);

    expect(reader).not.toHaveBeenCalled();
    expect(result).toEqual({ linked: { url: "http://127.0.0.1:8080/admin", status: "failed", error: "rejected_host" } });
    expect(info.mock.calls[0][1]).toMatchObject({ status: "failed", error_class: "rejected_host" });
  });

  it("records a rejected redirect hop and extraction failures as failed follows", async () => {
    await expect(readLinkedSource("https://a.example.com/x", jest.fn().mockRejectedValue(new RejectedHostError("http://localhost/"))))
      .resolves.toMatchObject({ linked: { status: "failed", error: "rejected_host" } });
    await expect(readLinkedSource("https://a.example.com/x", jest.fn().mockRejectedValue(new ContentExtractionError("JS shell", "empty", true))))
      .resolves.toMatchObject({ linked: { status: "failed", error: "empty" } });
    await expect(readLinkedSource("https://a.example.com/x", jest.fn().mockRejectedValue(new Error("socket hang up"))))
      .resolves.toMatchObject({ linked: { status: "failed", error: "provider" } });
  });

  it("stops a slow read at the 60 second budget", async () => {
    jest.useFakeTimers();
    let readerSignal: AbortSignal | undefined;
    const reader = jest.fn((_url: string, options: { signal: AbortSignal }) => {
      readerSignal = options.signal;
      return new Promise<ExtractedContent>(() => undefined);
    });
    let settled = false;
    const pending = readLinkedSource("https://slow.example.com/a", reader).then((result) => {
      settled = true;
      return result;
    });

    await jest.advanceTimersByTimeAsync(LINKED_READ_BUDGET_MS - 1);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ linked: { url: "https://slow.example.com/a", status: "failed", error: "timeout" } });
    expect(LINKED_READ_BUDGET_MS).toBe(60_000);
    expect(readerSignal?.aborted).toBe(true);
  });

  it("propagates run cancellation during the read", async () => {
    const run = new AbortController();
    const reader = jest.fn((_url: string, options: { signal: AbortSignal }) => new Promise<ExtractedContent>((_, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const pending = readLinkedSource("https://a.example.com/x", reader, run.signal);
    run.abort();

    await expect(pending).rejects.toThrow();
  });

  it("honours a run cancelled before the follow starts", async () => {
    const run = new AbortController();
    run.abort();
    const reader = jest.fn();

    await expect(readLinkedSource("https://a.example.com/x", reader, run.signal)).rejects.toThrow();
    expect(reader).not.toHaveBeenCalled();
  });
});
