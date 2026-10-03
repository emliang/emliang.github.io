async (page) => {
 const browser=page.context().browser();const records=[];
 for(let run=1;run<=3;run++){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const p=await context.newPage();
  await p.addInitScript(()=>{window.__perf={lcp:0,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perf.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value}).observe({type:'layout-shift',buffered:true});});
  const cdp=await context.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await p.goto('http://127.0.0.1:8765/blog/hard-constrained-machine-learning/',{waitUntil:'networkidle'});
  records.push(await p.evaluate(()=>({lcpMs:window.__perf.lcp,cls:window.__perf.cls,totalBytes:performance.getEntriesByType('resource').reduce((sum,e)=>sum+e.transferSize,0)+performance.getEntriesByType('navigation')[0].transferSize,resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),transfer:e.transferSize}))})));
  await context.close();
 }
 return {records,browser:browser.version()};
}
