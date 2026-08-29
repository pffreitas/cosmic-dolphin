#!/usr/bin/env node
/**
 * Rule ten, enforced.
 *
 * docs/design-system/README.md closes with "Accessibility is build-breaking,
 * not polish." Contrast is checked in `__tests__/accessibility/`, because it is
 * arithmetic over `tokens.json`. The other three are properties of the source,
 * and this is where they become build-breaking:
 *
 *   focus-ring     every interactive element resolves to one of the rings in
 *                  `components/ui/focus-ring.ts`
 *   target-size    no interactive element declares a box under 32px
 *   reduced-motion every `animate-*` ships its own `motion-reduce:` answer
 *
 * ## Why an AST and not a grep
 *
 * Two constructs make a regex lie about this codebase. `<Button asChild>` hands
 * its classes — ring included — to whatever child it wraps, so the child's own
 * `className` is legitimately bare. And almost every ring arrives through a
 * `cva()` or a shared constant several lines above the element, so the ring is
 * never on the line the element is on. TypeScript is already a dependency here;
 * parsing the real thing costs one import and removes both classes of lie.
 *
 * ## What "resolves to a ring" means
 *
 * A file's ring-bearing names are collected first: anything imported from
 * `focus-ring`, anything imported from a local module that resolves to one,
 * plus any `const` whose initialiser carries a ring class or references a name
 * already known to. An element passes if its `className` spells a ring out, or
 * names one of those, or sits inside an `asChild` ancestor.
 *
 * ## Escape hatches, in descending order of preference
 *
 *   1. Don't. Add the ring.
 *   2. `cd-a11y-allow: reason` in a comment on the offending line or the line
 *      above. For genuinely non-focusable cases the AST cannot see.
 *   3. IGNORED below — not product surfaces.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOTS = ["app", "components"];

/** Never checked. */
const IGNORED = [
  // Untracked local scratch prototypes.
  "app/(private)/design-system",
  "app/(private)/my/dashboard/prototype",
  "components/design-system-prototype",
  "components/home-brief-prototype",
  // Vendored ai-sdk "AI Elements", not imported by any product surface. They
  // are not Signal components and holding them to Signal's rules would only
  // teach people to add exemptions. If they are ever wired to a screen they
  // must be restyled first, which is when they come off this list.
  "components/ai-elements",
];

const isTest = (rel) =>
  rel.includes("/__tests__/") || /\.(test|spec)\.tsx?$/.test(rel);

// ---------------------------------------------------------------------------
// What counts as interactive
// ---------------------------------------------------------------------------

const NATIVE_INTERACTIVE = new Set([
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
]);

/** Components that render a focusable DOM node of their own. */
const INTERACTIVE_COMPONENTS = new Set(["Link"]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "combobox",
  "slider",
  "textbox",
]);

/**
 * `components/ui` files that own an interactive primitive. Each must reach for
 * a shared ring rather than inventing one — most of their focusable nodes are
 * Radix parts rendered from a component name, which the element-level rule
 * cannot see through.
 */
const PRIMITIVES_NEEDING_A_RING = [
  "components/ui/button.tsx",
  "components/ui/input.tsx",
  "components/ui/textarea.tsx",
  "components/ui/select.tsx",
  "components/ui/checkbox.tsx",
  "components/ui/dialog.tsx",
  "components/ui/dropdown-menu.tsx",
  "components/ui/command.tsx",
  "components/ui/segmented.tsx",
  "components/ui/badge.tsx",
  "components/ui/toast.tsx",
  "components/ui/sheet.tsx",
];

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/** A real ring: 2px of ring or outline on focus, or one of the shared consts. */
const RING = /focus(?:-visible)?:(?:ring-2|outline-2)|\bfocusRing(?:Inset|Always)?\b/;

/** `animate-<something>`, ignoring `animate-none`, at a class-token boundary. */
const ANIMATE = /(?:^|[\s"'`:\]])animate-(?!none\b)[a-z0-9-]+/;

const MOTION_ANSWER = /motion-reduce:/;

/**
 * A Tailwind box declaration: optional variant prefixes, then h-/size-/min-h-.
 * The leading class-boundary excludes child selectors like `[&_svg]:size-4`,
 * which size a descendant rather than the element itself.
 */
const BOX = /(?:^|[\s"'`])((?:[a-z][a-z0-9-]*:)*)(min-h|size|h)-(\[[^\]]+\]|\d+(?:\.\d+)?)/g;

const ALLOW = /cd-a11y-allow\b/;

const MIN_TARGET_PX = 32;

// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(sep).join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(abs, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(abs);
    }
  }
  return out;
}

function attribute(node, name) {
  for (const prop of node.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name.getText() === name) return prop;
  }
  return undefined;
}

