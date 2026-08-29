#!/usr/bin/env node
/**
 * Rule zero, enforced.
 *
 * Signal's first rule (docs/design-system/README.md) is that no component may
 * carry a raw colour or a raw radius. This script is the build-breaking half of
 * that rule: it walks apps/web/{app,components} and fails on
 *
 *   - hex colour literals            #fff, #0B6F9C, #0B6F9CCC
 *   - rgb() / rgba() literals        rgba(255,255,255,.06)
 *   - px radii                       rounded-[10px], border-radius: 10px
 *
 * Need a value that doesn't exist? Add it to docs/design-system/tokens.json,
 * regenerate tokens.css, document it in foundations.md — in that order.
 *
 * Escape hatches, in descending order of preference:
 *
 *   1. Don't. Use a token.
 *   2. `cd-tokens-allow` in a comment on the offending line or the line above,
 *      with the reason. For the handful of places where a literal is
 *      unavoidable (an HTML <meta> tag cannot read a custom property).
 *   3. `cd-tokens-allow-start: reason` / `cd-tokens-allow-end` around a block.
 *   4. LEGACY below — surfaces the revamp has not reached yet. Entries are
 *      removed by the deliverable that migrates the file. Nothing new goes here.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOTS = ["app", "components"];
const EXTENSIONS = [".ts", ".tsx", ".css"];

/** Never checked: not product surfaces. */
const IGNORED = [
  "app/(private)/design-system",
  "app/(private)/my/dashboard/prototype",
  "components/design-system-prototype",
  "components/home-brief-prototype",
  // Signal's own token file is the one place raw values are allowed to live.
  "app/tokens.css",
];

/**
 * Temporarily tolerated. Delete the entry with the deliverable that fixes it.
 *
 * Empty as of D18, and it should stay that way: the auth pages were migrated
 * and `desktop-site-header.tsx` was deleted outright along with the rest of
 * the pre-revamp chrome. Nothing new goes here — a new surface with a raw
 * colour in it is a surface that has not been designed yet.
 */
const LEGACY = [];

const RULES = [
  {
    id: "hex-literal",
    message: "hex colour literal — use a --cd-* token",
    // No \b on either side: Tailwind arbitrary values glue literals to
    // underscores (shadow-[0_0_0_1px_#fff]), and _ is a word character.
    pattern:
      /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/g,
  },
  {
    id: "rgb-literal",
    message: "rgb()/rgba() literal — use a --cd-* token",
    pattern: /rgba?\(/g,
  },
  {
    id: "px-radius",
    message: "px radius — use rounded-{xs,sm,md,lg,pill} or --cd-radius-*",
    pattern:
      /rounded(?:-[a-z]+)?-\[[^\]]*?\d+(?:\.\d+)?px[^\]]*?\]|border-radius\s*:\s*[^;]*\d+(?:\.\d+)?px|borderRadius\s*:\s*["'`][^"'`]*\d+(?:\.\d+)?px/g,
  },
];

const ALLOW_LINE = /cd-tokens-allow\b(?!-)/;
const ALLOW_START = /cd-tokens-allow-start\b/;
const ALLOW_END = /cd-tokens-allow-end\b/;

const toPosix = (p) => p.split(sep).join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(abs, out);
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(abs);
    }
  }
  return out;
}

function scan(file) {
  const violations = [];
  const lines = readFileSync(file, "utf8").split("\n");
  let inAllowBlock = false;

  lines.forEach((line, index) => {
    if (ALLOW_START.test(line)) inAllowBlock = true;
    if (inAllowBlock) {
      if (ALLOW_END.test(line)) inAllowBlock = false;
      return;
    }
    if (ALLOW_LINE.test(line)) return;
    if (index > 0 && ALLOW_LINE.test(lines[index - 1])) return;

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (match) {
        violations.push({
          line: index + 1,
          rule: rule.id,
          message: rule.message,
          snippet: match[0],
        });
      }
    }
  });

  return violations;
}

const files = ROOTS.flatMap((root) => walk(join(WEB_ROOT, root)));

const failures = [];
const legacyHits = new Set();
let checked = 0;

for (const file of files) {
  const rel = toPosix(relative(WEB_ROOT, file));
  if (IGNORED.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
    continue;
  }

  checked += 1;

  const violations = scan(file);
  if (violations.length === 0) continue;

  const legacy = LEGACY.find(
    ([prefix]) => rel === prefix || rel.startsWith(`${prefix}/`),
  );
  if (legacy) {
    legacyHits.add(legacy[0]);
    continue;
  }

  failures.push([rel, violations]);
}

if (legacyHits.size > 0) {
  console.log(
    `lint:tokens — ${legacyHits.size} legacy path(s) still carrying raw values:`,
  );
  for (const [prefix, owner] of LEGACY) {
    if (legacyHits.has(prefix)) console.log(`  ${prefix}  (${owner})`);
  }
  console.log("");
}

for (const [prefix, owner] of LEGACY) {
  if (!legacyHits.has(prefix)) {
    console.log(
      `lint:tokens — ${prefix} is clean; drop it from LEGACY in scripts/lint-tokens.mjs (${owner}).`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nlint:tokens — rule zero violated. Semantic tokens only.\n");
  for (const [rel, violations] of failures) {
    for (const v of violations) {
      console.error(`  ${rel}:${v.line}  ${v.message}\n      ${v.snippet}`);
    }
  }
  console.error(
    `\n${failures.reduce((n, [, v]) => n + v.length, 0)} violation(s) in ${failures.length} file(s).`,
  );
  console.error(
    "Add the value to docs/design-system/tokens.json and regenerate tokens.css.\n",
  );
  process.exit(1);
}

console.log(`lint:tokens — ${checked} files checked, no raw values.`);
