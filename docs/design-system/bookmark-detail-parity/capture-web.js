async page => {
  // Run through playwright-cli -s=bookmark-detail-parity run-code --filename=... after
  // opening /dev/bookmark?parity=1&theme=light|dark&text=default|large.
  const url = new URL(page.url());
  const theme = url.searchParams.get('theme') || 'light';
  const text = url.searchParams.get('text') || 'default';
  
  await page.setViewportSize({ width: 402, height: 778 });
  await page.clock.setFixedTime(new Date('2026-11-27T12:00:00Z'));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.bookmarkParityReady === '1');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({content: 'nextjs-portal{display:none} *,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.evaluate(({theme,text}) => {
    document.documentElement.classList.remove('dark','light');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
    if (text !== 'large') return;
    // iOS XXXL scales UIFont body from 17 to 23pt. Controls cap at 1.3,
    // matching native's accessibility adapter. This is a web scaling fixture,
    // not browser zoom and not evidence of browser Dynamic Type support.
    const scale = 23 / 17;
    const elements = [...document.querySelectorAll('body *')].filter(el => !el.closest('nextjs-portal') && !(el instanceof SVGElement));
    const sizes = elements.map(el => ({el,font:parseFloat(getComputedStyle(el).fontSize),line:parseFloat(getComputedStyle(el).lineHeight),tracking:parseFloat(getComputedStyle(el).letterSpacing)}));
    for (const {el,font,line,tracking} of sizes) {
      const factor = el.closest('button,[role=radio],nav') ? 1.3 : scale;
      el.style.fontSize = font * factor + 'px';
      if (Number.isFinite(line)) el.style.lineHeight = line * factor + 'px';
      if (Number.isFinite(tracking)) el.style.letterSpacing = tracking * factor + 'px';
    }
  }, {theme,text});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path: `docs/design-system/bookmark-detail-parity/web-${theme}-${text}.png`, scale:'css'});
}
