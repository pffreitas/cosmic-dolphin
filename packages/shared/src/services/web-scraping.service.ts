import {
  OpenGraphMetadata,
  BookmarkMetadata,
  ScrapedUrlContents,
  PreviewMetadata,
} from "../types";
import * as cheerio from "cheerio";
import { HttpClient, CosmicHttpClient, HttpRequestError } from "./http-client";
import { YouTubeService, YouTubeServiceImpl } from "./youtube.service";
import { TwitterService, TwitterServiceImpl } from "./twitter.service";
import {
  ContentExtractionError,
  ExtractionContext,
  ExtractedContent,
} from "./content-extraction";
import {
  FirecrawlPageProvider,
  PageExtractionProvider,
} from "./extraction-providers";

import { LightpandaPageProvider } from "./lightpanda.service";

type LoadedCheerio = ReturnType<typeof cheerio.load>;

export interface WebScrapingService {
  isValidUrl(url: string): boolean;
  scrape(
    url: string,
    context?: ExtractionContext,
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  >;
  scrapeContent(
    url: string,
    content: string,
  ): Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">;
  extractMetadataFromUrl(url: string): PreviewMetadata;
}

export class WebScrapingServiceImpl implements WebScrapingService {
  private youtubeService: YouTubeService;
  private twitterService: TwitterService;

  constructor(
    private httpClient: HttpClient = new CosmicHttpClient(),
    youtubeService?: YouTubeService,
    twitterService?: TwitterService,
    private pageProvider:
      | PageExtractionProvider
      | PageExtractionProvider[]
      | undefined = [
      new LightpandaPageProvider(),
      ...(process.env.FIRECRAWL_API_KEY ? [new FirecrawlPageProvider()] : []),
    ],
  ) {
    this.youtubeService = youtubeService ?? new YouTubeServiceImpl(httpClient);
    this.twitterService = twitterService ?? new TwitterServiceImpl(httpClient);
  }

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  async scrape(
    url: string,
    context?: ExtractionContext,
  ): Promise<
    Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">
  > {
    console.log("Scraping URL:", url);

    if (!this.isValidUrl(url)) {
      throw new ContentExtractionError(
        "Invalid HTTP URL",
        "unsupported",
        false,
      );
    }

    if (this.youtubeService.isYouTubeUrl(url)) {
      console.log("Detected YouTube URL, using YouTube-specific scraping");
      return context
        ? this.youtubeService.scrape(url, context)
        : this.youtubeService.scrape(url);
    }

    if (this.twitterService.isTwitterUrl(url)) {
      console.log("Detected Twitter/X URL, using Twitter-specific scraping");
      return context
        ? this.twitterService.scrape(url, context)
        : this.twitterService.scrape(url);
    }

    try {
      const response = context?.metadataOnly
        ? await this.httpClient.fetch(url, { timeoutMs: 8_000, retryLimit: 0 })
        : await this.httpClient.fetch(url);

      if (!response.ok) {
        throw new HttpRequestError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }

      if (response.redirectUrl) {
        this.detectAuthRedirect(url, response.redirectUrl);
      }

      const contentType = response.headers.get("content-type") || "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new ContentExtractionError(
          `Unsupported content type: ${contentType}`,
          "unsupported",
          false,
        );
      }

