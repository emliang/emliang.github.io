async (page) => {
  const reports=[],errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('response', r=>{if(r.url().includes('/assets/vendor/katex-')&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const route='http://127.0.0.1:8765/blog/hard-constrained-machine-learning/';
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:1000});await page.goto(route);
    const mechanism=page.locator('[data-demo="mechanism"]');
    await mechanism.scrollIntoViewIfNeeded();await page.locator('[data-demo="mechanism"][data-demo-mounted="true"]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const math=await page.evaluate(()=>({staticFormulas:document.querySelectorAll('[data-tex]').length,rendered:document.querySelectorAll('article .katex').length,errors:document.querySelectorAll('.katex-error').length,pageOverflow:document.documentElement.scrollWidth>innerWidth,displayOverflow:[...document.querySelectorAll('.blog-equation')].some(e=>e.scrollWidth>e.clientWidth+1)}));
    if(math.staticFormulas!==35||math.rendered!==42||math.errors||math.pageOverflow||math.displayOverflow)throw new Error(JSON.stringify({width,math}));
    for(const [name,selector] of [['feasible-set','#constraints .blog-equation'],['penalty-objective','#penalties .blog-equation'],['inline-coordinates','#mechanisms>p:nth-of-type(5)']]){
      const screenshot=`output/playwright/hard-constrained-math-${name}-${width}.png`;
      await page.locator(selector).screenshot({path:screenshot,style:'.site-header{visibility:hidden!important}'});reports.push({width,name,screenshot});
    }
    for(const mode of ['Penalty','Projection','Parameterization']){
      await mechanism.getByRole('button',{name:mode,exact:true}).click();
      const formula=mechanism.locator('fieldset:not([hidden]) .hc-formula');
      const overflow=await formula.evaluate(el=>[...el.querySelectorAll('.katex-html')].some(m=>m.getBoundingClientRect().right>el.getBoundingClientRect().right+1));
      if(overflow)throw new Error(`Demo formula overflow: ${mode} ${width}`);
      const screenshot=`output/playwright/hard-constrained-math-${mode.toLowerCase()}-${width}.png`;
      await formula.screenshot({path:screenshot});reports.push({width,name:mode,screenshot});
    }
    await mechanism.getByRole('slider',{name:'Budget fraction b',exact:true}).focus();await page.keyboard.press('End');
    if(!(await mechanism.locator('[data-result]').innerText()).includes('feasible within tolerance'))throw new Error('Parameterization endpoint');
    await mechanism.getByRole('button',{name:'Projection',exact:true}).click();
    const before=await mechanism.locator('[data-result]').innerText();await mechanism.getByRole('combobox').selectOption('layer');
    if(await mechanism.locator('[data-result]').innerText()!==before)throw new Error('Projection role changed result');
    await mechanism.getByRole('button',{name:'Reset',exact:true}).click();
    const generation=page.locator('[data-demo="generation"]');await generation.scrollIntoViewIfNeeded();await page.locator('[data-demo="generation"][data-demo-mounted="true"]').waitFor();
    const original=await generation.locator('[data-generation-status]').innerText();await generation.getByRole('button',{name:'Resample',exact:true}).click();
    if(await generation.locator('[data-generation-status]').innerText()===original)throw new Error('Resampling failed');
    await generation.getByRole('button',{name:'Reset',exact:true}).click();if(await generation.locator('[data-generation-status]').innerText()!==original)throw new Error('Reset changed seed');
    await page.goto('http://127.0.0.1:8765/blog/homeomorphism-methods/');await page.evaluate(()=>document.fonts.ready);
    if(await page.locator('.katex').count()!==56||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.hm-equation')].some(e=>e.scrollWidth>e.clientWidth+1)))throw new Error('Shared-style regression');
  }
  const context=await page.context().browser().newContext({javaScriptEnabled:false});
  try{const p=await context.newPage();await p.setViewportSize({width:390,height:1000});await p.goto(route);await p.evaluate(()=>document.fonts.ready);if(await p.locator('article .katex').count()!==35)throw new Error('No-JS static math');}finally{await context.close();}
  if(errors.length)throw new Error(errors.join('\n'));
  return {reports,staticFormulas:35,demoFormulas:7,errors,pageOverflow:false,equationOverflow:false,noJS:true,projectionRoles:true,parameterizationEndpoint:true,generationResampleAndReset:true,homeomorphismRegression:true};
}
