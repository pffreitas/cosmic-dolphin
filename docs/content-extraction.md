# Saved-link content extraction

Saving a link creates the bookmark first and puts processing on the existing
`bookmarks` pgmq queue. The API does not wait for scraping or transcription.
URL-card previews use an eight-second request timeout without starting paid
extraction or video jobs.
An HTTP 403, rate limit, bot challenge, or JavaScript shell at preview time stays
eligible for normal background processing. Authentication and permanent failures
can still use the private-link note flow.

## Public pages

The worker tries the existing HTTP client first. Successful HTML is cleaned,
article content is preferred over surrounding navigation, and resource URLs are
resolved against the final page URL. A sign-in link in navigation or a mention
of authentication in an article does not make a page private.

Blocked requests, challenge pages, and empty JavaScript shells fall back to
Lightpanda browser extraction, then Firecrawl when `FIRECRAWL_API_KEY` is configured.
Every provider's HTML is checked again before it is accepted. Login redirects, HTTP 401,
404, 410, and unsupported content types do not trigger a paid request.

## YouTube

Video URLs are parsed by hostname and video ID, including watch, short links,
Shorts, live, music, and privacy-enhanced embeds. Metadata and transcripts are
fetched concurrently. Metadata failure does not discard a recovered transcript.

The transcript ladder is:

1. `youtube-transcript`, with a shared 20-second network budget and a fallback
   to the original language if English is absent or empty.
2. The existing MWEB player fallback, trying up to four caption tracks. English
   and manual captions are preferred; an empty or blocked track does not hide
   the other tracks. Classic XML, srv3 XML, and JSON3 captions are supported.
3. Lightpanda browser recovery of player metadata and up to four caption tracks.
4. Optional Supadata retrieval. `auto` mode first tries captions, then speech
   transcription when necessary. `native` mode limits this to existing captions.

Requests have deadlines. Managed transcription can return a job ID instead of
text. That ID is stored in the content row's metadata, and the next queue
delivery polls the same job, including after a worker restart. A failed or
expired job is cleared so an explicit retry can submit a fresh one. Temporary
polling failures retain the ID.

## Content state and recovery

`scraped_url_contents.metadata.extraction` records `complete`, `pending`, or
`unavailable`, the provider, fetch timestamp, language when known, and an optional
job ID and error. These internal fields are not copied into bookmark metadata.
No schema migration is required; they live in the existing JSONB column.

A video with no transcript saves its card metadata and an empty body. Its fetch
phase fails, and summarization, tagging, and embedding do not run on a
placeholder. A network failure or pending job remains retryable; authentication
and definitive provider failures are terminal for that queue delivery.

pgmq's durable read count bounds retries using `QUEUE_MAX_RETRIES` (default 3
retries after the first attempt). Delivery happens after the existing five-minute
visibility timeout; automatic retries append to the same processing timeline.
After exhaustion the bookmark remains failed and can be reprocessed explicitly.
Long transcription jobs keep their ID so that a later retry can resume them.

Complete content remains cached. Explicit reprocessing automatically re-fetches
partial content and legacy YouTube rows with zero transcript words or the old
"No transcript available for this video." placeholder. Recovery updates the same
content row, keeping its ID stable. Use full reprocessing to regenerate all AI
outputs after recovering a legacy video. There is no automatic bulk backfill.

## Configuration and rollout

Set credentials on the **worker** through its runtime secrets, or in the root
`.env` for local development:

```dotenv
FIRECRAWL_API_KEY=...
SUPADATA_API_KEY=...
YOUTUBE_TRANSCRIPT_MODE=auto
```

Firecrawl and Supadata are disabled when their respective keys are absent. Directly readable pages and
native transcripts avoid provider calls. Use `YOUTUBE_TRANSCRIPT_MODE=native`
to prevent paid speech generation. Configuring Supadata with `auto` authorizes
speech generation for videos whose captions cannot be recovered; provider
charges apply.

The adapters are injected behind `PageExtractionProvider` and `TranscriptProvider`
interfaces in `packages/shared`, so another provider can be substituted without
changing the API or the processing pipeline. Provider credentials stay in request
headers; errors record statuses rather than provider response bodies.

