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
  const strokeMain = mapped ? '#1f6f6d' : '#1b4d89';
  const fillSoft = mapped ? '#ebf4f3' : '#eef3f9';
  const gridColor = mapped ? '#bdd8d5' : '#c5d4e6';
  const line = (points, attrs = {}) => element('path', {
    d: 'M ' + points.map(p => p.join(',')).join(' L '),
    fill: 'none',
    stroke: gridColor,
    'stroke-width': 1.1,
    ...attrs,
  });
  const heading = element('text', {
    x: 180,
    y: 26,
    'text-anchor': 'middle',
    fill: strokeMain,
    'font-size': 20,
    'font-weight': 600,
  }, mapped ? 'Mapped decision · ' : 'Reference coordinate · ');
  heading.append(element('tspan', { class: 'hm-svg-symbol', 'font-family': 'KaTeX_Math', 'font-style': 'italic', 'font-weight': 400 }, mapped ? 'K' : 'B'));
  const nodes = [heading];
  nodes.push(line(Array.from({ length: 241 }, (_, j) => polar(1, 2 * Math.PI * j / 240)), {
    fill: fillSoft,
    stroke: strokeMain,
    'stroke-width': 2.2,
  }));
  for (const radius of [0.25, 0.5, 0.75]) {
    nodes.push(line(Array.from({ length: 181 }, (_, j) => polar(radius, 2 * Math.PI * j / 180))));
  }
  for (let j = 0; j < 12; j++) nodes.push(line([CENTER, polar(1, 2 * Math.PI * j / 12)]));
  const boundary = polar(1, angle), selected = polar(r, angle);
  nodes.push(line([CENTER, boundary], { stroke: '#a84a32', 'stroke-width': 2.2 }));
  nodes.push(element('circle', { cx: boundary[0], cy: boundary[1], r: 4, fill: '#ffffff', stroke: '#a84a32', 'stroke-width': 1.8 }));
  nodes.push(element('circle', { cx: CENTER[0], cy: CENTER[1], r: 3, fill: '#141414' }));
  nodes.push(element('circle', { cx: selected[0], cy: selected[1], r: 6.5, fill: '#a84a32', stroke: '#ffffff', 'stroke-width': 2 }));
  svg.replaceChildren(...nodes);
  svg.style.fontFamily = 'inherit';
}
function mount(explorer) {
  const rInput = explorer.querySelector('[data-hm-radius]');
  const angleInput = explorer.querySelector('[data-hm-angle]');
  const shapeInput = explorer.querySelector('[data-hm-shape]');
  const ballSvg = explorer.querySelector('[data-hm-ball]');
  const targetSvg = explorer.querySelector('[data-hm-target]');
  const statusEl = explorer.querySelector('[data-hm-status]');
  const presets = [
    { label: 'Interior (r = 0.50)', shape: 'convex', r: 0.50, angle: 35 },
    { label: 'Boundary (r = 1.00)', shape: 'convex', r: 1.00, angle: 25 },
    { label: 'Star peak (1.25×)', shape: 'star', r: 0.85, angle: 0 },
    { label: 'Star valley (0.75×)', shape: 'star', r: 0.85, angle: 60 },
  ];
  const presetBar = document.createElement('div');
  presetBar.className = 'demo-preset-bar';
  presetBar.setAttribute('aria-label', 'Preset coordinates');
  const presetLabel = document.createElement('span');
  presetLabel.className = 'demo-preset-label';
  presetLabel.textContent = 'Presets:';
  presetBar.append(presetLabel);
  const presetButtons = presets.map((preset, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'demo-preset-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '·';
      presetBar.append(sep);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-preset-link';
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
  if (statusEl) statusEl.after(presetBar);
  function update() {
    const r = Number(rInput.value), degrees = Number(angleInput.value), a = degrees * Math.PI / 180, shape = shapeInput.value;
    const z = [r * Math.cos(a), r * Math.sin(a)], x = forward(z, shape), rayScale = boundaryRadius(a, shape);
    presetButtons.forEach(({ btn, preset }) => {
      const match = preset.shape === shape && Math.abs(preset.r - r) < 0.005 && preset.angle === degrees;
      btn.classList.toggle('is-active', match);
    });
    explorer.querySelector('[data-hm-radius-label]').value = r.toFixed(2);
    explorer.querySelector('[data-hm-angle-label]').value = `${degrees}°`;
    rInput.setAttribute('aria-valuetext', `${r.toFixed(2)} of the radius`);
    angleInput.setAttribute('aria-valuetext', `${degrees} degrees`);
    chart(ballSvg, false, shape, r, a);
    chart(targetSvg, true, shape, r, a);
    const fmt = p => `(${p.map(v => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3)).join(', ')})`;
    const symbol = letter => {
      const label = document.createElement('span');
      label.className = 'hm-status-symbol';
      label.textContent = letter;
      return label;
    };
    statusEl.replaceChildren(
      symbol('z'), document.createTextNode(` = ${fmt(z)} → `),
      symbol('x'), document.createTextNode(` = ${fmt(x)} · `),
      symbol('R'), document.createTextNode('('), symbol('u'),
      document.createTextNode(`) = ${rayScale.toFixed(2)}× · ${r === 1 ? 'On the boundary.' : 'Inside the feasible region.'}`)
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
  for (const input of [rInput, angleInput, shapeInput]) input.addEventListener('input', update);
  update();
  explorer.hidden = false;
}
if (typeof document !== 'undefined') {
  for (const explorer of document.querySelectorAll('[data-hm-explorer]')) mount(explorer);
}