      const scrapedUrlContents = this.scrapeContent(
        response.redirectUrl || url,
        response.body,
      );
      this.assertScrapedContentUsable(scrapedUrlContents);
      return this.withProvenance(scrapedUrlContents, "direct");
    } catch (error) {
      // Authentication, missing pages and unsupported files cannot be fixed by
      // rendering. Blocks, empty JS shells and transient transport errors can.
      if (error instanceof ContentExtractionError && !error.shouldRetry)
        throw error;
      if (
        error instanceof HttpRequestError &&
        error.status &&
        [400, 401, 404, 410].includes(error.status)
      ) {
        throw new ContentExtractionError(
          error.message,
          error.status === 401 ? "auth" : "unavailable",
          false,
        );
      }
      if (!this.pageProvider || context?.metadataOnly) {
        if (error instanceof ContentExtractionError) throw error;
        throw new ContentExtractionError(
          error instanceof Error ? error.message : "Page fetch failed",
          "blocked",
          true,
        );
      }
      const providers = Array.isArray(this.pageProvider)
        ? this.pageProvider
        : [this.pageProvider];
      let failure: unknown = error;
      for (const provider of providers) {
        try {
          const rendered = await provider.extract(url);
          if (rendered.finalUrl)
            this.detectAuthRedirect(url, rendered.finalUrl);
          const result = this.scrapeContent(
            rendered.finalUrl || url,
            rendered.html,
          );
          result.title ||= rendered.title || "";
          result.metadata.openGraph!.title ||= rendered.title;
          result.metadata.openGraph!.description ||= rendered.description;
          result.metadata.openGraph!.image ||= rendered.image;
          this.assertScrapedContentUsable(result);
          return this.withProvenance(result, rendered.provider || "rendered");
        } catch (providerError) {
          if (
            providerError instanceof ContentExtractionError &&
            !providerError.shouldRetry
          )
            throw providerError;
          failure = providerError;
        }
      }
      if (failure instanceof ContentExtractionError) throw failure;
      throw new ContentExtractionError(
        "Rendered page extraction failed",
        "provider",
        true,
      );
    }
  }

  private withProvenance(
    content: ExtractedContent,
    provider: string,
  ): ExtractedContent {
    content.metadata.extraction = {
      status: "complete",
      provider,
      fetchedAt: new Date().toISOString(),
    };
    return content;
  }

  private detectAuthRedirect(originalUrl: string, finalUrl: string): void {
    const originalHost = new URL(originalUrl).hostname;
    const finalHost = new URL(finalUrl).hostname;
    const finalPath = new URL(finalUrl).pathname.toLowerCase();

    const authPathPatterns = [
      "/login",
      "/signin",
      "/sign-in",
      "/sign_in",
      "/auth",
      "/oauth",
      "/sso",
      "/accounts/login",
      "/session/new",
      "/cas/login",
      "/saml",
    ];

    const ssoProviders = [
      "login.microsoftonline.com",
      "accounts.google.com",
      "auth0.com",
      "okta.com",
      "onelogin.com",
      "login.salesforce.com",
      "idp.",
    ];

    if (originalHost !== finalHost) {
      const isSsoRedirect = ssoProviders.some((provider) =>
        provider.endsWith(".")
          ? finalHost.startsWith(provider)
          : finalHost === provider || finalHost.endsWith(`.${provider}`),
      );
      if (isSsoRedirect) {
        throw new ContentExtractionError(
          `Auth redirect detected: redirected to SSO provider ${finalHost}`,
          "auth",
          false,
        );
      }
    }

    const isAuthPath = authPathPatterns.some(
      (pattern) => finalPath === pattern || finalPath.startsWith(`${pattern}/`),
    );
    if (isAuthPath) {
      throw new ContentExtractionError(
        `Auth redirect detected: redirected to login page ${finalUrl}`,
        "auth",
        false,
      );
    }
  }

  scrapeContent(
    url: string,
    content: string,
  ): Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId"> {
    const $ = cheerio.load(content);
    $("script").remove();
    $("style").remove();
    $(
      "noscript, template, iframe, object, embed, [hidden], [aria-hidden='true']",
    ).remove();
    $("*").each((_, element) => {
      const node = $(element);
      for (const [name, value] of Object.entries(node.attr() || {})) {
        if (
          /^on/i.test(name) ||
          (/(?:href|src|action)$/i.test(name) && /^\s*javascript:/i.test(value))
        )
          node.removeAttr(name);
      }
    });
    $("a[href], img[src], img[data-src]").each((_, element) => {
      const node = $(element);
      const attribute = element.tagName === "a" ? "href" : "src";
      const resolved = this.resolveResourceUrl(
        node.attr(attribute) || node.attr("data-src"),
        url,
      );
      if (resolved) node.attr(attribute, resolved);
      else node.removeAttr(attribute);
    });
    const metadata = this.extractMetadata(url, $);
    const title = metadata.openGraph?.title || this.extractTitle($);
    // Preserve article headers/figures, but remove site chrome from the reader
    // and from the material used for summaries and embeddings.
    $("nav, footer, [role='navigation'], [role='banner']").remove();
    const candidates = ["article", "main", "[role='main']"].map((selector) =>
      $(selector)
        .filter((_, element) => $(element).text().trim().length >= 80)
        .first(),
    );
    const main = candidates.find((candidate) => candidate.length) || $("body");
    const body = (main.length ? main.html() : $("body").html()) ?? "";
    const wordCount = cheerio
      .load(body)
      .root()
      .text()
      .split(/\s+/)
      .filter(Boolean).length;
    metadata.wordCount = wordCount;
    metadata.readingTime = Math.ceil(wordCount / 200);
    const readable = cheerio.load(body);
    const images = this.extractImages(readable);
    const links = this.extractLinks(readable);
    return { title, content: body, metadata, images, links };
  }

  private assertScrapedContentUsable(
    scrapedContent: Omit<
      ScrapedUrlContents,
      "id" | "createdAt" | "updatedAt" | "bookmarkId"
    >,
  ): void {
    const $ = cheerio.load(scrapedContent.content);
    const bodyText = $.root().text().replace(/\s+/g, " ").trim();
    const bodyWordCount = bodyText
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const heading =
      $("h1").first().text().trim() || scrapedContent.title.trim();
    const challenge =
      /^(just a moment|attention required|access denied|verify (?:you are|you're) human|security check|checking your browser)[.!…\s]*$/i;
    if (
      challenge.test(heading) ||
      (bodyWordCount < 150 &&
        (/^(?:verify (?:that )?you(?:'re| are) (?:a )?human|enable javascript and cookies to continue|checking your browser)/i.test(
          bodyText,
        ) ||
          /(?:id|class)=["'][^"']*cf-chl-/i.test(scrapedContent.content)))
    ) {
      throw new ContentExtractionError(
        "Page returned a bot challenge instead of readable content",
        "blocked",
        true,
      );
    }
    if (
      bodyWordCount < 100 &&
      (/^(log[ -]?in|sign[ -]?in|authentication required|permission denied)(?:\b|$)/i.test(
        heading,
      ) ||
        $("input[type='password']").length > 0)
    ) {
      throw new ContentExtractionError(
        "Scraped content is not usable: page requires authentication",
        "auth",
        false,
      );
    }
    if (
      bodyWordCount <= 1 ||
      (bodyWordCount < 30 &&
        /^(?:loading(?:\s+(?:your|the|this))?(?:\s+(?:article|page|content|post|application))?|please wait|initializing|something went wrong|enable javascript)[.\s…!]*(?:please wait[.\s…!]*)?$/i.test(
          bodyText,
        ))
    ) {
      throw new ContentExtractionError(
        "Scraped content is not usable: page appears empty",
        "empty",
        true,
      );
    }
    if (
      bodyWordCount < 50 &&
      /(?:enable|requires?|need(?:s)?).{0,30}javascript/i.test(bodyText)
    ) {
      throw new ContentExtractionError(
        "Page requires JavaScript rendering to read its content",
        "empty",
        true,
      );
    }
  }

  private extractTitle($: LoadedCheerio): ScrapedUrlContents["title"] {
    return $("h1").text() ?? "";
  }

  private resolveResourceUrl(
    value: string | undefined,
    base: string,
  ): string | undefined {
    if (!value?.trim()) return undefined;
    try {
      const resolved = new URL(value, base);
      return ["http:", "https:"].includes(resolved.protocol)
        ? resolved.href
        : undefined;
    } catch {
      return undefined;
    }
  }

  private extractImages($: LoadedCheerio): ScrapedUrlContents["images"] {
    const images = $("img");
    return images
      .map((_, img) => {
        return {
          url: $(img).attr("src") ?? "",
          alt: $(img).attr("alt") ?? "",
        };
      })
      .get();
  }

  private extractLinks($: LoadedCheerio): ScrapedUrlContents["links"] {
    return $("a")
      .map((_, link) => {
        return {
          url: $(link).attr("href") ?? "",
          text: $(link).text() ?? "",
        };
      })
      .get();
  }

  private extractMetadata(
    sourceUrl: string,
    $: LoadedCheerio,
  ): BookmarkMetadata {
    const ogData = this.extractOpenGraphMetadata(sourceUrl, $);

    const textContent = $.root().text();
    const wordCount = textContent
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    const readingTime = Math.ceil(wordCount / 200);

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $('link[rel="apple-touch-icon"]').attr("href");

    if (favicon && !favicon.startsWith("http")) {
      favicon = this.resolveResourceUrl(favicon, sourceUrl);
    }

    ogData.favicon = favicon;

    return {
      openGraph: ogData,
      wordCount,
      readingTime,
    };
  }

  extractMetadataFromUrl(url: string): PreviewMetadata {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const siteName =
      hostname.split(".")[0].charAt(0).toUpperCase() +
      hostname.split(".")[0].slice(1);

    const pathSegments = urlObj.pathname.split("/").filter(Boolean);
    let title: string | undefined;
    if (pathSegments.length > 0) {
      title = pathSegments
        .map((seg) =>
          seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        )
        .join(" / ");
    }

    return {
      title: title || siteName,
      favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`,
      siteName,
      url,
    };
  }

  private extractOpenGraphMetadata(
    sourceUrl: string,
    $: LoadedCheerio,
  ): OpenGraphMetadata {
    const ogData: OpenGraphMetadata = {};

    $('meta[property^="og:"]').each((_: number, element: any) => {
      const property = $(element).attr("property");
      const content = $(element).attr("content");

      if (property && content) {
        switch (property) {
          case "og:title":
            ogData.title = content;
            break;
          case "og:description":
            ogData.description = content;
            break;
          case "og:image":
            ogData.image = content;
            break;
          case "og:url":
            ogData.url = content;
            break;
          case "og:site_name":
            ogData.site_name = content;
            break;
          case "og:type":
            ogData.type = content;
            break;
          case "og:locale":
            ogData.locale = content;
            break;
          case "og:article:author":
            ogData.article_author = content;
            break;
          case "og:article:published_time":
            ogData.article_published_time = content;
            break;
          case "og:article:modified_time":
            ogData.article_modified_time = content;
            break;
          case "og:article:section":
            ogData.article_section = content;
            break;
          case "og:article:tag":
            if (!ogData.article_tag) ogData.article_tag = [];
            ogData.article_tag.push(content);
            break;
        }
      }
    });

    if (!ogData.title) {
      ogData.title = $("title").first().text().trim() || undefined;
    }

    if (!ogData.description) {
      ogData.description =
        $('meta[name="description"]').attr("content") || undefined;
    }

    if (!ogData.url) {
      ogData.url = sourceUrl;
    }

    return ogData;
  }
}