Validate deployment with a public article, a JavaScript-rendered public page,
a captioned video, and a video requiring speech transcription. Inspect extraction
status/provider and the fetch phase before treating a save as readable. Provider
contract tests mock external calls; live provider validation requires real keys.

Neither rendering nor managed transcription guarantees access to every page or
video. Unsupported file types, restricted/deleted videos, provider outages, and
jobs exceeding the retry window remain explicit failures. This change does not
add PDF extraction, a browser extension capture path, distributed domain pacing,
or a queue lease heartbeat; those remain separate architectural follow-ups.

References: [Firecrawl scrape API](https://docs.firecrawl.dev/api-reference/endpoint/scrape),
[Supadata transcript API](https://github.com/supadata-ai/skills/blob/main/skills/supadata/references/video.md).

## Lightpanda browser recovery

Browser recovery is always part of background extraction; there is no rollout
flag or provider credential. The worker image includes checksum-verified
Lightpanda **1.0.2**, and startup fails if the binary cannot execute. The worker
uses a glibc-based Bun image because the upstream Linux binary does not run on
Alpine/musl. `puppeteer-core` talks to Lightpanda over local CDP; Chromium is not
installed. The API's URL-card preview remains HTTP-only.

For public articles the order is HTTP, Lightpanda, then Firecrawl when its key is
configured. Each result goes through HTML cleanup and content validation before
it is accepted. Challenge pages and loading placeholders advance to the next
provider; authentication, missing pages and unsupported formats remain terminal.
The accepted provider is recorded in `metadata.extraction.provider`.

For X posts, FxTwitter and oEmbed retain priority. If they fail or return empty
post text, Lightpanda selects the requested status's timestamp permalink and
extracts its text, author, date, photo/video previews and links. It excludes
other timeline posts, replies and nested quoted-post media. It does not expand
threads or scroll indefinitely. The existing OG fallback follows browser
recovery; empty or generic X page metadata is rejected.

For YouTube, browser recovery follows the transcript library and MWEB strategies
and precedes Supadata. It reads the hydrated player response, prefers English
and manual caption tracks, and tries at most four tracks. Caption requests stay
inside the browser session and are limited to HTTPS YouTube hosts. The existing
XML/JSON3 parser handles the recovered caption bodies. Player metadata also
recovers failed oEmbed metadata, reusing the same browser result. Existing
managed job IDs resume directly without reopening the browser or submitting a
new job. Browser execution does not replace speech-to-text for absent captions.

Each recovery starts a separate browser process with no backend credentials or
shared cookies. A process-wide slot bounds browser concurrency to one; capacity
waits are limited to 45 seconds and extraction to 30 seconds. Children are killed
and reaped on success, failure or timeout. The browser blocks private networks
after DNS resolution, caps individual responses at 8 MiB and
sets a 96 MiB V8 heap limit and a five-second stalled-JavaScript watchdog.
Article recovery obeys robots.txt. X and YouTube recovery use normal browser
navigation and subresource loading: applying robots rules to every subrequest
would block X hydration and YouTube's `/api/timedtext` caption endpoint. These
paths only retrieve the saved URL; they do not initiate recursive crawling.

For Linux development, install the same pinned binary:

```sh
sh scripts/install-lightpanda.sh /tmp/lightpanda
export LIGHTPANDA_BINARY_PATH=/tmp/lightpanda
```

`LIGHTPANDA_BINARY_PATH` chooses the executable location; it does not enable or
disable recovery. On macOS use the matching upstream release binary. Run the
browser integration checks with a built shared package:

```sh
bun run --cwd packages/shared build
LIGHTPANDA_BINARY_PATH=/tmp/lightpanda bun scripts/test-lightpanda.mjs
```

CI runs these checks with the real pinned browser before deploying. Their local
fixture wrapper permits only loopback; the production browser's private-network
protection is tested separately without that exemption. The fixtures cover
asynchronous article hydration, target-post selection, caption recovery,
redirects, HTTP classification, stalled scripts and capacity recovery.

References: [Lightpanda 1.0.2](https://github.com/lightpanda-io/browser/releases/tag/1.0.2),
[CDP integration](https://lightpanda.io/docs/usage/cdp/puppeteer),
[browser options](https://lightpanda.io/docs/reference/cli/common-options).
