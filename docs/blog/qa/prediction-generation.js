async (page) => {
  const reports = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const browser = page.context().browser();
  const engine = browser.browserType().name();
  const url = 'http://127.0.0.1:8765/blog/hard-constrained-machine-learning/';
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({width, height:900});
    await page.goto(url);
    await page.addStyleTag({content:'html { scroll-behavior: auto !important; }'});
    if (await page.locator('.article-subtitle').textContent() !== 'From Constrained Prediction to Constrained Generation.') throw Error('Subtitle mismatch');
    const headings = await page.locator('.article-body > section > h2').allTextContents();
    if (headings.length !== 9 || headings.slice(0, 8).some((title, i) => !title.startsWith(`${i + 1}. `))) throw Error('Section numbering mismatch');
    if (headings[4] !== '5. From constrained prediction to constrained generation') throw Error('Standalone section missing');
    const toc = page.locator('.article-toc');
    if (!await toc.evaluate(el => el.open)) await toc.locator('summary').click();
    await toc.locator('a[href="#prediction-to-generation"]').click();
    if (!page.url().endsWith('#prediction-to-generation')) throw Error('TOC anchor failed');
    const section = page.locator('#prediction-to-generation');
    if (await section.locator(':scope > p').count() !== 4) throw Error('Background paragraphs missing');
    await section.locator('h2').evaluate(el => el.scrollIntoView({block:'start'}));
    const state = await page.evaluate(() => ({overflow:document.documentElement.scrollWidth > innerWidth, brokenAnchors:[...document.querySelectorAll('.article-toc a')].filter(a => !document.getElementById(a.hash.slice(1))).length}));
    if (state.overflow || state.brokenAnchors) throw Error('Layout or TOC failure');
    await page.screenshot({path:`output/playwright/prediction-generation-${engine}-${width}.png`});
    reports.push({width, headings:headings.length, ...state});
  }
  const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:390,height:844}});
  const staticPage = await context.newPage();
  await staticPage.goto(url);
  const noJS = await staticPage.evaluate(() => ({sections:document.querySelectorAll('.article-body > section').length, transition:!!document.getElementById('prediction-to-generation'), overflow:document.documentElement.scrollWidth>innerWidth}));
  await context.close();
  if (!noJS.transition || noJS.sections !== 9 || noJS.overflow || errors.length) throw Error('No-JS or runtime failure');
  return {engine, reports, noJS, errors};
}
