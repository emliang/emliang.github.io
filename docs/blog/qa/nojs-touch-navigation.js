async (page) => {
  const browser = page.context().browser();
  const report = {};
  const staticContext = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:844}});
  const staticPage = await staticContext.newPage();
  await staticPage.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/', {waitUntil:'load'});
  report.noJS = await staticPage.evaluate(() => ({h2:document.querySelectorAll('article h2').length, fallbacks:[...document.querySelectorAll('[data-demo-fallback]')].map(el=>!el.hidden),width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  await staticPage.locator('[data-demo-fallback]').first().scrollIntoViewIfNeeded();
  await staticPage.screenshot({path:'output/playwright/no-js-mobile.png'});
  await staticContext.close();
  const touchContext = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const touchPage = await touchContext.newPage();
  await touchPage.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/', {waitUntil:'load'});
  const mechanism = touchPage.locator('[data-demo="mechanism"]');
  await mechanism.evaluate(el=>el.scrollIntoView({block:'center'}));
  await mechanism.getByRole('button',{name:'Projection',exact:true}).tap();
  const slider=mechanism.getByRole('slider',{name:'Candidate y₁ coordinate',exact:true});
  await slider.tap();
  report.touch = await mechanism.locator('[data-result]').textContent();
  report.reducedMotion = await touchPage.evaluate(()=>({requested:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:document.getAnimations().length,overflow:document.documentElement.scrollWidth>innerWidth}));
  await touchPage.screenshot({path:'output/playwright/touch-mobile.png'});
  await touchContext.close();
  // Local routes and navigation, preserving existing page behavior.
  report.routes=[];
  for (const path of ['/','/news/','/resources/','/blog/']) {
    await page.goto('http://127.0.0.1:8765'+path,{waitUntil:'domcontentloaded'});
    const blogLink=page.locator('nav a[href="/blog/"]').first();
    if (!await blogLink.count()) throw Error('Blog navigation missing on '+path);
    report.routes.push({path,title:await page.title(),blogLink:true});
  }
  await page.getByRole('link',{name:'Read the visual guide',exact:false}).click();
  report.articleNavigation=page.url();
  return report;
}
