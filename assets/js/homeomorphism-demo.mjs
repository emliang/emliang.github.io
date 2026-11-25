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
const CENTER = [180, 156];
const SCALE = 100;
function element(tag, attributes, text) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
function chart(svg, mapped, shape, r, angle) {
  const pixel = point => [CENTER[0] + SCALE * point[0], CENTER[1] - SCALE * point[1]];
  const polar = (radius, direction) => {
    const p = [radius * Math.cos(direction), radius * Math.sin(direction)];
    return pixel(mapped ? forward(p, shape) : p);
  };
  const line = (points, attrs = {}) => element('path', { d: 'M ' + points.map(p => p.join(',')).join(' L '), fill: 'none', stroke: '#c3d4d7', 'stroke-width': 1.2, ...attrs });
  const heading = element('text', { x: 180, y: 27, 'text-anchor': 'middle', fill: mapped ? '#2c6d77' : '#567aa8', 'font-size': 22 }, mapped ? 'Mapped decision · ' : 'Reference coordinate · ');
  heading.append(element('tspan', { class: 'hm-svg-symbol', 'font-family': 'KaTeX_Math', 'font-style': 'italic' }, mapped ? 'K' : 'B'));
  const nodes = [heading];
  nodes.push(line(Array.from({length: 241}, (_,j) => polar(1, 2 * Math.PI * j / 240)), { fill: '#f0f6f4', stroke: mapped ? '#2c6d77' : '#567aa8', 'stroke-width': 2.4 }));
  for (const radius of [.25, .5, .75]) nodes.push(line(Array.from({length: 181},(_,j)=>polar(radius,2 * Math.PI*j/180))));
  for (let j=0;j<12;j++) nodes.push(line([CENTER,polar(1,2*Math.PI*j/12)]));
  const boundary = polar(1,angle), selected = polar(r,angle);
  nodes.push(line([CENTER,boundary], {stroke:'#9b654e','stroke-width':2.4}));
  nodes.push(element('circle',{cx:boundary[0],cy:boundary[1],r:4,fill:'white',stroke:'#9b654e','stroke-width':1.6}));
  nodes.push(element('circle',{cx:CENTER[0],cy:CENTER[1],r:3,fill:'#24363a'}));
  nodes.push(element('circle',{cx:selected[0],cy:selected[1],r:7,fill:'#9b654e',stroke:'white','stroke-width':2}));
  svg.replaceChildren(...nodes);
  svg.style.fontFamily='inherit';
}
function mount(explorer) {
  const rInput=explorer.querySelector('[data-hm-radius]');
  const angleInput=explorer.querySelector('[data-hm-angle]');
  const shapeInput=explorer.querySelector('[data-hm-shape]');
  const ballSvg=explorer.querySelector('[data-hm-ball]');
  const targetSvg=explorer.querySelector('[data-hm-target]');
  const presets = [
    { label: 'Interior (r = 0.50)', shape: 'convex', r: 0.50, angle: 35 },
    { label: 'Boundary (r = 1.00)', shape: 'convex', r: 1.00, angle: 25 },
    { label: 'Star peak (1.25×)', shape: 'star', r: 0.85, angle: 0 },
    { label: 'Star valley (0.75×)', shape: 'star', r: 0.85, angle: 60 },
  ];
  const presetBar = document.createElement('div');
  presetBar.className = 'demo-presets';
  presetBar.setAttribute('aria-label', 'Preset coordinates');
  const presetLabel = document.createElement('span');
  presetLabel.className = 'demo-preset-label';
  presetLabel.textContent = 'Try';
  presetBar.append(presetLabel);
  const presetButtons = presets.map(preset => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-preset-btn';
    btn.textContent = preset.label;
    btn.addEventListener('click', () => {
      shapeInput.value = preset.shape;
      rInput.value = preset.r.toFixed(2);
      angleInput.value = String(preset.angle);
      update();
    });
    presetBar.append(btn);
    return { btn, preset };
  });
  const canvases = explorer.querySelector('.hm-canvases');
  if (canvases) canvases.before(presetBar);
  function update() {
    const r=Number(rInput.value), degrees=Number(angleInput.value), a=degrees*Math.PI/180, shape=shapeInput.value;
    const z=[r*Math.cos(a),r*Math.sin(a)], x=forward(z,shape), rayScale=boundaryRadius(a,shape);
    presetButtons.forEach(({ btn, preset }) => {
      const match = preset.shape === shape && Math.abs(preset.r - r) < 0.005 && preset.angle === degrees;
      btn.classList.toggle('is-active', match);
    });
    explorer.querySelector('[data-hm-radius-label]').value=r.toFixed(2);
    explorer.querySelector('[data-hm-angle-label]').value=`${degrees}°`;
    rInput.setAttribute('aria-valuetext',`${r.toFixed(2)} of the radius`);
    angleInput.setAttribute('aria-valuetext',`${degrees} degrees`);
    chart(ballSvg,false,shape,r,a);
    chart(targetSvg,true,shape,r,a);
    const fmt=p=>`(${p.map(v=>(Math.abs(v)<.0005?0:v).toFixed(3)).join(', ')})`;
    const symbol = letter => {
      const label = document.createElement('span');
      label.className = 'hm-status-symbol';
      label.textContent = letter;
      return label;
    };
    explorer.querySelector('[data-hm-status]').replaceChildren(
      symbol('z'), document.createTextNode(` = ${fmt(z)} → `),
      symbol('x'), document.createTextNode(` = ${fmt(x)} · `),
      symbol('R'), document.createTextNode('('), symbol('u'),
      document.createTextNode(`) = ${rayScale.toFixed(2)}×. ${r===1?'On the boundary.':'Inside the feasible region.'}`)
    );
  }
  function bindPointer(svg, mapped) {
    let active = false;
    const pick = event => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const vx = ((event.clientX - rect.left) / rect.width) * 360;
      const vy = ((event.clientY - rect.top) / rect.height) * 300;
      const pt = [(vx - CENTER[0]) / SCALE, (CENTER[1] - vy) / SCALE];
      const z = mapped ? inverse(pt, shapeInput.value) : pt;
      const r = Math.min(1, Math.hypot(z[0], z[1]));
      const deg = r < 1e-4 ? Number(angleInput.value) : Math.round(((Math.atan2(z[1], z[0]) * 180 / Math.PI) + 360) % 360) % 360;
      rInput.value = (Math.round(r * 100) / 100).toFixed(2);
      angleInput.value = String(deg);
      update();
    };
    svg.addEventListener('pointerdown', event => {
      active = true;
      if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
      pick(event);
    });
    svg.addEventListener('pointermove', event => {
      if (active) pick(event);
    });
    const end = () => { active = false; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }
  bindPointer(ballSvg, false);
  bindPointer(targetSvg, true);
  for(const input of [rInput,angleInput,shapeInput])input.addEventListener('input',update);
  update();explorer.hidden=false;
}
if(typeof document!=='undefined')for(const explorer of document.querySelectorAll('[data-hm-explorer]'))mount(explorer);