function hasAttribute(node, name) {
  return attribute(node, name) !== undefined;
}

/** The attribute's value as source text — a literal, or the expression inside `{}`. */
function attributeText(node, name) {
  const attr = attribute(node, name);
  if (!attr || !attr.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer)) {
    return attr.initializer.expression?.getText() ?? "";
  }
  return attr.initializer.getText();
}

/** Resolve a relative or `@/`-aliased import to a file on disk, or null. */
function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = join(WEB_ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = join(fromFile, "..", specifier);
  else return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const ringNameCache = new Map();

/**
 * Names in `file` that carry a focus ring.
 *
 * Resolved to a fixpoint within the file, then followed across local imports —
 * `textarea.tsx` gets its ring from `fieldSurface` in `input.tsx`, which gets it
 * from `focus-ring.ts`, and a check that stopped at the file boundary would call
 * that a violation and teach someone to silence it. There is no hop limit: the
 * memo doubles as the cycle guard, so the whole local import graph is walked
 * once. (A limit here is worse than none — a file first reached at the limit
 * caches an empty answer that every later caller then believes.)
 */
function ringBearingNames(file) {
  const cached = ringNameCache.get(file);
  if (cached) return cached;

  const names = new Set();
  ringNameCache.set(file, names); // guards import cycles

  let source;
  try {
    source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  } catch {
    return names;
  }

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const bindings = node.importClause?.namedBindings;
      const imported =
        bindings && ts.isNamedImports(bindings)
          ? bindings.elements.map((e) => [e.name.text, (e.propertyName ?? e.name).text])
          : [];

      if (/focus-ring$/.test(specifier)) {
        for (const [local] of imported) names.add(local);
      } else if (imported.length > 0) {
        const target = resolveImport(file, specifier);
        if (target) {
          const exported = ringBearingNames(target);
          for (const [local, original] of imported) {
            if (exported.has(original)) names.add(local);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  // A declaration counts once its initialiser spells a ring out, or names
  // something that already does. Repeat until nothing new is learned — a cva
  // built from a constant built from `focusRing` is three hops deep.
  const declarations = [];
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.push([node.name.text, node.initializer.getText()]);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, text] of declarations) {
      if (names.has(name)) continue;
      const referencesKnown = [...names].some((known) =>
        new RegExp(`\\b${known}\\b`).test(text),
      );
      if (RING.test(text) || referencesKnown) {
        names.add(name);
        changed = true;
      }
    }
  }

  return names;
}

/** True when an ancestor hands its own classes down through Radix's Slot. */
function insideAsChild(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current) && hasAttribute(current.openingElement, "asChild")) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** The largest box this className declares, in px, or null when it declares none. */
function declaredTargetPx(className) {
  let largest = null;
  BOX.lastIndex = 0;
  let match;
  while ((match = BOX.exec(className)) !== null) {
    const raw = match[3];
    let px;
    if (raw.startsWith("[")) {
      const value = /(-?\d+(?:\.\d+)?)px/.exec(raw);
      if (!value) continue;
      px = Number(value[1]);
    } else {
      // Tailwind's spacing scale is 0.25rem per step at the default 16px root.
      px = Number(raw) * 4;
    }
    if (largest === null || px > largest) largest = px;
  }
  return largest;
}

function isInteractive(tag, node) {
  if (NATIVE_INTERACTIVE.has(tag)) {
    // An anchor without an href is a span with underline.
    if (tag === "a" && !hasAttribute(node, "href")) return false;
    if (tag === "input" && attributeText(node, "type") === "hidden") return false;
    return true;
  }
  if (INTERACTIVE_COMPONENTS.has(tag)) return true;

  // A non-native element is only focusable if something made it so. A `role`
  // alone does not: `BreadcrumbPage` is `role="link" aria-disabled` on a span,
  // which is a label, not a control, and asking it for a ring would be wrong.
  const tabIndex = attributeText(node, "tabIndex");
  const focusable =
    (tabIndex !== undefined && tabIndex.trim() !== "-1") || hasAttribute(node, "onClick");
  if (!focusable) return false;

  const role = attributeText(node, "role");
  return Boolean(role && INTERACTIVE_ROLES.has(role)) || tabIndex !== undefined;
}

// ---------------------------------------------------------------------------

