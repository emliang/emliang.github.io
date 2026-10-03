async (page) => {
  const context = await page.context().browser().newContext();
  page = await context.newPage();
  const engine = context.browser().browserType().name();
  const reports = [];
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (window.__blogMetrics) return;
    window.__blogMetrics = { cls: 0, lcp: 0 };
    if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__blogMetrics.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) new PerformanceObserver(list => { for (const e of list.getEntries()) window.__blogMetrics.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  for (const width of [360,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/', {waitUntil:'load'});
    await page.screenshot({path:`output/playwright/article-${engine}-${width}.png`});
    const mechanism = page.locator('[data-demo="mechanism"]');
    const generation = page.locator('[data-demo="generation"]');
    await mechanism.evaluate(el => el.scrollIntoView({block:'center'}));
    await mechanism.getByRole('button',{name:'Projection',exact:true}).click();
    const result = mechanism.locator('[data-result]');
    const before = await result.textContent();
    await mechanism.getByRole('combobox').selectOption('layer');
    if (await result.textContent() !== before) throw Error('Projection role changed forward output');
    const coordinate = mechanism.getByRole('slider',{name:'Candidate y₁ coordinate',exact:true});
    await coordinate.focus();
    await page.keyboard.press('Home');
    const keyboardResult = await result.textContent();
    if (!keyboardResult.includes('(-0.250, 0.800)')) throw Error('Keyboard slider failed: '+keyboardResult);
    await mechanism.getByRole('button',{name:'Parameterization',exact:true}).click();
    await mechanism.getByRole('slider',{name:'Budget fraction b',exact:true}).focus();
    await page.keyboard.press('End');
    const paramResult = await result.textContent();
    if (!paramResult.includes('feasible within tolerance')) throw Error('Parameterization boundary UI failed');
    await mechanism.getByRole('button',{name:'Reset',exact:true}).click();
    await generation.evaluate(el => el.scrollIntoView({block:'center'}));
    await generation.getByRole('button',{name:'Reset',exact:true}).click();
    const original = await generation.locator('[data-generation-status]').textContent();
    await generation.getByRole('button',{name:'Resample',exact:true}).focus();
    await page.keyboard.press('Enter');
    const changed = await generation.locator('[data-generation-status]').textContent();
    if (changed === original) throw Error('Resample did not change seed result');
    await generation.getByRole('button',{name:'Reset',exact:true}).click();
    if (await generation.locator('[data-generation-status]').textContent() !== original) throw Error('Reset not reproducible');
    const markers = await generation.locator('[data-projection-plot]').evaluate(svg => {
      const points = [...svg.querySelectorAll('[data-count]')];
      const origin = points.find(p => Number(p.getAttribute('cx')) === 48 && Number(p.getAttribute('cy')) === 282);
      return { total: points.reduce((n, p) => n + Number(p.dataset.count), 0), origin: Number(origin?.dataset.count), originRadius: Number(origin?.getAttribute('r')) };
    });
    if (markers.total !== 512 || markers.origin !== 138 || Math.abs(markers.originRadius ** 2 / 1.8 ** 2 - 138) > 1e-8) throw Error('Aggregated markers lost sample mass: '+JSON.stringify(markers));
    await generation.screenshot({path:`output/playwright/review-generation-${engine}-${width}.png`,style:'.site-header{visibility:hidden!important}'});
    reports.push(await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,metrics:window.__blogMetrics,mounted:[...document.querySelectorAll('[data-demo]')].map(el=>el.dataset.demoMounted),overflowing:[...document.querySelectorAll('main *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,12).map(el=>el.tagName+'.'+el.className)})));
  }
  if (errors.length) throw Error('Article page errors: ' + errors.join('; '));
  for (const report of reports) {
    if (report.scrollWidth > report.width || report.overflowing.length) throw Error('Horizontal overflow at ' + report.width + 'px');
    if (report.mounted.some(value => value !== 'true')) throw Error('Demo failed to mount at ' + report.width + 'px');
  }
  await context.close();
  return {engine, reports, errors};
}
