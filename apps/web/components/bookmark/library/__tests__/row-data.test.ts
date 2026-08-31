import { describe, expect, it } from "vitest";
import { Bookmark } from "@cosmic-dolphin/api-client";

import { extractDomain, formatSavedAt, toLibraryItem } from "../row-data";

const NOW = new Date("2026-08-27T12:00:00.000Z");

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "b1",
    sourceUrl: "https://www.example.com/some/article",
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
    updatedAt: new Date("2026-08-25T12:00:00.000Z"),
    userId: "u1",
    ...overrides,
  } as Bookmark;
}

describe("formatSavedAt", () => {
  it("reads as a saved time, not a timestamp", () => {
    expect(formatSavedAt(new Date("2026-08-27T11:59:30Z"), NOW)).toBe("just now");
    expect(formatSavedAt(new Date("2026-08-27T11:40:00Z"), NOW)).toBe("20m ago");
    expect(formatSavedAt(new Date("2026-08-27T06:00:00Z"), NOW)).toBe("6h ago");
    expect(formatSavedAt(new Date("2026-08-25T12:00:00Z"), NOW)).toBe("2d ago");
    expect(formatSavedAt(new Date("2026-08-06T12:00:00Z"), NOW)).toBe("3w ago");
    expect(formatSavedAt(new Date("2024-08-27T12:00:00Z"), NOW)).toBe("2y ago");
  });
});

describe("extractDomain", () => {
  it("drops the www and keeps the host", () => {
    expect(extractDomain("https://www.example.com/a/b")).toBe("example.com");
  });

  it("returns nothing for a URL it cannot parse", () => {
    expect(extractDomain("not a url")).toBeUndefined();
  });
});

describe("toLibraryItem", () => {
  it("treats a bookmark with no read_at as unread", () => {
    expect(toLibraryItem(bookmark(), NOW).unread).toBe(true);
    expect(
      toLibraryItem(bookmark({ isRead: true, readAt: NOW }), NOW).unread
    ).toBe(false);
  });

  it("marks a still-filing bookmark so the row can say so", () => {
    // Processing, nothing filed yet: the row reads Inbox with a *filing…*
    // marker — a suggestion in progress, not a move that happened.
    const item = toLibraryItem(
      bookmark({ processingStatus: "processing" }),
      NOW
    );
    expect(item.filing).toBe(true);
    expect(item.collectionPath).toEqual([]);
    expect(item.summaryLoading).toBe(true);
  });

  it("stops claiming to be filing once a collection is set", () => {
    const item = toLibraryItem(
      bookmark({
        processingStatus: "processing",
        collectionId: "c1",
        collectionPath: [{ id: "c1", name: "Design" }],
      }),
      NOW
    );
    expect(item.filing).toBe(false);
    expect(item.collectionPath[0].href).toBe("/my/library?collection_id=c1");
  });

  it("prefers the brief over the Open Graph description", () => {
    const item = toLibraryItem(
      bookmark({
        cosmicBriefSummary: "The brief.",
        metadata: { openGraph: { description: "The og." } },
      }),
      NOW
    );
    expect(item.summary).toBe("The brief.");
  });

  it("never renders an empty title", () => {
    expect(toLibraryItem(bookmark({ title: "   " }), NOW).title).toBe("Untitled");
  });
});
