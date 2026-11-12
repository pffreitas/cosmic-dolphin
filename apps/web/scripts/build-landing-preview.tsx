/** Run from apps/web: bun scripts/build-landing-preview.tsx
 * Generates the review artifact from the actual page and components, not a replica.
 * Fonts and CSS are embedded so the HTML works offline, without a preview server.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import postcss from "postcss";
import tailwind from "tailwindcss";
import config from "../tailwind.config";

async function main() {
  process.chdir(resolve(import.meta.dirname, ".."));
  // Bun runs outside Next's bundler; pin React to the web workspace rather than
  // resolving the mobile app's hoisted React 19 from dependencies such as Next.
  const require = createRequire(import.meta.url);
  for (const moduleName of [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
  ]) {
    require(moduleName);
    const hoisted = require.resolve(moduleName, { paths: [resolve("../..")] });
    require.cache[hoisted] = require.cache[require.resolve(moduleName)];
  }
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LandingPage } = await import("../components/marketing/landing-page");
  const read = (path: string) => readFile(path, "utf8");
  const [globals, tokens, landing] = await Promise.all([
    read("app/globals.css"),
    read("app/tokens.css"),
    read("components/marketing/landing-page.css"),
  ]);
  let markup = renderToStaticMarkup(createElement(LandingPage));
  for (const name of ["llm-video"]) {
    const image = await readFile(`public/images/landing/${name}.webp`);
    markup = markup.replaceAll(
      `/images/landing/${name}.webp`,
      `data:image/webp;base64,${image.toString("base64")}`,
    );
  }
  for (const name of ["compact", "wordmark-dark"]) {
    const image = await readFile(`public/images/landing/brand/${name}.webp`);
    markup = markup.replaceAll(
      `/images/landing/brand/${name}.webp`,
      `data:image/webp;base64,${image.toString("base64")}`,
    );
  }
  const css = await postcss([
    tailwind({
      ...config,
      content: [
        {
          raw: markup
            .replaceAll("&amp;", "&")
            .replaceAll("&gt;", ">")
            .replaceAll("&lt;", "<"),
          extension: "html",
        },
      ],
    }),
  ]).process(
    globals.split("/* TipTap Editor")[0].replace('@import "./tokens.css";', ""),
    { from: "app/globals.css" },
  );

  const response = await fetch(
    "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..600;1,8..60,400..600&display=swap",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    },
  );
  if (!response.ok) throw new Error(`Font CSS: ${response.status}`);
  const fontCSS = await response.text();
  // Latin is sufficient for this English review artifact, keeping it portable.
  const latin = [
    ...fontCSS.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g),
  ]
    .map((match) => match[1])
    .join("\n");
  if (!latin) throw new Error("No Latin font faces returned");
  let embeddedFonts = latin;
  for (const url of new Set(
    [...latin.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]),
  )) {
    const font = await fetch(url);
    if (!font.ok) throw new Error(`Font asset: ${font.status}`);
    embeddedFonts = embeddedFonts.replaceAll(
      url,
      `data:font/woff2;base64,${Buffer.from(await font.arrayBuffer()).toString("base64")}`,
    );
  }

  const html = `<!doctype html>
<!-- Generated from LandingPage and Signal components. Run bun scripts/build-landing-preview.tsx in apps/web. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="Save any article, video or post. Get the key ideas in a short, sourced brief, and the best of your saves back every morning."><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(await read("app/icon.svg"))}"><title>Cosmic Dolphin · Landing page</title>
<style>${embeddedFonts}\n${tokens}\n${css.css}\n:root { --cd-font-sans: 'Inter', sans-serif; --cd-font-serif: 'Source Serif 4', serif; }\n${landing}</style></head>
<body>${markup}
<script>
document.querySelectorAll('a[href="/sign-up"],a[href="/sign-in"],a[href="/"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.getElementById('preview-note').showModal()}));
</script>
<dialog id="preview-note" style="background:var(--cd-bg);color:var(--cd-fg);border:1px solid var(--cd-border);border-radius:var(--cd-radius-md);padding:24px;max-width:360px;margin:auto;font-family:var(--cd-font-sans)"><p>This is the standalone design preview. Account links connect to the real sign-up and sign-in routes in the Next.js app.</p><form method="dialog"><button style="margin-top:16px;padding:10px 16px;border:1px solid var(--cd-border-strong);border-radius:var(--cd-radius-sm)">Back to preview</button></form></dialog>
</body></html>`;
  const output = "../../docs/design-system/prototypes/landing-page.html";
  await writeFile(output, html);
  console.log(
    `Generated ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KB, self-contained)`,
  );
}
void main();
