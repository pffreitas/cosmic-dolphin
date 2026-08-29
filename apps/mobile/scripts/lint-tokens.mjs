#!/usr/bin/env node
/**
 * Rule zero, enforced — the React Native half.
 *
 * `apps/web/scripts/lint-tokens.mjs` is the same idea for the web app, and it
 * exists because "no literals remain" decays the moment nothing checks. Mobile
 * has the same failure mode with a different syntax, so it gets its own pass
 * over apps/mobile/{app,components,constants,hooks,lib,contexts}, failing on
 *
 *   - hex colour literals        '#fff', '#0B6F9C'
 *   - rgb()/rgba()/hsl() strings 'rgba(0,0,0,.5)'
 *   - named CSS colours in a colour position   color: 'white'
 *   - numeric radii              borderRadius: 12
 *
 * Every one of those has a token: `colors` from `@/constants/theme` (through
 * `useTheme()`), and `radius` / `space` for shape and rhythm. Need a value that
 * does not exist? Add it to docs/design-system/tokens.json, run
 * `bun run tokens` at the repo root, and document it in foundations.md — in
 * that order. The generated theme is what makes that regeneration reach both
 * clients at once.
 *
 * Escape hatch: `cd-tokens-allow` in a comment on the offending line or the
 * line above, with the reason.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOTS = ["app", "components", "constants", "hooks", "lib", "contexts"];
const EXTENSIONS = [".ts", ".tsx"];

/** Never checked: generated, or not a product surface. */
const IGNORED = [
  // The generated theme is the one place raw values are allowed to live, and it
  // is rewritten from tokens.json rather than edited.
  "constants/theme.ts",
  "scripts",
];

const NAMED_COLORS =
  "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|cyan|magenta|transparent";

const RULES = [
  {
    id: "hex-literal",
    message: "hex colour literal — use a token from @/constants/theme",
    pattern:
      /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/g,
  },
  {
    id: "css-colour-function",
    message: "rgb()/rgba()/hsl() literal — use a token from @/constants/theme",
    pattern: /\b(?:rgba?|hsla?)\(/g,
  },
  {
    id: "named-colour",
    // `transparent` is the one named value with no token equivalent — it means
    // "no surface", not a colour — so it is allowed and excluded below.
    message: "named colour literal — use a token from @/constants/theme",
    pattern: new RegExp(
      `(?:[Cc]olor|[Bb]ackground|[Tt]int)\\s*[:=]\\s*['"\`](?:${NAMED_COLORS})['"\`]`,
      "g",
    ),
  },
  {
    id: "px-radius",
    message: "numeric radius — use radius.{xs,sm,md,lg,pill}",
    pattern: /border(?:Top|Bottom)?(?:Start|End|Left|Right)?Radius\s*:\s*\d/g,
  },
];

const ALLOW_LINE = /cd-tokens-allow\b/;

const toPosix = (p) => p.split(sep).join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
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

  lines.forEach((line, index) => {
    if (ALLOW_LINE.test(line)) return;
    if (index > 0 && ALLOW_LINE.test(lines[index - 1])) return;

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (!match) continue;
      if (rule.id === "named-colour" && /transparent/.test(match[0])) continue;
      violations.push({
        line: index + 1,
        rule: rule.id,
        message: rule.message,
        snippet: match[0],
      });
    }
  });

  return violations;
}

const files = ROOTS.flatMap((root) => walk(join(MOBILE_ROOT, root)));

const failures = [];
let checked = 0;

for (const file of files) {
  const rel = toPosix(relative(MOBILE_ROOT, file));
  if (IGNORED.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
    continue;
  }

  checked += 1;
  const violations = scan(file);
  if (violations.length > 0) failures.push([rel, violations]);
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
    "Add the value to docs/design-system/tokens.json and run `bun run tokens`.\n",
  );
  process.exit(1);
}

console.log(`lint:tokens — ${checked} files checked, no raw values.`);
