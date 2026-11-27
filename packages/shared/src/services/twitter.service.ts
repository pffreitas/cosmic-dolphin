import * as cheerio from "cheerio";
import { HttpClient } from "./http-client";
import { BrowserExtractionProvider } from "./extraction-providers";
import { ExtractionContext, ContentExtractionError } from "./content-extraction";
import { LightpandaPageProvider } from "./lightpanda.service";
import { eligibleLinks, LinkedArticleReader, readLinkedSource } from "./linked-source";
import { ScrapedUrlContents } from "../types";

export class TwitterScrapingError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TwitterScrapingError";
  }
}

// FxTwitter API v2 thread response types
interface FxTwitterAuthor {
  name?: string;
  screen_name?: string;
}

interface FxTwitterPhoto {
  type: "photo" | "gif";
  url: string;
  altText?: string;
}

interface FxTwitterVideo {
  type: "video" | "gif";
  url: string;
  thumbnail_url?: string;
}

interface FxTwitterFacet {
  type: string;
  original?: string;
  replacement?: string;
}

interface FxTwitterStatus {
  type?: string;
  id?: string;
  text?: string;
  raw_text?: { text?: string; facets?: FxTwitterFacet[] };
  author?: FxTwitterAuthor;
  created_at?: string;
  created_timestamp?: number;
  media?: { photos?: FxTwitterPhoto[]; videos?: FxTwitterVideo[] };
  quote?: FxTwitterStatus | null;
}

interface FxTwitterResponse {
  code: number;
  status?: FxTwitterStatus | null;
  thread?: Array<FxTwitterStatus> | null;
}

interface OEmbedResponse {
  author_name?: string;
  author_url?: string;
  html?: string;
  provider_name?: string;
}

/** One post as stored: expanded text without media links, its photos and its links. */
interface XPost {
  id?: string;
  name?: string;
  handle: string;
  date?: string;
  text: string;
  photos: Array<{ url: string; alt: string }>;
  thumbnails: Array<{ url: string; alt: string }>;
  links: string[];
}

type ExtractedPost = Omit<ScrapedUrlContents, "id" | "createdAt" | "updatedAt" | "bookmarkId">;

const X_SITE_NAME = "X (formerly Twitter)";
const SHORT_OR_MEDIA_LINK = /(?:https?:\/\/)?(?:t\.co\/\w+|pic\.(?:x|twitter)\.com\/\w+)/g;

/** Expanded post text: t.co links replaced by their destinations, media links dropped. */
function expandText(status: FxTwitterStatus): { text: string; links: string[] } {
  const facets = status.raw_text?.facets ?? [];
  let text = status.raw_text?.text ?? status.text ?? "";
  const links: string[] = [];
  for (const facet of facets) {
    if (!facet.original) continue;
    if (facet.type === "url" && facet.replacement) {
      text = text.split(facet.original).join(facet.replacement);
      links.push(facet.replacement);
    } else if (facet.type === "media") {
      text = text.split(facet.original).join("");
    }
  }
  const cleaned = text
    .replace(SHORT_OR_MEDIA_LINK, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: cleaned, links };
}

/** `null` for an unavailable post: no author, or nothing to show. */
function parsePost(status: FxTwitterStatus | null | undefined): XPost | null {
  const handle = status?.author?.screen_name;
  if (!status || !handle || (status.type && status.type !== "status")) return null;
  const { text, links } = expandText(status);
  const photos = (status.media?.photos ?? []).map((photo) => ({
    url: photo.url,
    alt: photo.altText ?? (photo.type === "gif" ? "Tweet GIF" : "Tweet image"),
  }));
  const thumbnails = (status.media?.videos ?? [])
    .filter((video) => video.thumbnail_url)
    .map((video) => ({ url: video.thumbnail_url!, alt: "Tweet video thumbnail" }));
  if (!text && photos.length === 0 && thumbnails.length === 0) return null;
  const date = status.created_timestamp
    ? new Date(status.created_timestamp * 1000).toISOString().slice(0, 10)
    : status.created_at;
  return { id: status.id, name: status.author?.name, handle, date, text, photos, thumbnails, links };
}

const byline = (post: XPost) =>
  `${post.name ? `${post.name} (@${post.handle})` : `@${post.handle}`}${post.date ? ` · ${post.date}` : ""}`;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Plain text for an X row without `linked`: one block per post, the quote after its post. */
function plainContent(posts: Array<{ post: XPost; quoting: boolean }>): string {
  return posts
    .map(({ post, quoting }) => [`${quoting ? "Quoting " : ""}${byline(post)}`, post.text].filter(Boolean).join("\n\n"))
    .join("\n\n");
}

