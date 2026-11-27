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

test('web parity roles are separate from the shipped native compatibility scale', () => {
  const tokens = source();
  const before = structuredClone(tokens);
  const output = renderMobileTheme(tokens);
  const block = name => output.split(`export const ${name} = {`)[1].split('} as const;')[0];
  assert.match(block('type'), /title1: \{ family: 'serif'.*fontSize: 29, lineHeight: 34\.8/);
  assert.match(block('type'), /textTransform: 'uppercase'/);
  assert.match(block('webType'), /title1: \{ family: 'serif'.*fontSize: 44, lineHeight: 48\.4/);
  assert.match(block('webTypeCompact'), /title1: \{ family: 'serif'.*fontSize: 32, lineHeight: 35\.2/);
  assert.match(block('webTypeCompact'), /reader: \{ family: 'serif'.*fontSize: 17, lineHeight: 29\.24/);
  assert.doesNotMatch(block('webType'), /textTransform: 'uppercase'/);
  assert.match(block('webColors'), /accent: '#25221F'/);
  assert.match(block('colors'), /accent: '#5A2950'/);
  assert.deepEqual(tokens, before, 'generating parity exports must not mutate canonical data');
});

test('canonical typography edits reach parity exports without changing native compatibility', () => {
  const tokens = source();
  const original = renderMobileTheme(tokens);
  tokens.typography.scale['title-1'].size = '46px';
  const updated = renderMobileTheme(tokens);
  const native = output => output.split('export const type = {')[1].split('} as const;')[0];
  assert.equal(native(updated), native(original));
  assert.match(updated.split('export const webType = {')[1], /title1: \{ family: 'serif'.*fontSize: 46/);
});

test('compact overrides reject unknown roles rather than dropping a typo', () => {
  const tokens = source();
  tokens.typography.compact.scale.titel = { size: '12px' };
  assert.throws(() => renderMobileTheme(tokens), /typography\.compact\.scale.*titel/);
});

test('reference CSS and runtime CSS are generated together', async () => {
  const { build, REFERENCE_OUT } = await import('../generate-tokens.mjs');
  const outputs = new Map(build());
  assert.equal(outputs.get(REFERENCE_OUT), outputs.get(WEB_OUT));
  assert.equal(readFileSync(REFERENCE_OUT, 'utf8'), outputs.get(WEB_OUT));
});

test('web parity palette resolves inherited aliases independently of native overrides', () => {
  const tokens = source();
  tokens.color.light.focus = '{accent}';
  tokens.color.light['accent-border'] = '{focus}';
  const output = renderMobileTheme(tokens);
  const web = output.split('export const webColors = {')[1].split('  },')[0];
  assert.match(web, /focus: '#25221F'/);
  assert.match(web, /accentBorder: '#25221F'/);
  assert.match(output.split('export const colors = {')[1].split('  },')[0], /focus: '#5A2950'/);
});

test('web parity typography preserves fractional tracking and line boxes', () => {
  const web = renderMobileTheme(source()).split('export const webType = {')[1].split('} as const;')[0];
  assert.match(web, /title1: .*letterSpacing: -0\.968/);
  assert.match(web, /bodySm: .*lineHeight: 20\.925/);
});
