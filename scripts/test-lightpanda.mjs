import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LightpandaPageProvider } from "../packages/shared/dist/services/lightpanda.service.js";
import { WebScrapingServiceImpl } from "../packages/shared/dist/services/web-scraping.service.js";

const directory = mkdtempSync(join(tmpdir(), "cosmic-lightpanda-test-"));
const binary = resolve(
  process.env.LIGHTPANDA_BINARY_PATH || "/usr/local/bin/lightpanda",
);
const wrapper = join(directory, "fixture-browser");
// Only this fixture wrapper permits loopback. The production provider always
// blocks private networks, including page subrequests and redirects.
writeFileSync(
  wrapper,
  `#!/bin/sh\nexec '${binary.replaceAll("'", "'\\''")}' "$@" --block-cidrs -127.0.0.1/32\n`,
  { mode: 0o700 },
);
const paragraph =
  "A useful article preserves its headings, paragraphs, relative links and images after an asynchronous request has finished. ".repeat(
    6,
  );
let requests = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    requests++;
    const path = new URL(request.url).pathname;
    const html = (body) =>
      new Response(
        `<!doctype html><html><head><title>Fixture</title></head><body>${body}</body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    if (path === "/robots.txt")
      return new Response(
        "User-agent: *\nDisallow: /user/\nDisallow: /watch\nDisallow: /api/",
      );
    if (path === "/missing") return new Response("Missing", { status: 404 });
    if (path === "/limited")
      return new Response("Rate limited", { status: 429 });
    if (path === "/redirect")
      return Response.redirect(new URL("/article", request.url));
    if (path === "/private")
      return Response.redirect(new URL("/login", request.url));
    if (path === "/login")
      return html('<h1>Sign in</h1><input type="password">');
    if (path === "/loop") return html("<script>while(true){}</script>");
    if (path === "/data") return Response.json({ text: paragraph });
    if (path === "/article")
      return html(
        `<nav>Unrelated navigation</nav><div id="root">Loading your article...</div><script>fetch('/data').then(r=>r.json()).then(data=>setTimeout(()=>{document.querySelector('#root').innerHTML='<article><h1>Recovered article</h1><p>'+data.text+'</p><a href="/related">Related</a><img src="/cover.png"></article>'},100))</script>`,
      );
    if (path === "/watch")
      return html(`<script>
    window.ytInitialPlayerResponse={videoDetails:{title:'Browser video',author:'Fixture author',channelId:'channel'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[
      {baseUrl:'https://evil.example/captions',languageCode:'en'},
      {baseUrl:'https://www.youtube.com/api/timedtext?lang=pt',languageCode:'pt'}]}}};
    window.fetch=async url=>{if(!url.startsWith('https://www.youtube.com/'))throw Error('Untrusted caption URL');return {ok:true,text:async()=>'<transcript><text start="0">Recovered browser captions</text></transcript>'}};
    </script>`);
    if (path === "/modern/status/124")
      return html(
        `<article><a href="/other/status/999" data-base-ui-tooltip-trigger>Other date</a><div dir="auto" class="whitespace-pre-wrap">Unrelated post</div></article><article><a href="/modern">Modern author</a><div dir="auto" class="whitespace-pre-wrap">Server rendered post <a href="https://example.com/modern">Modern link</a></div><a href="/modern/status/124" aria-current="page" data-base-ui-tooltip-trigger>Oct 29, 2026</a><img src="https://pbs.twimg.com/media/modern.jpg"></article>`,
      );
    if (path === "/user/status/123")
      return html(`<main><article><a href="/other/status/999"><time>Other post</time></a><div data-testid="tweetText">Unrelated timeline content</div><div data-testid="quoteTweet"><a href="/user/status/123"><time>Quoted timestamp</time></a></div></article>
    <article><div data-testid="User-Name">Fixture author @fixture</div><a href="/user/status/123"><time datetime="2026-10-29">Today</time></a><div data-testid="tweetText">The target post <a href="https://example.com/article">article link</a></div><div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/fixture.jpg" alt="Fixture photo"></div></article>
    <article><a href="/reply/status/456"><time>Reply timestamp</time></a><div data-testid="tweetText">Unrelated reply</div></article></main>`);
    return html("<p>Fixture content</p>");
  },
});
const base = `http://127.0.0.1:${server.port}`;
const browser = new LightpandaPageProvider(wrapper);
try {
  const page = await browser.extract(`${base}/redirect`);
  const parsed = new WebScrapingServiceImpl().scrapeContent(
    page.finalUrl,
    page.html,
  );
  assert.ok(parsed.content.includes(paragraph));
  assert.ok(!parsed.content.includes("Unrelated navigation"));
  assert.equal(parsed.links[0].url, `${base}/related`);
  assert.equal(parsed.images[0].url, `${base}/cover.png`);
  console.log(
    "PASS: asynchronous article hydration, cleanup and redirect resolution",
  );
  const tweet = await browser.extractTweet(`${base}/user/status/123`);
  assert.ok(tweet.content.includes("The target post"));
  assert.ok(!tweet.content.includes("Unrelated"));
  assert.equal(tweet.images[0].url, "https://pbs.twimg.com/media/fixture.jpg");
  assert.equal(tweet.links[0].url, "https://example.com/article");
  console.log(
    "PASS: target X post, author and media without timeline/reply/quote contamination",
  );
  const modernTweet = await browser.extractTweet(`${base}/modern/status/124`);
  assert.ok(modernTweet.content.includes("Server rendered post"));
  assert.ok(modernTweet.title.includes("Modern author (@modern)"));
  assert.equal(
    modernTweet.images[0].url,
    "https://pbs.twimg.com/media/modern.jpg",
  );
  assert.equal(modernTweet.links[0].url, "https://example.com/modern");
  console.log(
    "PASS: server-rendered X markup without legacy test IDs or time elements",
  );
  const video = await browser.extractYouTube(`${base}/watch`);
  assert.equal(video.title, "Browser video");
  assert.equal(video.captions.length, 1);
  assert.equal(video.captions[0].language, "pt");
  assert.ok(video.captions[0].body.includes("Recovered browser captions"));
  console.log(
    "PASS: player metadata, caption retrieval and caption hostname validation",
  );
  for (const [path, code, retry] of [
    ["private", "auth", false],
    ["missing", "unavailable", false],
    ["limited", "blocked", true],
  ]) {
    await assert.rejects(
      browser.extract(`${base}/${path}`),
      (error) => error.code === code && error.shouldRetry === retry,
    );
  }
  console.log(
    "PASS: authentication, missing page and rate-limit classification",
  );
  await assert.rejects(
    browser.extract(`${base}/loop`),
    (error) => error.shouldRetry === true,
  );
  assert.ok(
    (await browser.extract(`${base}/article`)).html.includes(paragraph),
  );
  console.log(
    "PASS: stalled JavaScript is killed and browser capacity recovers",
  );
  const before = requests;
  await assert.rejects(
    new LightpandaPageProvider(binary).extract(`${base}/article`),
  );
  assert.equal(requests, before);
  console.log("PASS: production browser blocks private-network requests");
  const publicPage = await new LightpandaPageProvider(binary).extract(
    "https://example.com",
  );
  assert.ok(publicPage.html.includes("Example Domain"));
  console.log(
    "PASS: public HTTPS extraction with the production certificate trust store",
  );
} finally {
  server.stop(true);
  rmSync(directory, { recursive: true, force: true });
}
