import { Bookmark } from "@cosmic-dolphin/api-client";
import { describe, expect, it } from "vitest";

import { detailState, toDetailModel } from "../detail-data";

const NOW = new Date("2026-08-27T12:00:00Z");

function bookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "b1",
    userId: "u1",
    sourceUrl: "https://every.to/an-article",
    createdAt: new Date("2026-08-25T12:00:00Z"),
    updatedAt: new Date("2026-08-25T12:00:00Z"),
    title: "An article",
    cosmicBriefSummary: "One paragraph.",
    cosmicKeyPoints: ["First", "Second"],
    cosmicSummary: "# Body",
    collectionPath: [{ id: "c1", name: "Engineering" }],
    ...overrides,
  } as Bookmark;
}

describe("detailState", () => {
  it("prefers failed over private, because failed is the retryable one", () => {
    expect(
      detailState({ processingStatus: "failed", isPrivateLink: true }),
    ).toBe("failed");
  });

  it("prefers private over processing", () => {
    expect(
      detailState({ processingStatus: "processing", isPrivateLink: true }),
    ).toBe("private");
  });

  it("is processing while the pipeline is running, and ready after", () => {
    expect(detailState({ processingStatus: "processing" })).toBe("processing");
    expect(detailState({ processingStatus: "completed" })).toBe("ready");
    expect(detailState({})).toBe("ready");
  });
});

describe("toDetailModel", () => {
  it("takes key points from the stored array, never from the summary markdown", () => {
    const model = toDetailModel(
      bookmark({
        cosmicKeyPoints: ["Memory beats context."],
        cosmicSummary: "- a bullet that is not a key point\n- nor is this",
      }),
      { mode: "owner", now: NOW },
    );

    expect(model.keyPoints).toEqual(["Memory beats context."]);
    expect(model.readerBody).toContain("a bullet that is not a key point");
  });

  it("drops the breadcrumb on the shared route", () => {
    expect(
      toDetailModel(bookmark(), { mode: "owner", now: NOW }).collectionPath,
    ).toHaveLength(1);
    expect(
      toDetailModel(bookmark(), { mode: "shared", now: NOW }).collectionPath,
    ).toEqual([]);
  });

  it("only carries the sharer's name on the shared route", () => {
    const raw = { ...bookmark(), sharedByUserName: "Maya" };
    expect(toDetailModel(raw, { mode: "shared", now: NOW }).sharedByName).toBe(
      "Maya",
    );
    expect(
      toDetailModel(raw, { mode: "owner", now: NOW }).sharedByName,
    ).toBeUndefined();
  });

  it("formats provenance on the server so hydration cannot disagree", () => {
    const model = toDetailModel(
      bookmark({ metadata: { readingTime: 9 } }),
      { mode: "owner", now: NOW },
    );

    expect(model.savedAt).toBe("2d ago");
    expect(model.readingTime).toBe("9 min");
    expect(model.domain).toBe("every.to");
  });

  it("treats read as read whether the flag or the timestamp says so", () => {
    expect(
      toDetailModel(bookmark({ readAt: NOW }), { mode: "owner", now: NOW })
        .isRead,
    ).toBe(true);
    expect(
      toDetailModel(bookmark({ isRead: false, readAt: undefined }), {
        mode: "owner",
        now: NOW,
      }).isRead,
    ).toBe(false);
  });
});
