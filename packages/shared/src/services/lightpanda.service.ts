import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { Browser, Page } from "puppeteer-core";
import { ContentExtractionError, ExtractedContent } from "./content-extraction";
import {
  BrowserExtractionProvider,
  BrowserVideoPage,
  RenderedPage,
} from "./extraction-providers";

// Share a single slot across all service instances. Queue deliveries have a
// five-minute lease; a waiting browser request must not wait indefinitely.
let tail: Promise<void> = Promise.resolve();

async function browserSlot<T>(work: () => Promise<T>): Promise<T> {
  const previous = tail;
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  tail = previous.then(() => current);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      previous,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ContentExtractionError(
                "Browser capacity timeout",
                "provider",
                true,
              ),
            ),
          45_000,
        );
      }),
    ]);
    return await work();
  } finally {
    clearTimeout(timer);
    release();
  }
}

function browserError(message: string): ContentExtractionError {
  return new ContentExtractionError(message, "provider", true);
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

/** A fresh, bounded browser process per saved link, with no shared cookies. */
export class LightpandaPageProvider implements BrowserExtractionProvider {
  constructor(
    private binary = process.env.LIGHTPANDA_BINARY_PATH || "lightpanda",
  ) {}

  private async withPage<T>(
    url: string,
    ready: string,
    work: (page: Page) => Promise<T>,
    obeyRobots = true,
  ): Promise<T> {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new ContentExtractionError(
        "Unsupported browser URL",
        "unsupported",
        false,
      );
    return browserSlot(async () => {
      const port = await unusedPort();
      const child = spawn(
        this.binary,
        [
          "serve",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--block-private-networks",
          ...(obeyRobots ? ["--obey-robots"] : []),
          "--disable-metrics",
          "--v8-max-heap-mb",
          "96",
          "--watchdog-ms",
          "5000",
          "--http-max-response-size",
          "8388608",
          "--http-timeout",
          "8000",
          "--http-max-concurrent",
          "12",
          "--log-level",
          "error",
        ],
        {
          // Browser children need no database, AI or provider credentials.
          env: {
            PATH: process.env.PATH,
            LIGHTPANDA_DISABLE_TELEMETRY: "true",
            LIGHTPANDA_DISABLE_CORE_DUMP: "true",
          },
          stdio: "ignore",
        },
      );
      let exited = false;
      child.once("error", () => {
        exited = true;
      });
      const exit = new Promise<void>((resolve) =>
        child.once("close", () => {
          exited = true;
          resolve();
        }),
      );
      let browser: Browser | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          (async () => {
            for (let attempt = 0; attempt < 60; attempt++) {
              if (exited) throw browserError("Lightpanda could not start");
              try {
                const response = await fetch(
                  `http://127.0.0.1:${port}/json/version`,
                  { signal: AbortSignal.timeout(200) },
                );
                if (response.ok) break;
              } catch {
                /* Wait for the local CDP listener. */
              }
              await delay(50);
            }
            if (exited) throw browserError("Lightpanda could not start");
            // Lazy loading keeps URL-card previews independent of CDP clients.
            const puppeteer = await import("puppeteer-core");
            browser = await puppeteer.default.connect({
              browserWSEndpoint: `ws://127.0.0.1:${port}`,
              protocolTimeout: 10_000,
            });
            const context = await browser.createBrowserContext();
            const page = await context.newPage();
            const response = await page.goto(url, {
              waitUntil: "domcontentloaded",
              timeout: 12_000,
            });
            const status = response?.status() || 0;
            if (status >= 400) {
              throw new ContentExtractionError(
                `Browser page returned HTTP ${status}`,
                status === 401
                  ? "auth"
                  : [400, 404, 410].includes(status)
                    ? "unavailable"
                    : "blocked",
                ![400, 401, 404, 410].includes(status),
              );
            }
            const contentType = response?.headers()["content-type"] || "";
            if (
              contentType &&
              !/text\/html|application\/xhtml\+xml/i.test(contentType)
            )
              throw new ContentExtractionError(
                "Unsupported browser content type",
                "unsupported",
                false,
              );
            const final = new URL(page.url());
            if (
              /\/(?:login|signin|sign-in|i\/flow\/login)(?:\/|$)/i.test(
                final.pathname,
              ) ||
              /^(?:accounts\.google\.com|login\.microsoftonline\.com)$/.test(
                final.hostname,
              )
            )
              throw new ContentExtractionError(
                "Browser redirected to authentication",
                "auth",
                false,
              );
            // A persistent analytics connection must not prevent extraction.
            await page
              .waitForFunction(ready, { timeout: 6_000, polling: 200 })
              .catch(() => undefined);
            // JavaScript may navigate after DOMContentLoaded. Check again
            // before accepting any domain-specific browser output.
            const settled = new URL(page.url());
            if (
              /\/(?:login|signin|sign-in|i\/flow\/login)(?:\/|$)/i.test(
                settled.pathname,
              ) ||
              /^(?:accounts\.google\.com|login\.microsoftonline\.com)$/.test(
                settled.hostname,
              )
            )
              throw new ContentExtractionError(
                "Browser redirected to authentication",
                "auth",
                false,
              );
            const state = (await page.evaluate(
              `(() => ({heading:(document.querySelector('h1')?.innerText || document.title || '').trim(),text:(document.body?.innerText || '').trim(),password:!!document.querySelector('input[type="password"]')}))()`,
            )) as { heading: string; text: string; password: boolean };
            if (
              /^(just a moment|attention required|access denied|verify (?:you are|you're) human|security check|checking your browser)[.!…\s]*$/i.test(
                state.heading,
              )
            )
              throw new ContentExtractionError(
                "Browser returned a bot challenge",
                "blocked",
                true,
              );
            if (
              state.text.split(/\s+/).length < 100 &&
              (state.password ||
                /^(?:log[ -]?in|sign[ -]?in|authentication required)(?:\b|$)/i.test(
                  state.heading,
                ))
            )
              throw new ContentExtractionError(
                "Browser page requires authentication",
                "auth",
                false,
              );
            return await work(page);
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              child.kill("SIGKILL");
              reject(browserError("Browser extraction timed out"));
            }, 30_000);
          }),
        ]);
      } catch (error) {
        if (error instanceof ContentExtractionError) throw error;
        throw browserError("Lightpanda extraction failed");
      } finally {
        clearTimeout(timer);
        // Killing first also unblocks a stalled CDP command or infinite script.
        child.kill("SIGKILL");
        await browser?.disconnect().catch(() => undefined);
        await exit;
      }
    });
  }

  extract(url: string): Promise<RenderedPage> {
    return this.withPage(
      url,
      `(() => { const node = document.querySelector('article, main, [role="main"]') || document.body; return node && node.innerText.trim().split(/\\s+/).length > 30; })()`,
      async (page) => ({
        html: await page.content(),
        finalUrl: page.url(),
        title: await page.title(),
        provider: "lightpanda",
      }),
    );
  }

  extractYouTube(url: string): Promise<BrowserVideoPage> {
    return this.withPage(
      url,
      `!!(window.ytInitialPlayerResponse || document.querySelector('#movie_player')?.getPlayerResponse?.())`,
      async (page) => {
        return (await page.evaluate(`(async () => {
        const player = document.querySelector('#movie_player');
        const data = player?.getPlayerResponse?.() || window.ytInitialPlayerResponse || {};
        const details = data.videoDetails || {};
        const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        const score = t => (/^en(?:-|$)/.test(t.languageCode || '') ? 0 : 2) + (t.kind === 'asr' ? 1 : 0);
        const captions = [];
        for (const track of [...tracks].sort((a,b) => score(a)-score(b)).slice(0,4)) {
          try {
            const target = new URL(track.baseUrl);
            if (target.protocol !== 'https:' || !(target.hostname === 'youtube.com' || target.hostname.endsWith('.youtube.com')) || target.username || target.password || target.port) continue;
            const response = await fetch(target.href, { signal: AbortSignal.timeout(4000) });
            if (!response.ok) continue;
            const body = await response.text();
            if (body.trim()) captions.push({ body, language: track.languageCode });
          } catch {}
        }
        return { title: details.title, author: details.author,
          channelUrl: details.channelId ? 'https://www.youtube.com/channel/' + encodeURIComponent(details.channelId) : undefined,
          thumbnail: details.thumbnail?.thumbnails?.slice(-1)[0]?.url, captions };
      })()`)) as BrowserVideoPage;
      },
      false,
    );
  }

  async extractTweet(url: string): Promise<ExtractedContent> {
    const statusId = new URL(url).pathname.match(
      /\/status\/(\d+)(?:\/|$)/,
    )?.[1];
    if (!statusId)
      throw new ContentExtractionError(
        "Unsupported X post URL",
        "unsupported",
        false,
      );
    // X serves both its legacy client DOM and newer server-rendered markup.
    // Match the outer post's first timestamp permalink before reading its body.
    const findTweet = `Array.from(document.querySelectorAll('article')).find(a => {
      const link = Array.from(a.querySelectorAll('a[href]')).find(l =>
        l.closest('article') === a && !l.closest('[data-testid="quoteTweet"]') &&
        (l.querySelector('time') || l.hasAttribute('data-base-ui-tooltip-trigger') || l.getAttribute('aria-current') === 'page') &&
        /\\/status\\/\\d+(?:\\/|$)/.test(new URL(l.href, location.href).pathname));
      return link && new RegExp('/status/' + ${JSON.stringify(statusId)} + '(?:/|$)').test(new URL(link.href, location.href).pathname);
    })`;
    const textSelector =
      '[data-testid="tweetText"], [dir="auto"].whitespace-pre-wrap';
    return this.withPage(
      url,
      `!!(${findTweet})?.querySelector(${JSON.stringify(textSelector)})?.innerText?.trim()`,
      async (page) => {
        const data = (await page.evaluate(`(() => {
        const article = ${findTweet};
        if (!article) return null;
        const textNode = Array.from(article.querySelectorAll(${JSON.stringify(textSelector)})).find(n => !n.closest('[data-testid="quoteTweet"]'));
        const text = textNode?.innerText?.trim() || '';
        const permalink = Array.from(article.querySelectorAll('a[href]')).find(a => new RegExp('/status/' + ${JSON.stringify(statusId)} + '$').test(new URL(a.href, location.href).pathname));
        const handle = permalink ? new URL(permalink.href, location.href).pathname.split('/')[1] : '';
        const profile = Array.from(article.querySelectorAll('a[href]')).find(a => new URL(a.href, location.href).pathname === '/' + handle && a.innerText.trim());
        const author = article.querySelector('[data-testid="User-Name"]')?.innerText?.trim() || (profile ? profile.innerText.trim() + ' (@' + handle + ')' : handle);
        const date = article.querySelector('time')?.getAttribute('datetime') || permalink?.innerText?.trim() || '';
        const images = Array.from(article.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media/"], video[poster]')).filter(i => !i.closest('[data-testid="quoteTweet"]')).map(i => ({url:i.src || i.getAttribute('poster'),alt:i.alt || 'Post media'}));
        const links = Array.from(textNode?.querySelectorAll('a[href]') || []).map(a => ({url:a.href,text:a.innerText}));
        return { text, author, date, images, links };
      })()`)) as {
          text: string;
          author: string;
          date: string;
          images: Array<{ url: string; alt: string }>;
          links: Array<{ url: string; text: string }>;
        } | null;
        if (!data?.text)
          throw new ContentExtractionError(
            "X post did not return readable text",
            "empty",
            true,
          );
        const safe = (value: string) => {
          try {
            return new URL(value).protocol === "https:";
          } catch {
            return false;
          }
        };
        const title = `Post by ${data.author.replace(/\s+/g, " ") || "X user"}`;
        const wordCount = data.text.split(/\s+/).length;
        return {
          title,
          content: [
            data.author,
            data.date,
            "",
            data.text,
            "",
            `Source: ${url}`,
          ].join("\n"),
          images: data.images.filter((i) => safe(i.url)),
          links: data.links.filter((l) => safe(l.url)),
          metadata: {
            openGraph: {
              title,
              description: data.text,
              url,
              site_name: "X (formerly Twitter)",
            },
            wordCount,
            readingTime: Math.ceil(wordCount / 200),
            extraction: {
              status: "complete",
              provider: "lightpanda",
              fetchedAt: new Date().toISOString(),
            },
          },
        };
      },
      false,
    );
  }
}
