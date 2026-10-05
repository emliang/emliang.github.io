async (page) => {
 const ctx=await page.context().browser().newContext();
 const engine=page.context().browser().browserType().name();
 const p=await ctx.newPage();
 const names=['allocation-teaser','mechanism-poster','generation-rejection','generation-projection','neural-network-prediction','flow-generation-general','roles-training','roles-layer','roles-coordinates','roles-post','sampler-framework','generation-training','generation-interventions','coordinates-overview','geometry-overview'];
 const reports=[];
 for(const name of names){
  await p.goto('http://127.0.0.1:8765/assets/img/blog/hard-constrained-ml/'+name+'.svg');
  await p.evaluate(()=>document.fonts.ready);
  reports.push({name,...await p.evaluate(()=>{
   const texts=[...document.querySelectorAll('svg text')].map(el=>({el,label:el.textContent,b:el.getBoundingClientRect()}));
   const tt=[];const connectors=[];
   const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
   for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++)if(overlap(texts[i].b,texts[j].b))tt.push([texts[i].label,texts[j].label]);
   for(const el of document.querySelectorAll('svg line,svg path')){
    if(!el.hasAttribute('marker-end')&&!el.hasAttribute('stroke-dasharray'))continue;
    if(el.closest('defs'))continue;
    const total=el.getTotalLength();if(total<4)continue;
    const matrix=el.getScreenCTM();
    for(const item of texts){
     if(item.label==='+')continue;
     let hit=false;
     for(let length=0;length<=total;length+=1){
      const pt=el.getPointAtLength(length).matrixTransform(matrix);
      if(pt.x>item.b.left-2&&pt.x<item.b.right+2&&pt.y>item.b.top-2&&pt.y<item.b.bottom+2){hit=true;break;}
     }
     // Include the arrowhead, not just its shaft. Local endpoint tangent and
     // marker dimensions are transformed into the same rendered coordinates.
     if(!hit&&el.hasAttribute('marker-end')){
      const id=el.getAttribute('marker-end').match(/#([^\)]+)/)[1];
      const marker=document.getElementById(id);
      const stroke=Number(el.getAttribute('stroke-width')||1);
      const factor=marker.getAttribute('markerUnits')==='userSpaceOnUse'?1:stroke;
      const width=Number(marker.getAttribute('markerWidth'))*factor;
      const height=Number(marker.getAttribute('markerHeight'))*factor;
      const end=el.getPointAtLength(total),prev=el.getPointAtLength(Math.max(0,total-1));
      const angle=Math.atan2(end.y-prev.y,end.x-prev.x);
      const points=[[0,0],[-width,-height/2],[-width,height/2]].map(([x,y])=>{
       const local=new DOMPoint(end.x+x*Math.cos(angle)-y*Math.sin(angle),end.y+x*Math.sin(angle)+y*Math.cos(angle));return local.matrixTransform(matrix);
      });
      const b={left:Math.min(...points.map(x=>x.x)),right:Math.max(...points.map(x=>x.x)),top:Math.min(...points.map(x=>x.y)),bottom:Math.max(...points.map(x=>x.y))};
      hit=overlap(item.b,b);
     }
     if(hit)connectors.push({label:item.label,geometry:el.getAttribute('d')||[el.getAttribute('x1'),el.getAttribute('y1'),el.getAttribute('x2'),el.getAttribute('y2')].join(',')});
    }
   }
   return {textPairs:tt,textConnectors:connectors};
  })});
 }
 await ctx.close();
 const collisions=reports.filter(r=>r.textPairs.length||r.textConnectors.length);
 if(collisions.length)throw new Error(JSON.stringify(collisions));
 return {engine,reports,textPairCollisions:0,textConnectorCollisions:0};
}
