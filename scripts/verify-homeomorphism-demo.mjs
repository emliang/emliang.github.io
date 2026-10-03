import assert from 'node:assert/strict';
import {boundaryRadius,forward,inverse} from '../assets/js/homeomorphism-demo.mjs';
let checks=0;
function near(a,b){assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);checks++;}
// Axis endpoints independently known from each domain's definition.
near(boundaryRadius(0,'convex'),1.18);
near(boundaryRadius(Math.PI/2,'convex'),.82);
near(boundaryRadius(0,'star'),1.25);
near(boundaryRadius(Math.PI/3,'star'),.75);
for(const shape of ['convex','star']) {
 for(let j=0;j<96;j++)for(const r of [0,.1,.5,.99,1]) {
  const a=j*Math.PI/48,z=[r*Math.cos(a),r*Math.sin(a)],x=forward(z,shape),back=inverse(x,shape);
  near(z[0],back[0]);near(z[1],back[1]);
  if(shape==='convex')near((x[0]/1.18)**4+(x[1]/.82)**4,r**4);
  else near(Math.hypot(...x),r*(1+.25*Math.cos(3*a)));
 }
}
assert.throws(()=>boundaryRadius(0,'unknown'),RangeError);
assert.throws(()=>forward([NaN,0]),RangeError);
console.log(`Passed ${checks} analytic endpoint, inverse, and domain checks.`);
