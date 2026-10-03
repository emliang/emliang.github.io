async (page) => {
 const context=await page.context().browser().newContext();
 const reader=await context.newPage(), errors=[],reports=[];
 const route='http://127.0.0.1:8765/blog/homeomorphism-methods/';
 reader.on('pageerror',e=>errors.push(e.message));
 try {
  for(const width of [360,390,768,1440]) {
   await reader.setViewportSize({width,height:1000});
   await reader.goto(route,{waitUntil:'load'});await reader.evaluate(()=>document.fonts.ready);
   await reader.locator('[data-hm-explorer]').waitFor({state:'visible'});
   const math=await reader.evaluate(()=>({count:document.querySelectorAll('[data-tex]').length,rendered:document.querySelectorAll('[data-tex]>.katex,[data-tex]>.katex-display').length,errors:document.querySelectorAll('.katex-error').length,overflow:[...document.querySelectorAll('.hm-equation')].some(e=>e.scrollWidth>e.clientWidth+1)}));
   if(math.count!==56||math.rendered!==56||math.errors||math.overflow)throw new Error(JSON.stringify(math));
   for(const img of await reader.locator('article img').all()) {await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}
   const overflow=await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const missingAnchors=await reader.locator('.article-toc a').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));
   if(overflow||missingAnchors.length)throw new Error(JSON.stringify({width,overflow,missingAnchors}));
   for(const [name,selector] of [['header','.article-header'],['opening','#coordinates'],['explorer','[data-hm-explorer]'],['learning','#learning'],['optimization','#optimization'],['sampling','#sampling'],['references','#references']]) {
    const screenshot=`output/playwright/homeomorphism-${name}-${width}.png`;
    await reader.locator(selector).screenshot({path:screenshot,style:'.site-header{visibility:hidden!important}'});reports.push({width,name,screenshot});
   }
   const r=reader.locator('[data-hm-radius]'),a=reader.locator('[data-hm-angle]');
   await r.focus();await r.press('Home');
   if(!(await reader.locator('[data-hm-status]').innerText()).includes('x = (0.000, 0.000)'))throw new Error('Origin mismatch');
   await r.press('End');await a.focus();await a.press('Home');
   await reader.locator('[data-hm-shape]').selectOption('star');
   if(!(await reader.locator('[data-hm-status]').innerText()).includes('x = (1.250, 0.000). On the boundary.'))throw new Error('Star endpoint mismatch');
  }
  const clipped=[];
  for(const name of ['reference','mapped','samples-reference','samples-mapped','share']){
   await reader.goto(`http://127.0.0.1:8765/assets/img/blog/homeomorphism-methods/${name}.svg`);
   await reader.evaluate(()=>document.fonts.ready);
   const labels=await reader.evaluate(()=>{const svg=document.querySelector('svg'),b=svg.getBoundingClientRect();return [...svg.querySelectorAll('text')].filter(el=>{const r=el.getBoundingClientRect();return r.left<b.left-.5||r.right>b.right+.5||r.top<b.top-.5||r.bottom>b.bottom+.5;}).map(el=>el.textContent);});
   if(labels.length)clipped.push({name,labels});
  }
  if(clipped.length)throw new Error(JSON.stringify(clipped));
  await reader.setViewportSize({width:1200,height:630});
  await reader.goto('http://127.0.0.1:8765/assets/img/blog/homeomorphism-methods/share.svg');
  await reader.locator('svg').screenshot({path:'assets/img/blog/homeomorphism-methods/share.png'});
  await reader.setViewportSize({width:390,height:1000});await reader.goto('http://127.0.0.1:8765/blog/');
  if(await reader.locator('a[href="/blog/homeomorphism-methods/"]').count()!==3)throw new Error('Index links');
  await reader.locator('.blog-feature').first().screenshot({path:'output/playwright/homeomorphism-index-390.png',style:'.site-header{visibility:hidden!important}'});
  if(await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Index overflow');
  const noJSContext=await page.context().browser().newContext({javaScriptEnabled:false});
  try {const p=await noJSContext.newPage();await p.setViewportSize({width:390,height:1000});await p.goto(route);if(await p.locator('[data-hm-explorer]').isVisible())throw new Error('Empty demo in no-JS mode');for(const img of await p.locator('article img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());}if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('No-JS overflow');}finally{await noJSContext.close();}
  if(errors.length)throw new Error(errors.join('\n'));
  return {engine:page.context().browser().browserType().name(),reports,keyboardEndpoints:true,shapeSwitch:true,clippedSVGLabels:clipped,noJS:true,indexLinks:true,pageErrors:errors};
 } finally {await context.close();}
}
