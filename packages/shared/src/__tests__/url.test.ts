import { describe, it, expect } from "@jest/globals";
import { isTrackingParam, normalizeUrl } from "../url";

describe("normalizeUrl", () => {
  describe("scheme and host", () => {
    it("lowercases the scheme", () => {
      expect(normalizeUrl("HTTPS://every.to/p/agent-memory").url).toBe(
        "https://every.to/p/agent-memory"
      );
    });

    it("lowercases the host", () => {
      expect(normalizeUrl("https://EVERY.TO/p/agent-memory").url).toBe(
        "https://every.to/p/agent-memory"
      );
    });

    it("lowercases a mixed-case subdomain", () => {
      expect(normalizeUrl("https://Blog.Example.COM/post").url).toBe(
        "https://blog.example.com/post"
      );
    });

    it("leaves the path case alone — paths are case-sensitive", () => {
      expect(normalizeUrl("https://example.com/Path/To/Article").url).toBe(
        "https://example.com/Path/To/Article"
      );
    });

    it("leaves query values alone", () => {
      expect(normalizeUrl("https://example.com/s?q=Machine+Learning").url).toBe(
        "https://example.com/s?q=Machine+Learning"
      );
    });

    it("does not strip www — it is a different host to some servers", () => {
      expect(normalizeUrl("https://www.example.com/post").url).toBe(
        "https://www.example.com/post"
      );
    });

    it("drops the default port for the scheme", () => {
      expect(normalizeUrl("https://example.com:443/post").url).toBe(
        "https://example.com/post"
      );
      expect(normalizeUrl("http://example.com:80/post").url).toBe(
        "http://example.com/post"
      );
    });

    it("keeps a non-default port", () => {
      expect(normalizeUrl("https://example.com:8443/post").url).toBe(
        "https://example.com:8443/post"
      );
    });

    it("keeps http as http — it does not upgrade the scheme", () => {
      expect(normalizeUrl("http://example.com/post").url).toBe(
        "http://example.com/post"
      );
    });
  });

  describe("trailing slash", () => {
    it("strips a trailing slash from a path", () => {
      expect(normalizeUrl("https://example.com/post/").url).toBe(
        "https://example.com/post"
      );
    });

    it("strips the root slash so bare and slashed roots are one row", () => {
      expect(normalizeUrl("https://example.com/").url).toBe(
        "https://example.com"
      );
      expect(normalizeUrl("https://example.com").url).toBe(
        "https://example.com"
      );
    });

    it("strips repeated trailing slashes", () => {
      expect(normalizeUrl("https://example.com/post///").url).toBe(
        "https://example.com/post"
      );
    });

    it("strips the trailing slash before the query, not after", () => {
      expect(normalizeUrl("https://example.com/post/?page=2").url).toBe(
        "https://example.com/post?page=2"
      );
    });

    it("does not strip a slash that is inside the path", () => {
      expect(normalizeUrl("https://example.com/a/b/c").url).toBe(
        "https://example.com/a/b/c"
      );
    });
  });

  describe("tracking parameters", () => {
    it("drops every utm_* parameter", () => {
      expect(
        normalizeUrl(
          "https://example.com/post?utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_term=x&utm_content=y"
        ).url
      ).toBe("https://example.com/post");
    });

    it("drops fbclid, gclid, ref and mc_cid", () => {
      expect(normalizeUrl("https://example.com/post?fbclid=abc").url).toBe(
        "https://example.com/post"
      );
      expect(normalizeUrl("https://example.com/post?gclid=abc").url).toBe(
        "https://example.com/post"
      );
      expect(normalizeUrl("https://example.com/post?ref=hn").url).toBe(
        "https://example.com/post"
      );
      expect(normalizeUrl("https://example.com/post?mc_cid=abc").url).toBe(
        "https://example.com/post"
      );
    });

    it("matches tracking parameter names case-insensitively", () => {
      expect(
        normalizeUrl("https://example.com/post?UTM_Source=x&FBCLID=y").url
      ).toBe("https://example.com/post");
    });

    it("keeps parameters the page actually needs", () => {
      expect(
        normalizeUrl("https://example.com/watch?v=abc123&utm_source=twitter").url
      ).toBe("https://example.com/watch?v=abc123");
    });

    it("keeps a parameter that merely starts like a tracking one", () => {
      expect(normalizeUrl("https://example.com/post?reference=42").url).toBe(
        "https://example.com/post?reference=42"
      );
      expect(normalizeUrl("https://example.com/post?utmost=42").url).toBe(
        "https://example.com/post?utmost=42"
      );
    });

    it("drops every occurrence of a repeated tracking parameter", () => {
      expect(
        normalizeUrl("https://example.com/post?ref=a&v=1&ref=b").url
      ).toBe("https://example.com/post?v=1");
    });

    it("leaves the query untouched when nothing is dropped", () => {
      // No re-encoding pass: %20 stays %20 rather than becoming +.
      expect(normalizeUrl("https://example.com/s?q=machine%20learning").url).toBe(
        "https://example.com/s?q=machine%20learning"
      );
    });

    it("preserves the order of the parameters it keeps", () => {
      expect(
        normalizeUrl("https://example.com/p?b=2&utm_source=x&a=1").url
      ).toBe("https://example.com/p?b=2&a=1");
    });
  });

  describe("fragments", () => {
    it("keeps the fragment — it is where the page opens", () => {
      expect(normalizeUrl("https://example.com/post#section-3").url).toBe(
        "https://example.com/post#section-3"
      );
    });

    it("keeps the fragment after dropping tracking parameters", () => {
      expect(
        normalizeUrl("https://example.com/post?utm_source=x#section-3").url
      ).toBe("https://example.com/post#section-3");
    });
  });

  describe("the original paste", () => {
    it("returns the paste verbatim alongside the normalised form", () => {
      const result = normalizeUrl(
        "  HTTPS://Every.to/p/agent-memory/?utm_source=twitter  "
      );
      expect(result.originalUrl).toBe(
        "HTTPS://Every.to/p/agent-memory/?utm_source=twitter"
      );
      expect(result.url).toBe("https://every.to/p/agent-memory");
      expect(result.changed).toBe(true);
    });

    it("reports changed: false when there was nothing to normalise", () => {
      const result = normalizeUrl("https://every.to/p/agent-memory");
      expect(result.url).toBe(result.originalUrl);
      expect(result.changed).toBe(false);
    });

    it("trims surrounding whitespace from a paste", () => {
      expect(normalizeUrl("\n https://example.com/post \t").url).toBe(
        "https://example.com/post"
      );
    });
  });

  describe("dedupe equivalence", () => {
    it("collapses the shapes of one article onto one key", () => {
      const shapes = [
        "https://every.to/p/agent-memory",
        "https://every.to/p/agent-memory/",
        "https://EVERY.to/p/agent-memory/",
        "HTTPS://every.to/p/agent-memory?utm_source=twitter&utm_medium=social",
        "https://every.to/p/agent-memory/?fbclid=IwAR123",
        "https://every.to:443/p/agent-memory?ref=hn",
      ];

      const normalised = new Set(shapes.map((shape) => normalizeUrl(shape).url));
      expect(Array.from(normalised)).toEqual([
        "https://every.to/p/agent-memory",
      ]);
    });

    it("does not collapse genuinely different pages", () => {
      const distinct = [
        "https://example.com/a",
        "https://example.com/b",
        "https://www.example.com/a",
        "http://example.com/a",
        "https://example.com/a?page=2",
        "https://example.com/a#part-2",
      ];

      const normalised = new Set(
        distinct.map((shape) => normalizeUrl(shape).url)
      );
      expect(normalised.size).toBe(distinct.length);
    });
  });

  describe("input it cannot parse", () => {
    // Normalising is not validating. Rejection is the route's job — a
    // normaliser that throws turns a 400 into a 500.
    it.each([
      ["", ""],
      ["not-a-url", "not-a-url"],
      ["example.com/post", "example.com/post"],
      ["  spaced out  ", "spaced out"],
    ])("returns %p untouched", (input, expected) => {
      const result = normalizeUrl(input);
      expect(result.url).toBe(expected);
      expect(result.changed).toBe(false);
    });

    it("leaves non-http(s) schemes alone", () => {
      expect(normalizeUrl("mailto:Someone@Example.com").url).toBe(
        "mailto:Someone@Example.com"
      );
      expect(normalizeUrl("ftp://Example.com/file/").url).toBe(
        "ftp://Example.com/file/"
      );
    });

    it("survives null and undefined without throwing", () => {
      expect(normalizeUrl(undefined as unknown as string).url).toBe("");
      expect(normalizeUrl(null as unknown as string).url).toBe("");
    });
  });

  it("is idempotent", () => {
    const inputs = [
      "HTTPS://Every.to/p/agent-memory/?utm_source=twitter",
      "https://example.com/",
      "https://example.com/watch?v=abc&utm_source=x#t=30",
      "not-a-url",
    ];

    for (const input of inputs) {
      const once = normalizeUrl(input).url;
      expect(normalizeUrl(once).url).toBe(once);
    }
  });
});

describe("isTrackingParam", () => {
  it.each(["utm_source", "utm_medium", "UTM_CAMPAIGN", "fbclid", "gclid", "ref", "mc_cid"])(
    "%s is tracking",
    (name) => {
      expect(isTrackingParam(name)).toBe(true);
    }
  );

  it.each(["q", "v", "page", "reference", "utmost", "mc_eid", "id"])(
    "%s is not tracking",
    (name) => {
      expect(isTrackingParam(name)).toBe(false);
    }
  );
});
