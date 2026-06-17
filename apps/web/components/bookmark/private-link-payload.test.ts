import { describe, expect, it } from "vitest";
import { buildPrivateLinkCreateRequest } from "./private-link-payload";

describe("buildPrivateLinkCreateRequest", () => {
  it("builds a private-link create request from user context", () => {
    const request = buildPrivateLinkCreateRequest({
      url: "https://figma.com/file/private-design",
      previewData: {
        scrapable: false,
        metadata: {
          title: "Checkout design",
          url: "https://figma.com/file/private-design",
        },
      },
      description: "Design review for checkout polish",
    });

    expect(request).toEqual({
      sourceUrl: "https://figma.com/file/private-design",
      title: "Checkout design",
      description: "Design review for checkout polish",
      isPrivateLink: true,
    });
    expect(request).not.toHaveProperty("quickAccessHint");
  });
});
