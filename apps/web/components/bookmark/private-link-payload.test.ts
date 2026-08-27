import { describe, expect, it } from "vitest";
import { buildPrivateLinkCapture } from "./private-link-payload";

describe("buildPrivateLinkCapture", () => {
  it("builds a private-link capture from the URL and the user's note alone", () => {
    const request = buildPrivateLinkCapture({
      url: "https://figma.com/file/private-design",
      description: "  Design review for checkout polish  ",
    });

    expect(request).toEqual({
      url: "https://figma.com/file/private-design",
      description: "Design review for checkout polish",
      isPrivateLink: true,
    });
    expect(request).not.toHaveProperty("title");
    expect(request).not.toHaveProperty("preview");
  });

  it("uses a preview's title when one happened to arrive", () => {
    const preview = {
      scrapable: false,
      metadata: {
        title: "Checkout design",
        url: "https://figma.com/file/private-design",
      },
    };

    const request = buildPrivateLinkCapture({
      url: "https://figma.com/file/private-design",
      preview,
      description: "Design review for checkout polish",
    });

    expect(request).toEqual({
      url: "https://figma.com/file/private-design",
      title: "Checkout design",
      description: "Design review for checkout polish",
      isPrivateLink: true,
      preview,
    });
  });

  it("ignores a preview that came back without a title", () => {
    const request = buildPrivateLinkCapture({
      url: "https://figma.com/file/private-design",
      preview: {
        scrapable: false,
        metadata: { url: "https://figma.com/file/private-design" },
      },
      description: "Design review",
    });

    expect(request).not.toHaveProperty("title");
  });
});
