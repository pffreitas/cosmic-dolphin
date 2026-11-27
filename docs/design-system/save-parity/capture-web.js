async page => {
  const query = new URL(page.url()).searchParams;
  const theme = query.get('theme') || 'light', text = query.get('text') || 'default';
  const stage = query.get('stage') || 'link';
  await page.setViewportSize({width:402,height:778});
  await page.clock.setFixedTime(new Date('2026-11-26T23:00:00Z'));
  await page.route('**/bookmarks/preview', route => route.fulfill({status:503,contentType:'application/json',body:'{"error":"Fixture preview unavailable"}'}));
  await page.evaluate(theme=>localStorage.setItem('theme',theme),theme);
  await page.reload();
  await page.waitForFunction(theme=>document.documentElement.classList.contains(theme),theme);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'nextjs-portal{display:none} *,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.getByRole('navigation',{name:'Primary, compact'}).getByRole('button',{name:'Save',exact:true}).click();
  if(stage==='private') {
    await page.getByRole('textbox',{name:''}).fill('https://example.com/private');
    await page.getByRole('button',{name:'Behind a login'}).click();
    await page.getByRole('heading',{name:'Save private link'}).waitFor();
  } else if(stage==='invalid') {
    await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
  }
  // Keyboard-closed matched geometry. Focus is exercised separately on native.
  await page.evaluate(()=>document.activeElement?.blur());
  if(text==='large') await page.evaluate(() => {
    const values=[...document.querySelectorAll('body *')].filter(el=>!(el instanceof SVGElement)&&!el.closest('nextjs-portal')).map(el=>({el,font:parseFloat(getComputedStyle(el).fontSize),line:parseFloat(getComputedStyle(el).lineHeight),tracking:parseFloat(getComputedStyle(el).letterSpacing)}));
    for(const {el,font,line,tracking} of values) {
      const factor=el.closest('button,input,[role=radio],nav')?1.3:23/17;
      el.style.fontSize=font*factor+'px';if(Number.isFinite(line))el.style.lineHeight=line*factor+'px';if(Number.isFinite(tracking))el.style.letterSpacing=tracking*factor+'px';
    }
  });
  await page.mouse.move(0,0);
  await page.screenshot({path:`docs/design-system/save-parity/web-${stage}-${theme}-${text}.png`,scale:'css'});
  return await page.getByRole('dialog').evaluate(dialog=>({bounds:dialog.getBoundingClientRect().toJSON(),parts:[...dialog.querySelectorAll('h2,p,input,textarea,button,label')].map(el=>({text:el.textContent||el.placeholder,bounds:el.getBoundingClientRect().toJSON(),font:getComputedStyle(el).fontFamily,fontSize:getComputedStyle(el).fontSize,lineHeight:getComputedStyle(el).lineHeight,background:getComputedStyle(el).backgroundColor}))}));
}
