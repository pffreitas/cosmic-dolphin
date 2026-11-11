import { colors } from '@/constants/theme';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255);
  const [r, g, b] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

it.each(['light', 'dark'] as const)('%s plum text, focus and meaningful UI retain Signal contrast', mode => {
  const c = colors[mode];
  expect([c.accent, c.accentHover, c.accentFg, c.accentSoft, c.accentBorder]).toEqual(mode === 'light'
    ? ['#5A2950', '#6E3563', '#FCF7FB', '#F4E8F1', '#D9BCD2']
    : ['#E3B9DA', '#D4A5CB', '#2A1026', '#36202F', '#6B4462']);
  expect(c.focus).toBe(c.accent);
  for (const ground of [c.bg, c.bgSubtle, c.bgPanel, c.bgInset]) {
    for (const text of [c.fg, c.fgSecondary, c.fgTertiary, c.accent, c.danger, c.success, c.warning]) expect(ratio(text, ground)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c.focus, ground)).toBeGreaterThanOrEqual(3);
  }
  for (const ground of [c.accent, c.accentHover]) expect(ratio(c.accentFg, ground)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(c.accent, c.accentSoft)).toBeGreaterThanOrEqual(4.5);
  // borderStrong/accentBorder reinforce labelled controls, not their identity;
  // canonical audit.md records the non-contrast-bearing border exception.
});
