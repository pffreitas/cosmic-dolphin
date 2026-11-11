import { describe, expect, it, jest } from "@jest/globals";
import { BookmarkServiceImpl } from "../../services/bookmark.service";
import { BookmarkRepositoryImpl } from "../../repositories/bookmark.repository";
import { WebScrapingServiceImpl } from "../../services/web-scraping.service";
import { getTestDatabase } from "../../test-utils/database";
import { TestDataFactory } from "../../test-utils/factories";

describe("capture intent survives the pipeline", () => {
  it("legacy source omission stays SQL NULL independently of scraped metadata", async () => {
    const service = new BookmarkServiceImpl(new BookmarkRepositoryImpl(getTestDatabase()), new WebScrapingServiceImpl());
    const saved = await service.create("https://example.com/legacy", crypto.randomUUID());
    expect(saved).toMatchObject({ captureSource: null, capturePlatform: "unknown", captureQueuedAt: null, userNote: null, laterUntil: null });
    const row = await getTestDatabase().selectFrom("bookmarks").select(["capture_source", "capture_platform"]).where("id", "=", saved.id).executeTakeFirst();
    expect(row).toEqual({ capture_source: null, capture_platform: "unknown" });
  });
  it("scrape metadata replacement and a stale worker update do not overwrite new owner note/timing/capture columns", async () => {
    const scraping = new WebScrapingServiceImpl();
    jest.spyOn(scraping, "scrape").mockResolvedValue({ ...TestDataFactory.createScrapedUrlContent(), metadata: { readingTime: 5, openGraph: { title: "Extracted title" } }, content: "Fictional extracted text" } as any);
    const service = new BookmarkServiceImpl(new BookmarkRepositoryImpl(getTestDatabase()), scraping);
    const userId = crypto.randomUUID();
    const queuedAt = new Date(Date.now() - 10000);
    const saved = await service.create("https://example.com/capture", userId, { userNote: "Original note", laterUntil: new Date(Date.now() + 86400000), captureSource: "clipboard", capturePlatform: "ios", captureQueuedAt: queuedAt });
    await service.updateByOwner(saved.id, userId, { userNote: "New note", laterUntil: null });
    await service.ensureScrapedContent(saved);
    await service.update(saved.id, saved);
    const latest = await service.findByIdAndUser(saved.id, userId);
    expect(latest).toMatchObject({ userNote: "New note", laterUntil: null, captureSource: "clipboard", capturePlatform: "ios", captureQueuedAt: queuedAt });
    expect(latest?.metadata?.originalUrl).toBe("https://example.com/capture");
  });
});
