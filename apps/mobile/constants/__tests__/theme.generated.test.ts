import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { colors, radius, space, type } from '@/constants/theme';

const REPO_ROOT = resolve(__dirname, '../../../..');
const TOKENS = resolve(REPO_ROOT, 'docs/design-system/tokens.json');
const GENERATOR = resolve(REPO_ROOT, 'scripts/generate-tokens.mjs');

/**
 * `constants/theme.ts` is compiled from `docs/design-system/tokens.json` by
 * `scripts/generate-tokens.mjs`, and so is `apps/web/app/tokens.css`. A
 * generated file is only trustworthy if going stale is loud, so this suite
 * fails the moment either output stops matching the source — the same guard
 * `lib/reading/__tests__/highlight-anchor.mirror.test.ts` gives the web app's
 * mirrored module.
 *
 * If this fails: run `bun run tokens` from the repo root and commit both files.
 */
describe('generated Signal theme', () => {
  it('is in sync with docs/design-system/tokens.json — for both clients', () => {
    expect(() =>
      execFileSync('node', [GENERATOR, '--check'], { encoding: 'utf8' }),
    ).not.toThrow();
  });

  it('carries the colour tokens the source declares, in both modes', () => {
    const source = JSON.parse(readFileSync(TOKENS, 'utf8'));

    // Gradients and box-shadows have no React Native equivalent and are left
    // out on purpose; everything that is an actual colour must be present.
    const isColour = (value: string) => /^(#|rgba?\(|hsla?\()/.test(value);
    const expected = Object.entries(source.color.light)
      .filter(([, value]) => isColour(value as string))
      .map(([name]) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()));

    for (const mode of ['light', 'dark'] as const) {
      expect(Object.keys(colors[mode]).sort()).toEqual([...expected].sort());
    }
  });

  it('translates shape, space and the type scale into numbers React Native can use', () => {
    expect(radius.md).toBe(8);
    expect(radius.pill).toBe(999);
    expect(space.s4).toBe(16);

    // Serif is content the user evaluates, sans is what they operate.
    expect(type.title1.family).toBe('serif');
    expect(type.body.family).toBe('sans');
    expect(type.body.fontSize).toBe(15);
  });
});