function scan(file, rel) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rings = ringBearingNames(file);
  const violations = [];

  const lineOf = (node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const allowed = (line) =>
    ALLOW.test(lines[line - 1] ?? "") || ALLOW.test(lines[line - 2] ?? "");

  const report = (node, rule, message) => {
    const line = lineOf(node);
    if (allowed(line)) return;
    violations.push({ line, rule, message });
  };

  const resolvesToRing = (className) =>
    RING.test(className) ||
    [...rings].some((name) => new RegExp(`\\b${name}\\b`).test(className));

  /**
   * The scope a `motion-reduce:` answer may live in.
   *
   * Class lists are assembled, not written in one place: `processing-steps.tsx`
   * spins in one `cn()` argument and stills itself in the next, and
   * `ConnectionStatus` keeps its classes in an object of variants far from any
   * JSX. Both are correct scopes to look in; the enclosing *statement* is not,
   * because a sibling component's `motion-reduce:` would then excuse this one.
   */
  const motionScope = (node) => {
    let current = node.parent;
    while (current) {
      if (
        ts.isJsxAttribute(current) ||
        ts.isPropertyAssignment(current) ||
        ts.isVariableDeclaration(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return node;
  };

  const visit = (node) => {
    // --- reduced motion --------------------------------------------------
    // Checked on the string literal rather than the element, because half the
    // animation classes in this codebase never appear inside a JSX attribute.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (ANIMATE.test(node.text) && !MOTION_ANSWER.test(motionScope(node).getText())) {
        report(
          node,
          "reduced-motion",
          `"${node.text.trim().slice(0, 60)}" animates with no motion-reduce: answer — ` +
            `foundations.md § Motion asks for the specified still state ` +
            `(shimmer flat, spinner a static ring at 60%)`,
        );
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      const className = attributeText(node, "className") ?? "";

      if (isInteractive(tag, node)) {
        // --- focus ring --------------------------------------------------
        if (!resolvesToRing(className) && !insideAsChild(node)) {
          report(
            node,
            "focus-ring",
            `<${tag}> is interactive with no visible focus ring — use focusRing / ` +
              `focusRingInset / focusRingAlways from components/ui/focus-ring`,
          );
        }

        // --- target size ---------------------------------------------------
        // Only a *declared* box can be judged. An element sized by its padding
        // and its text is left to the eye; an element that says "16px" is not.
        const px = declaredTargetPx(className);
        if (px !== null && px < MIN_TARGET_PX) {
          report(
            node,
            "target-size",
            `<${tag}> declares a ${px}px box — foundations.md asks for ${MIN_TARGET_PX}px ` +
              `on pointer. Pad it, or give it an ::after hit area (after:size-8).`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return violations;
}

// ---------------------------------------------------------------------------

const files = ROOTS.flatMap((root) => walk(join(WEB_ROOT, root)));

const failures = [];
let checked = 0;

for (const file of files) {
  const rel = toPosix(relative(WEB_ROOT, file));
  if (IGNORED.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
  if (isTest(rel)) continue;

  checked += 1;
  const violations = scan(file, rel);
  if (violations.length > 0) failures.push([rel, violations]);
}

// The primitives contract: a file that owns a focusable primitive must import
// a ring, whether or not this script can see the DOM node it lands on.
for (const rel of PRIMITIVES_NEEDING_A_RING) {
  const abs = join(WEB_ROOT, rel);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    failures.push([
      rel,
      [
        {
          line: 1,
          rule: "focus-ring",
          message:
            "listed in PRIMITIVES_NEEDING_A_RING but not on disk — delete the entry " +
            "in the same commit that deletes the primitive",
        },
      ],
    ]);
    continue;
  }
  // Either it spells a ring out, or it inherits one — `textarea.tsx` gets its
  // ring from `fieldSurface`, which is the right way round and must pass.
  if (!RING.test(text) && ringBearingNames(abs).size === 0) {
    failures.push([
      rel,
      [
        {
          line: 1,
          rule: "focus-ring",
          message:
            "interactive primitive that resolves to no focus ring — every focusable " +
            "part it renders needs the one ring from components/ui/focus-ring",
        },
      ],
    ]);
  }
}

if (failures.length > 0) {
  console.error("\nlint:a11y — rule ten violated. Accessibility is build-breaking.\n");
  for (const [rel, violations] of failures) {
    for (const v of violations) {
      console.error(`  ${rel}:${v.line}  [${v.rule}] ${v.message}`);
    }
  }
  const total = failures.reduce((n, [, v]) => n + v.length, 0);
  console.error(
    `\n${total} violation(s) in ${failures.length} file(s). ` +
      `See docs/design-system/foundations.md § Accessibility.\n`,
  );
  process.exit(1);
}

console.log(
  `lint:a11y — ${checked} files checked; focus rings, 32px targets and ` +
    `reduced-motion answers all present.`,
);
