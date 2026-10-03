async (page) => {
 const context=await page.context().browser().newContext();
 page=await context.newPage();
 const reports=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/',{waitUntil:'load'});
  const items=[['prediction-general','.prediction-illustration'],['flow-general','.flow-illustration'],['teaser','.allocation-teaser'],['atlas','.constraint-atlas'],['role-map','.mechanism-map:not(.generation-map)'],['sampler','.sampler-framework'],['generation-methods','.generation-map']];
  for(const [name,selector] of items){
   const figure=page.locator(selector);
   for(const img of await figure.locator('img').all()){
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(el=>el.decode());
   }
   await figure.screenshot({path:`output/playwright/reader-${name}-${width}.png`,style:'.site-header{visibility:hidden!important}'});
   reports.push({width,name,images:await figure.locator('img').evaluateAll(imgs=>imgs.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,renderedWidth:img.getBoundingClientRect().width})))});
  }
 }
 const staticContext=await page.context().browser().newContext({javaScriptEnabled:false});
 const staticPage=await staticContext.newPage();
 for(const width of [390,1440]){
  await staticPage.setViewportSize({width,height:1000});
  await staticPage.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/');
  for(const [name,selector] of [['static-mechanism','#mechanisms .demo-fallback'],['static-generation','#generation .demo-fallback']]){
   const figure=staticPage.locator(selector);
   for(const img of await figure.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
   await figure.screenshot({path:`output/playwright/reader-${name}-${width}.png`,style:'.site-header{visibility:hidden!important}'});
   reports.push({width,name,noJS:true});
  }
 }
 await staticContext.close();
 await context.close();
 return reports;
}
