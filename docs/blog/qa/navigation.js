async (page) => {
 const main=['/','/news/','/blog/','/resources/','/blog/hard-constrained-machine-learning/'];
 const extras=['/teaching/','/projects/2_project/','/projects/3_project/','/projects/4_project/','/projects/5_project/','/projects/6_project/'];
 const reports=[];
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:900});
  let baseline;
  const paths=(width===390||width===1440)?[...main,...extras]:main;
  for(const path of paths){
   await page.goto('http://127.0.0.1:8765'+path,{waitUntil:'domcontentloaded'});
   const r=await page.locator('.site-header').evaluate(header=>{
    const props=el=>{const c=getComputedStyle(el);return Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','padding','borderRadius','borderBottom','textDecorationLine'].map(k=>[k,c[k]]));};
    const links=[...header.querySelectorAll('.site-navigation-link')];
    return {headerHeight:header.getBoundingClientRect().height,headerBackground:getComputedStyle(header).backgroundColor,navLeft:header.querySelector('nav').getBoundingClientRect().left,navWidth:header.querySelector('nav').getBoundingClientRect().width,brand:props(header.querySelector('.site-brand')),normal:props(links.find(a=>!a.hasAttribute('aria-current'))),active:props(links.find(a=>a.hasAttribute('aria-current'))),labels:links.map(a=>a.textContent),overflows:links.some(a=>a.getBoundingClientRect().right>innerWidth),position:getComputedStyle(header).position};
   });
   if(!baseline)baseline=JSON.stringify(r);
   if(JSON.stringify(r)!==baseline)throw Error('Navigation differs at '+width+'px on '+path+' '+JSON.stringify(r));
   if(r.overflows)throw Error('Navigation overflows '+path);
   reports.push({width,path,matched:true});
   if(main.includes(path))await page.locator('.site-header').screenshot({path:`output/playwright/nav-${path==='/'?'main':path.includes('hard-constrained')?'article':path.split('/')[1]}-${width}.png`});
  }
 }
 await page.getByRole('link',{name:'Main',exact:true}).click();
 if(page.url()!=='http://127.0.0.1:8765/')throw Error('Main does not return home');
 return {reports,mainDestination:page.url()};
}
