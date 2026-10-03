// Exact toy radial maps used only to explain coordinate correspondence.
export function boundaryRadius(angle, shape = 'convex') {
  if (!Number.isFinite(angle)) throw new RangeError('Finite direction required');
  if (shape === 'convex') return ((Math.cos(angle) / 1.18) ** 4 + (Math.sin(angle) / 0.82) ** 4) ** -0.25;
  if (shape === 'star') return 1 + 0.25 * Math.cos(3 * angle);
  throw new RangeError('Unknown analytic shape');
}
export function forward(point, shape = 'convex') {
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Finite coordinates required');
  const angle = Math.atan2(y, x), scale = boundaryRadius(angle, shape);
  return [x * scale, y * scale];
}
export function inverse(point, shape = 'convex') {
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Finite coordinates required');
  const angle = Math.atan2(y, x), scale = boundaryRadius(angle, shape);
  return [x / scale, y / scale];
}
const NS = 'http://www.w3.org/2000/svg';
function element(tag, attributes, text) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
function chart(svg, mapped, shape, r, angle) {
  const center = [240, 173], scale = 106;
  const pixel = point => [center[0] + scale * point[0], center[1] - scale * point[1]];
  const polar = (radius, direction) => {
    const p = [radius * Math.cos(direction), radius * Math.sin(direction)];
    return pixel(mapped ? forward(p, shape) : p);
  };
  const line = (points, attrs = {}) => element('path', { d: 'M ' + points.map(p => p.join(',')).join(' L '), fill: 'none', stroke: '#c3d4d7', 'stroke-width': 1.2, ...attrs });
  const nodes = [element('text', { x: 240, y: 31, 'text-anchor': 'middle', fill: '#21383c', 'font-size': 23 }, mapped ? 'Mapped decision · K' : 'Reference coordinate · B')];
  nodes.push(line(Array.from({length: 241}, (_,j) => polar(1, 2 * Math.PI * j / 240)), { fill: '#f0f6f4', stroke: mapped ? '#2c6d77' : '#567aa8', 'stroke-width': 2.4 }));
  for (const radius of [.25, .5, .75]) nodes.push(line(Array.from({length: 181},(_,j)=>polar(radius,2 * Math.PI*j/180))));
  for (let j=0;j<12;j++) nodes.push(line([center,polar(1,2*Math.PI*j/12)]));
  const boundary = polar(1,angle), selected = polar(r,angle);
  nodes.push(line([center,boundary], {stroke:'#ae6b4c','stroke-width':2.4}));
  nodes.push(element('circle',{cx:boundary[0],cy:boundary[1],r:4,fill:'white',stroke:'#ae6b4c','stroke-width':1.6}));
  nodes.push(element('circle',{cx:center[0],cy:center[1],r:3,fill:'#21383c'}));
  nodes.push(element('circle',{cx:selected[0],cy:selected[1],r:6,fill:'#ae6b4c',stroke:'white','stroke-width':2}));
  nodes.push(element('text',{x:240,y:326,'text-anchor':'middle',fill:'#607276','font-size':20},r===0?'The centers correspond':r===1?'Boundary maps to boundary':'Same fraction of the selected ray'));
  svg.replaceChildren(...nodes);
  svg.style.fontFamily='Arial,Helvetica,sans-serif';
}
function mount(explorer) {
  const rInput=explorer.querySelector('[data-hm-radius]');
  const angleInput=explorer.querySelector('[data-hm-angle]');
  const shapeInput=explorer.querySelector('[data-hm-shape]');
  function update() {
    const r=Number(rInput.value), degrees=Number(angleInput.value), a=degrees*Math.PI/180, shape=shapeInput.value;
    const z=[r*Math.cos(a),r*Math.sin(a)], x=forward(z,shape);
    explorer.querySelector('[data-hm-radius-label]').value=r.toFixed(2);
    explorer.querySelector('[data-hm-angle-label]').value=`${degrees}°`;
    rInput.setAttribute('aria-valuetext',`${r.toFixed(2)} of the radius`);
    angleInput.setAttribute('aria-valuetext',`${degrees} degrees`);
    chart(explorer.querySelector('[data-hm-ball]'),false,shape,r,a);
    chart(explorer.querySelector('[data-hm-target]'),true,shape,r,a);
    const fmt=p=>`(${p.map(v=>(Math.abs(v)<.0005?0:v).toFixed(3)).join(', ')})`;
    explorer.querySelector('[data-hm-status]').textContent=`z = ${fmt(z)} → x = ${fmt(x)}. ${r===1?'On the boundary.':'Inside the feasible region.'}`;
  }
  for(const input of [rInput,angleInput,shapeInput])input.addEventListener('input',update);
  update();explorer.hidden=false;
}
if(typeof document!=='undefined')for(const explorer of document.querySelectorAll('[data-hm-explorer]'))mount(explorer);
