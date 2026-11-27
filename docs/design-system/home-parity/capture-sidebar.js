async page => {
  const query = new URL(page.url()).searchParams;
  const theme = query.get('theme') || 'light';
  const text = query.get('text') || 'default';
  const nav = query.get('nav') === 'populated' ? 'populated' : 'empty';
  await page.setViewportSize({width:402,height:778});
  await page.clock.setFixedTime(new Date('2026-11-26T23:00:00Z'));
  await page.evaluate(theme=>localStorage.setItem('theme',theme),theme);
  await page.reload();
  await page.waitForFunction(theme=>document.documentElement.classList.contains(theme),theme);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'nextjs-portal{display:none} *,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.getByRole('button',{name:'Open navigation'}).click();
  const scale = async () => {
    if(text !== 'large') return;
    await page.evaluate(() => {
      const entries=[...document.querySelectorAll('body *')].filter(el=>!(el instanceof SVGElement)&&!el.closest('nextjs-portal')&&!el.dataset.parityScaled).map(el=>({el,font:parseFloat(getComputedStyle(el).fontSize),line:parseFloat(getComputedStyle(el).lineHeight),tracking:parseFloat(getComputedStyle(el).letterSpacing)}));
      for(const {el,font,line,tracking} of entries) {
        // Navigation and menu controls cap at 1.3 in the native adapter.
        const factor=el.closest('[role=dialog],[role=menu],button,[role=radio],nav')?1.3:23/17;
        el.dataset.parityScaled='true';el.style.fontSize=font*factor+'px';
        if(Number.isFinite(line))el.style.lineHeight=line*factor+'px';
        if(Number.isFinite(tracking))el.style.letterSpacing=tracking*factor+'px';
      }
    });
  };
  await scale();
  await page.screenshot({path:`docs/design-system/home-parity/web-sidebar-${nav}-${theme}-${text}.png`,scale:'css'});
  await page.getByRole('button',{name:'PF Paulo Freitas reader@example.invalid'}).click();
  await scale();
  await page.screenshot({path:`docs/design-system/home-parity/web-sidebar-account-${nav}-${theme}-${text}.png`,scale:'css'});
  await page.evaluate(({theme,text,nav})=>{
    const dialog=document.querySelector('[role=dialog]'),menu=document.querySelector('[role=menu]');
    window.__sidebarReceipt={theme,text,nav,viewport:{width:innerWidth,height:innerHeight},drawer:dialog.getBoundingClientRect().toJSON(),menu:menu.getBoundingClientRect().toJSON(),font:getComputedStyle(menu).fontFamily,rows:[...dialog.querySelectorAll('nav a')].map(el=>({label:el.textContent,href:el.getAttribute('href'),bounds:el.getBoundingClientRect().toJSON(),fontSize:getComputedStyle(el).fontSize}))};
  },{theme,text,nav});
  return await page.evaluate(()=>window.__sidebarReceipt);
}
