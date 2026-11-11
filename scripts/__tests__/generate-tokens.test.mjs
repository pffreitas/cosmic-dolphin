import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderCss, renderMobileTheme, TOKENS, WEB_OUT } from '../generate-tokens.mjs';

const source = () => JSON.parse(readFileSync(TOKENS, 'utf8'));
const plum = {
  light: { accent: '#5A2950', 'accent-hover': '#6E3563', 'accent-fg': '#FCF7FB', 'accent-soft': '#F4E8F1', 'accent-border': '#D9BCD2', focus: '{accent}' },
  dark: { accent: '#E3B9DA', 'accent-hover': '#D4A5CB', 'accent-fg': '#2A1026', 'accent-soft': '#36202F', 'accent-border': '#6B4462', focus: '{accent}' },
};
test('canonical mobile overrides generate approved plum while other Signal values stay intact', () => {
  const tokens = source();
  tokens.color.mobile = structuredClone(plum);
  const output = renderMobileTheme(tokens);
  for (const mode of ['light', 'dark']) {
    const block = output.split(`  ${mode}: {`)[1].split('  },')[0];
    for (const [name, value] of Object.entries(plum[mode]).filter(([name]) => name !== 'focus')) {
      const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      assert.ok(block.includes(`${key}: '${value}'`), `${mode} ${name} must use the mobile override`);
    }
    assert.ok(block.includes(`bg: '${tokens.color[mode].bg}'`));
  }
});

test('unknown mobile color keys reject in either mode instead of silently disappearing', () => {
  for (const mode of ['light', 'dark']) {
    const tokens = source();
    tokens.color.mobile[mode]['accnet'] = '#ffffff';
    assert.throws(() => renderMobileTheme(tokens), /color\.mobile\.(light|dark).*accnet/);
  }
});

test('mobile aliases resolve after merge, including inherited and chained aliases', () => {
  const tokens = source();
  for (const mode of ['light', 'dark']) {
    delete tokens.color.mobile[mode].focus;
    tokens.color[mode].focus = '{accent}';
    tokens.color.mobile[mode]['accent-border'] = '{focus}';
  }
  const output = renderMobileTheme(tokens);
  for (const mode of ['light', 'dark']) {
    const block = output.split(`  ${mode}: {`)[1].split('  },')[0];
    for (const name of ['accent', 'focus', 'accentBorder']) {
      assert.ok(block.includes(`${name}: '${plum[mode].accent}'`), `${mode} ${name} must resolve against the merged palette`);
    }
  }
});

test('invalid and circular mobile aliases reject with an actionable error', () => {
  for (const alias of ['{missing}', '{focus}']) {
    const tokens = source();
    tokens.color.mobile.light.focus = alias;
    assert.throws(() => renderMobileTheme(tokens), /Alias.*(missing|focus).*color\.mobile\.light/);
  }
});

test('mobile overrides leave web CSS byte-identical and do not mutate canonical colors', () => {
  const tokens = source();
  const before = structuredClone(tokens);
  const withoutMobile = source();
  delete withoutMobile.color.mobile;
  renderMobileTheme(tokens);
  assert.deepEqual(tokens, before);
  assert.equal(renderCss(tokens), renderCss(withoutMobile));
  assert.equal(renderCss(tokens), readFileSync(WEB_OUT, 'utf8'));
  assert.deepEqual(tokens.color.mobile, plum, 'checked-in overrides must be the approved palette');
});