/** §8.4: each escaped post in a top-level blockquote, header first, then its paragraphs. */
function postBlockquote(post: XPost, quoting: boolean): string {
  const header = `<p>${quoting ? "Quoting " : ""}<strong>${escapeHtml(post.name ?? post.handle)}</strong> @${escapeHtml(post.handle)}${post.date ? ` · <time>${escapeHtml(post.date)}</time>` : ""}</p>`;
  const paragraphs = post.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`);
  return ["<blockquote>", header, ...paragraphs, "</blockquote>"].join("\n");
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Words of stored HTML, counting adjacent elements as separate words. */
function htmlWordCount($: cheerio.CheerioAPI): number {
  return countWords(
    $.root().find("*").addBack().contents()
      .filter((_, node) => node.type === "text")
      .map((_, node) => $(node).text())
      .get()
      .join(" "),
  );
}

/**
 * The post-only body of a linked X row: the stored posts without the article,
 * with their links and public reading counts. Used when the linked page turns
 * out to be a paywall, consent or error page.
 */
export function xPostOnlyContent(content: string): { content: string; links: Array<{ url: string; text: string }>; wordCount: number; readingTime: number } {
  const $ = cheerio.load(content, null, false);
  $.root().children("article").remove();
  const body = $.html().trim();
  const links = $("a[href]").map((_, link) => ({ url: $(link).attr("href") ?? "", text: $(link).text() })).get();
  const wordCount = htmlWordCount($);
  return { content: body, links, wordCount, readingTime: Math.max(1, Math.ceil(wordCount / 200)) };
}

export interface TwitterService {
  isTwitterUrl(url: string): boolean;
  scrape(
    url: string, context?: ExtractionContext
  ): Promise<ExtractedPost>;
}

export class TwitterServiceImpl implements TwitterService {
  constructor(
    private httpClient: HttpClient,
    private browserProvider: BrowserExtractionProvider = new LightpandaPageProvider(),
    /** Direct HTML extraction for the one eligible link. Absent, posts are never followed. */
    private readArticle?: LinkedArticleReader,
  ) {}

  isTwitterUrl(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return (
        hostname === "twitter.com" ||
        hostname === "x.com" ||
        hostname === "www.twitter.com" ||
        hostname === "www.x.com"
      );
    } catch {
      return false;
    }
  }

  async scrape(
    url: string, context?: ExtractionContext
  ): Promise<ExtractedPost> {
    const signal = context?.signal;
    try {
      return await this.scrapeViaFxTwitter(url, context);
    } catch (primaryError) {
      // A cancelled run stops here; the fallbacks would only spend its time.
      if (signal?.aborted) throw primaryError;
      console.warn(
        `[TwitterService] fxTwitter failed for ${url}, trying oEmbed fallback:`,
        primaryError instanceof Error ? primaryError.message : primaryError
      );
      try {
        return await this.scrapeViaOEmbed(url, signal);
      } catch (secondaryError) {
        console.warn(
          `[TwitterService] oEmbed failed for ${url}, trying OG fallback:`,
          secondaryError instanceof Error ? secondaryError.message : secondaryError
        );
        try {
          if (!context?.metadataOnly && this.extractStatusId(url)) {
            try {
              return await (signal
                ? this.browserProvider.extractTweet(url, { signal })
                : this.browserProvider.extractTweet(url));
            } catch (browserError) {
              if (browserError instanceof ContentExtractionError && !browserError.shouldRetry) throw browserError;
            }
          }
          return await this.scrapeViaOgFallback(url, signal);
        } catch (fallbackError) {
          if (fallbackError instanceof ContentExtractionError) throw fallbackError;
          throw new TwitterScrapingError(
            `Unable to scrape tweet — fxTwitter API, oEmbed, browser, and OG fallback all failed. The tweet may be private or deleted.`,
            url,
            fallbackError
          );
        }
      }
    }
  }

  private extractStatusId(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private async scrapeViaFxTwitter(
    url: string,
    context?: ExtractionContext
  ): Promise<ExtractedPost> {
    const signal = context?.signal;
    const statusId = this.extractStatusId(url);
    if (!statusId) {
      throw new Error("Could not extract tweet ID from URL");
    }

    const apiUrl = `https://api.fxtwitter.com/2/thread/${statusId}`;
    const response = await this.httpClient.fetch(apiUrl, ...(signal ? [{ signal }] as const : []));

    if (!response.ok) {
      throw new Error(`fxTwitter returned ${response.status}: ${response.statusText}`);
    }

    const data: FxTwitterResponse = JSON.parse(response.body);
    if (!data.status?.author?.screen_name) {
      throw new Error("fxTwitter response missing user data — tweet may be private or deleted");
    }
    const focal = parsePost(data.status);
    if (!focal) throw new Error("fxTwitter returned no post content");

    // The thread repeats the focal post; keep the author's order and show it once.
    const thread = (data.thread ?? []).map(parsePost).filter((post): post is XPost => post !== null);
    const posts = thread.some((post) => post.id && post.id === focal.id)
      ? thread.map((post) => (post.id === focal.id ? focal : post))
      : [focal, ...thread.filter((post) => post.text !== focal.text)];
    const quote = parsePost(data.status.quote);
    const ordered = posts.flatMap((post) => [
      { post, quoting: false },
      ...(post === focal && quote ? [{ post: quote, quoting: true }] : []),
    ]);

    const title = `Tweet by ${focal.name ?? focal.handle} (@${focal.handle})`;
    const authorLinks = posts.flatMap((post) => post.links);
    // Only the posts' own media: never the linked article's images (§8.2).
    const media = [focal, ...posts.filter((post) => post !== focal), ...(quote ? [quote] : [])];
    const images = media.flatMap((post) => [...post.photos, ...post.thumbnails]);
    const photo = media.flatMap((post) => post.photos)[0];
    const candidates = eligibleLinks(authorLinks);
    const follow = candidates.length === 1 && this.readArticle && !context?.metadataOnly
      ? await readLinkedSource(candidates[0], this.readArticle, signal)
      : undefined;

    const postLinks = [...new Set([...authorLinks, ...(quote?.links ?? [])])].map((link) => ({ url: link, text: link }));
    let content: string;
    let links = postLinks;
    if (follow) {
      const blocks = ordered.map(({ post, quoting }) => postBlockquote(post, quoting));
      if (follow.article) {
        blocks.push(`<article>\n${follow.article.content}\n</article>`);
        links = [...postLinks, ...(follow.article.links ?? [])];
      }
      content = blocks.join("\n");
    } else {
      content = plainContent(ordered);
    }
    const wordCount = follow ? htmlWordCount(cheerio.load(content, null, false)) : countWords(content);
    return {
      title,
      content,
      images,
      links,
      metadata: {
        openGraph: {
          title,
          description: focal.text,
          url,
          site_name: X_SITE_NAME,
          ...(photo ? { image: photo.url } : {}),
        },
        wordCount,
        readingTime: Math.max(1, Math.ceil(wordCount / 200)),
        extraction: {
          status: "complete",
          provider: "fxtwitter",
          fetchedAt: new Date().toISOString(),
          ...(follow ? { linked: follow.linked } : {}),
        },
      },
    };
  }

  private async scrapeViaOEmbed(
    url: string,
    signal?: AbortSignal
  ): Promise<ExtractedPost> {
    const statusId = this.extractStatusId(url);
    if (!statusId) {
      throw new Error("Could not extract tweet ID from URL for oEmbed");
    }

    const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
    const response = await this.httpClient.fetch(oEmbedUrl, ...(signal ? [{ signal }] as const : []));

    if (!response.ok) {
      throw new Error(`oEmbed returned ${response.status}`);
    }

    const data: OEmbedResponse = JSON.parse(response.body);

    if (!data.author_name) {
      throw new Error("oEmbed response missing author data");
    }

    // Extract tweet text from the blockquote HTML
    const $ = cheerio.load(data.html ?? "");
    const tweetText = $("blockquote p").first().text().replace(SHORT_OR_MEDIA_LINK, "").replace(/[ \t]+/g, " ").trim();
    const dateText = $("blockquote a").last().text().trim();
    if (!tweetText) throw new Error("oEmbed returned no post text");

    const title = `Tweet by ${data.author_name}`;
    const content = [
      `${data.author_name}${dateText ? ` · ${dateText}` : ""}`,
      "",
      tweetText,
    ].join("\n");

    return {
      title,
      content,
      images: [],
      links: [],
      metadata: {
        openGraph: {
          title,
          description: tweetText,
          url,
          site_name: X_SITE_NAME,
        },
        wordCount: countWords(content),
        readingTime: 1,
        extraction: { status: "complete", provider: "oembed", fetchedAt: new Date().toISOString() },
      },
    };
  }

  private async scrapeViaOgFallback(
    url: string,
    signal?: AbortSignal
  ): Promise<ExtractedPost> {
    const response = await this.httpClient.fetch(url, ...(signal ? [{ signal }] as const : []));

    if (!response.ok) {
      throw new Error(`OG fetch returned ${response.status}`);
    }

    const $ = cheerio.load(response.body);

    const ogTitle =
      $('meta[property="og:title"]').attr("content") ??
      $("title").first().text().trim() ??
      "Tweet";
    const ogDescription =
      $('meta[property="og:description"]').attr("content") ?? "";
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (!ogDescription.trim() || /^(?:x|twitter|log in|sign in|just a moment)$/i.test(ogTitle.trim()))
      throw new Error("X metadata did not contain readable post content");

    const images = ogImage ? [{ url: ogImage, alt: "Tweet preview" }] : [];

    return {
      title: ogTitle,
      content: [ogTitle, "", ogDescription].join("\n"),
      images,
      links: [],
      metadata: {
        openGraph: {
          title: ogTitle,
          description: ogDescription,
          image: ogImage,
          url,
          site_name: X_SITE_NAME,
        },
        wordCount: countWords(ogDescription),
        readingTime: 1,
        extraction: { status: "complete", provider: "opengraph", fetchedAt: new Date().toISOString() },
      },
    };
  }
}
