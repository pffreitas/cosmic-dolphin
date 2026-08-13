import { describe, expect, it } from "vitest";
import {
  getActivePhaseLabel,
  shouldPollProcessingTimeline,
} from "./useBookmarkProcessingTimeline";

describe("useBookmarkProcessingTimeline helpers", () => {
  it("polls only while the bookmark is processing", () => {
    expect(shouldPollProcessingTimeline({ processingStatus: "processing" })).toBe(
      true
    );
    expect(shouldPollProcessingTimeline({ processingStatus: "completed" })).toBe(
      false
    );
    expect(shouldPollProcessingTimeline({ processingStatus: "failed" })).toBe(
      false
    );
  });

  it("returns the current business phase label", () => {
    expect(
      getActivePhaseLabel([
        {
          kind: "phase",
          phase: "summarization",
          name: "Summarize content",
          status: "completed",
          sequence: 1,
        },
        {
          kind: "phase",
          phase: "embedding",
          name: "Embed content chunks",
          status: "running",
          sequence: 2,
        },
      ])
    ).toBe("Building semantic search");
  });
});
