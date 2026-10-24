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

Blocked requests, challenge pages, and empty JavaScript shells can fall back to
Firecrawl's rendered HTML extraction when `FIRECRAWL_API_KEY` is configured.
Returned HTML is checked again before it is accepted. Login redirects, HTTP 401,
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
3. Optional Supadata retrieval. `auto` mode first tries captions, then speech
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

Each provider is disabled when its key is absent. Directly readable pages and
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
