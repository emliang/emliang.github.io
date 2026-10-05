async (page) => {
 const browser=page.context().browser();
 const engine=browser.browserType().name();
 const context=await browser.newContext();
 const reader=await context.newPage();
 const reports=[];
 const errors=[];
 reader.on('pageerror',error=>errors.push(error.message));
 const route='http://127.0.0.1:8765/blog/hard-constrained-machine-learning/';
 const groups=[['prediction','.prediction-illustration'],['flow','.flow-illustration'],['roles','.mechanism-map:not(.generation-map)'],['sampler','.sampler-framework'],['generation','.generation-map']];
 for(const width of [360,390,768,1440]){
  await reader.setViewportSize({width,height:width>=768?1600:1000});
  await reader.goto(route,{waitUntil:'load'});
  await reader.evaluate(()=>document.fonts.ready);
  for(const [name,selector] of groups){
   const figure=reader.locator(selector);
   for(const img of await figure.locator('img').all()){
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(el=>el.decode());
   }
   const loaded=await figure.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0));
   const path=`output/playwright/framework-${engine}-${name}-${width}.png`;
   await figure.screenshot({path,style:'.site-header{visibility:hidden!important}'});
   const overflow=await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(!loaded||overflow)throw new Error(`Layout failure at ${width}: ${name}`);
   reports.push({width,name,loaded,overflow,screenshot:path});
  }
 }
 const assets=['neural-network-prediction','flow-generation-general','roles-training','roles-layer','roles-coordinates','roles-post','sampler-framework','generation-training','generation-interventions','coordinates-overview','geometry-overview'];
 const svgChecks=[];
 for(const name of assets){
  await reader.goto(`http://127.0.0.1:8765/assets/img/blog/hard-constrained-ml/${name}.svg`);
  const result=await reader.evaluate(()=>{
   const svg=document.querySelector('svg');
   const bounds=svg.getBoundingClientRect();
   const clipped=[...svg.querySelectorAll('text')].filter(text=>{
    const box=text.getBoundingClientRect();
    return box.left<bounds.left-.5||box.top<bounds.top-.5||box.right>bounds.right+.5||box.bottom>bounds.bottom+.5;
   }).map(text=>text.textContent);
   const theta=[...svg.querySelectorAll('tspan')].filter(span=>span.textContent==='θ');
   return {clipped,thetaSubscripts:theta.length,validSubscripts:theta.every(span=>Number(span.getAttribute('dy'))>0)};
  });
  if(result.clipped.length||!result.validSubscripts)throw new Error(`${name}: ${JSON.stringify(result)}`);
  svgChecks.push({name,...result});
 }
 const noJSContext=await browser.newContext({javaScriptEnabled:false});
 const noJS=await noJSContext.newPage();
 await noJS.setViewportSize({width:390,height:1000});
 await noJS.goto(route,{waitUntil:'load'});
 for(const [,selector] of groups){
  const figure=noJS.locator(selector);
  for(const img of await figure.locator('img').all()){
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(el=>el.decode());
  }
  if(!(await figure.locator('img').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0))))throw new Error('No-JS image failure');
 }
 if(errors.length)throw new Error(errors.join('\n'));
 await noJSContext.close();
 await context.close();
 return {engine,reports,svgChecks,noJS:true,runtimeErrors:errors};
}
