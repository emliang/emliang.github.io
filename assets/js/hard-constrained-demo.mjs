/** Analytic illustrations, not trained models or benchmark results. */
import { demoMath } from './hard-constrained-math.mjs';
export const DEFAULT_SEED = 20261003;
export const DEFAULT_COUNT = 512;
export const NUMERICAL_TOLERANCE = 1e-9;
export const GENERATION_THEORY = Object.freeze({
  acceptance: 1 / 8,
  boundaryMass: 7 / 8,
  originMass: 1 / 4,
  conditionalMean: 1 / 3,
  projectedMean: 11 / 48,
});

function positiveBudget(budget) {
  if (!Number.isFinite(budget) || budget <= 0) throw new RangeError('Budget must be finite and positive.');
}

function finitePair(point) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
    throw new TypeError('A point must contain two finite coordinates.');
  }
}

export function violation(point, budget = 1) {
  positiveBudget(budget);
  finitePair(point);
  return Math.max(0, -point[0] / budget, -point[1] / budget, (point[0] + point[1]) / budget - 1);
}

export function isFeasible(point, budget = 1, tolerance = NUMERICAL_TOLERANCE) {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('Tolerance must be finite and nonnegative.');
  return violation(point, budget) <= tolerance;
}

/** Euclidean projection onto {y >= 0, y1 + y2 <= budget}. */
export function projection(candidate, budget = 1) {
  positiveBudget(budget);
  finitePair(candidate);
  // Normalize first so tests and residuals use the same units for every budget.
  const x = candidate[0] / budget;
  const y = candidate[1] / budget;
  const positiveX = Math.max(x, 0);
  const positiveY = Math.max(y, 0);
  if (positiveX + positiveY <= 1) return [budget * positiveX, budget * positiveY];
  if (x - y >= 1) return [budget, 0];
  if (y - x >= 1) return [0, budget];
  return [budget * (x - y + 1) / 2, budget * (y - x + 1) / 2];
}

/** Exact minimizer of the displayed toy objective, only for c = (a, a), 0 <= a <= B. */
export function penalty(a, lambda, budget = 1) {
  positiveBudget(budget);
  if (!Number.isFinite(a) || a < 0 || a > budget) throw new RangeError('The diagonal candidate must satisfy 0 <= a <= budget.');
  if (!Number.isFinite(lambda) || lambda < 0) throw new RangeError('Penalty weight must be finite and nonnegative.');
  const coordinate = 2 * a <= budget ? a : budget / 2 + (a - budget / 2) / (1 + 2 * lambda);
  return [coordinate, coordinate];
}

/** Admissible barycentric controls, not an unconstrained physical candidate. */
export function parameterize(b, q, budget = 1) {
  positiveBudget(budget);
  if (![b, q].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new RangeError('Reference coordinates must lie in [0, 1].');
  }
  return [budget * b * q, budget * b * (1 - q)];
}

/** Mulberry32: deterministic uint32 state and an output in [0, 1). */
export function makeRandom(seed = DEFAULT_SEED) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be a uint32 integer.');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function summarize(points, budget) {
  const mean = points.length ? points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map(value => value / points.length) : null;
  return {
    returned: points.length,
    valid: points.filter(point => isFeasible(point, budget)).length,
    mean,
  };
}

/** Both methods start from the same seeded proposal stream, with separate candidate budgets. */
export function sampleGeneration({ seed = DEFAULT_SEED, count = DEFAULT_COUNT, budget = 1, capMultiplier = 64 } = {}) {
  positiveBudget(budget);
  if (!Number.isInteger(count) || count < 1 || count > 100000) throw new RangeError('Sample count must be an integer from 1 to 100000.');
  if (!Number.isInteger(capMultiplier) || capMultiplier < 1 || capMultiplier > 1000) throw new RangeError('Cap multiplier must be an integer from 1 to 1000.');
  const proposal = random => [budget * (2 * random() - 1), budget * (2 * random() - 1)];
  const rejectionRandom = makeRandom(seed);
  const rejectionPoints = [];
  let attempts = 0;
  const cap = capMultiplier * count;
  while (rejectionPoints.length < count && attempts < cap) {
    const point = proposal(rejectionRandom);
    attempts += 1;
    // Membership is exact here: do not admit a numerical boundary band into the conditional sampler.
    if (point[0] >= 0 && point[1] >= 0 && point[0] + point[1] <= budget) rejectionPoints.push(point);
  }
  const projectionRandom = makeRandom(seed);
  const projectedPoints = [];
  const movedFromOutside = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = proposal(projectionRandom);
    const outside = candidate[0] < 0 || candidate[1] < 0 || candidate[0] + candidate[1] > budget;
    projectedPoints.push(projection(candidate, budget));
    // For this closed convex triangle, every outside point projects to its boundary.
    // Track this source event, rather than estimating boundary mass with an epsilon band.
    movedFromOutside.push(outside);
  }
  return {
    seed,
    count,
    budget,
    rejection: {
      points: rejectionPoints,
      proposals: attempts,
      cap,
      capped: rejectionPoints.length < count,
      acceptance: rejectionPoints.length / attempts,
      ...summarize(rejectionPoints, budget),
    },
    projected: {
      points: projectedPoints,
      movedFromOutside,
      proposals: count,
      movedToBoundary: movedFromOutside.filter(Boolean).length,
      originCount: projectedPoints.filter(point => point[0] === 0 && point[1] === 0).length,
      ...summarize(projectedPoints, budget),
    },
  };
}

const format = (value, decimals = 3) => Number(value).toFixed(decimals);
const percent = value => `${format(100 * value, 1)}%`;
const pair = point => point ? `(${format(point[0])}, ${format(point[1])})` : 'No samples';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
let widgetNumber = 0;

function hideFallback(root) {
  const siblings = [root.previousElementSibling, root.nextElementSibling];
  for (const sibling of siblings) {
    if (sibling?.matches('[data-demo-fallback]')) sibling.hidden = true;
  }
}

function slider(id, name, min, max, step, value, suffix = '', shortName = name) {
  return `<label class="hc-control" for="${id}"><span>${shortName}</span><output for="${id}" data-value="${id}">${format(value, 2)}${suffix}</output><input id="${id}" type="range" aria-label="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

const MECHANISM_PLOT = Object.freeze({ originX: 68, originY: 294, unit: 220 });

function mechanismGeometry(state) {
  const toX = value => MECHANISM_PLOT.originX + MECHANISM_PLOT.unit * value;
  const toY = value => MECHANISM_PLOT.originY - MECHANISM_PLOT.unit * value;
  let output;
  let candidate = null;
  if (state.mode === 'penalty') {
    candidate = [state.a, state.a];
    output = penalty(state.a, state.lambda);
  } else if (state.mode === 'projection') {
    candidate = state.candidate;
    output = projection(candidate);
  } else output = parameterize(state.b, state.q);
  let marks = '';
  if (candidate) {
    marks += `<line class="hc-connection" x1="${toX(candidate[0])}" y1="${toY(candidate[1])}" x2="${toX(output[0])}" y2="${toY(output[1])}"/>`;
    marks += `<circle class="hc-candidate ${state.mode === 'projection' ? 'hc-drag-handle' : ''}" data-candidate cx="${toX(candidate[0])}" cy="${toY(candidate[1])}" r="8"><title>Candidate ${pair(candidate)}. Use the coordinate sliders below to move it.</title></circle>`;
  }
  const x = toX(output[0]);
  const y = toY(output[1]);
  marks += `<path class="hc-result" d="M ${x} ${y - 6} l 6 6 l -6 6 l -6 -6 Z"><title>Output ${pair(output)}</title></path>`;
  const labelAreas = [];
  const pointLabel = (point, text, offset) => {
    const pointX = toX(point[0]);
    const labelX = pointX + (pointX > 220 ? -12 : 12);
    const labelY = clamp(toY(point[1]) + offset, 20, 350);
    const labelWidth = text.length * 8;
    labelAreas.push({ left: pointX > 220 ? labelX - labelWidth : labelX, right: pointX > 220 ? labelX : labelX + labelWidth, top: labelY - 15, bottom: labelY + 3 });
    return `<text class="hc-point-label" x="${labelX}" y="${labelY}" text-anchor="${pointX > 220 ? 'end' : 'start'}">${text}</text>`;
  };
  if (candidate && Math.hypot(toX(candidate[0]) - x, toY(candidate[1]) - y) < 18) {
    const coincident = candidate[0] === output[0] && candidate[1] === output[1];
    marks += pointLabel(output, coincident ? 'candidate = output' : 'candidate & output', -15);
  } else {
    if (candidate) marks += pointLabel(candidate, 'candidate', -15);
    marks += pointLabel(output, candidate ? 'output' : 'feasible output', output[1] < 0.12 ? -15 : 22);
  }
  // The set remains shaded; omit its redundant interior text when moving point labels need that space.
  const domainLabels = labelAreas.some(area => area.left < 200 && area.right > 85 && area.top < 271 && area.bottom > 226)
    ? '' : '<text class="hc-domain-label" x="90" y="241">feasible set K</text><text class="hc-domain-label" x="90" y="263">y₁ + y₂ ≤ 1</text>';
  const description = candidate
    ? 'A hollow circle marks a physical candidate and a filled diamond marks the returned output.'
    : 'A filled diamond marks the feasible output decoded from admissible reference coordinates. No physical candidate is being corrected.';
  return {
    output,
    candidate,
    viewBox: state.mode === 'projection' ? '0 0 380 365' : '0 0 380 330',
    svg: `<title>Triangle resource-allocation example: ${state.mode}</title><desc>The shaded triangle satisfies nonnegative allocations with total allocation at most one. ${description} Coordinate values and violation are also given below.</desc>
      <path class="hc-feasible" d="M 68 294 L 288 294 L 68 74 Z"/>
      <path class="hc-axis" d="M ${state.mode === 'projection' ? 13 : 57} 294 H 352 M 68 ${state.mode === 'projection' ? 349 : 303} V 22"/>
      <path class="hc-tick" d="M 178 289 V 299 M 288 289 V 299 M 63 184 H 73 M 63 74 H 73"/>
      <text class="hc-axis-label" x="352" y="321">y₁</text><text class="hc-axis-label" x="40" y="24">y₂</text>
      <text class="hc-tick-label" x="51" y="318">0</text><text class="hc-tick-label" x="178" y="318" text-anchor="middle">0.5</text><text class="hc-tick-label" x="288" y="318" text-anchor="middle">1</text>
      <text class="hc-tick-label" x="51" y="189" text-anchor="end">0.5</text><text class="hc-tick-label" x="51" y="79" text-anchor="end">1</text>
      ${domainLabels}${marks}`,
  };
}

export function mountMechanism(root) {
  const id = `hc-mechanism-${++widgetNumber}`;
  const state = { mode: 'penalty', a: 0.8, lambda: 1, candidate: [0.8, 0.8], b: 1, q: 0.5, role: 'post' };
  root.classList.add('hc-demo');
  root.innerHTML = `<div class="hc-demo-heading"><p class="hc-demo-kicker">Explore the mechanism · Budget = 1</p><button class="hc-button hc-reset" type="button">Reset</button></div>
    <div class="hc-mode-picker" aria-label="Constraint mechanism">
      <button type="button" data-mode="penalty" aria-pressed="true" aria-controls="${id}-penalty">Penalty</button>
      <button type="button" data-mode="projection" aria-pressed="false" aria-controls="${id}-projection">Projection</button>
      <button type="button" data-mode="parameterization" aria-pressed="false" aria-controls="${id}-parameterization">Parameterization</button>
    </div>
    <div class="hc-mechanism-layout"><div class="hc-plot-wrap"><p class="hc-plot-units">Both axes: allocation / budget</p><svg class="hc-mechanism-plot" viewBox="0 0 380 365" role="img" aria-label="Resource allocation geometry"></svg>
      <p class="hc-legend"><span class="hc-legend-item" data-candidate-key><i class="hc-key-circle" aria-hidden="true"></i>Candidate</span><span class="hc-legend-item"><i class="hc-key-diamond" aria-hidden="true"></i>Output</span></p>
      <p class="hc-result-line" data-result aria-live="polite" aria-atomic="true"></p></div>
    <div class="hc-controls">
      <fieldset id="${id}-penalty" data-panel="penalty"><legend>Penalty on a diagonal slice</legend><p class="hc-formula">${demoMath.penalty}</p>
        <div class="hc-slider-pair">${slider(`${id}-a`, 'Candidate coordinate a', 0, 1, 0.01, state.a, '', 'Candidate a')}
        ${slider(`${id}-lambda`, 'Penalty weight λ', 0, 100, 1, state.lambda, '', 'Penalty λ')}</div>
        <p class="hc-control-note">The displayed point solves this quadratic objective exactly for the selected weight.</p>
      </fieldset>
      <fieldset id="${id}-projection" data-panel="projection" hidden><legend>Full two-dimensional projection</legend><p class="hc-formula">${demoMath.projection}</p>
        <div class="hc-slider-pair">${slider(`${id}-c1`, 'Candidate y₁ coordinate', -0.25, 1.25, 0.01, state.candidate[0], '', 'Candidate y₁')}
        ${slider(`${id}-c2`, 'Candidate y₂ coordinate', -0.25, 1.25, 0.01, state.candidate[1], '', 'Candidate y₂')}</div>
        <label class="hc-select-label" for="${id}-role">Where is projection used?<select id="${id}-role"><option value="post">Post-processing at deployment</option><option value="layer">Structured layer in training</option></select></label>
        <p class="hc-control-note">Use the sliders or drag the hollow circle. Both roles return the same forward output.</p>
      </fieldset>
      <fieldset id="${id}-parameterization" data-panel="parameterization" hidden><legend>Admissible reference coordinates</legend><p class="hc-formula">${demoMath.parameterization}</p>
        <div class="hc-slider-pair">${slider(`${id}-b`, 'Budget fraction b', 0, 1, 0.01, state.b, '', 'Budget used b')}
        ${slider(`${id}-q`, 'First-service share q', 0, 1, 0.01, state.q, '', 'First share q')}</div>
        <p class="hc-control-note">Bounded reference coordinates construct the output, including the boundary. No physical candidate is corrected.</p>
      </fieldset>
    </div></div>
    <div class="hc-flow" data-flow></div>
    <details class="hc-details"><summary>Numerical details</summary><p class="hc-control-note hc-numerical-note">${demoMath.violation}Displayed feasibility uses normalized tolerance 10⁻⁹; real-arithmetic formulas explain the construction.</p></details>`;
  const svg = root.querySelector('svg');
  const setValue = (name, value, decimals = 2) => {
    const input = root.querySelector(`#${id}-${name}`);
    input.value = value;
    root.querySelector(`[data-value="${id}-${name}"]`).textContent = format(value, decimals);
  };
  const render = () => {
    for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    for (const panel of root.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== state.mode;
    const geometry = mechanismGeometry(state);
    svg.setAttribute('viewBox', geometry.viewBox);
    svg.innerHTML = geometry.svg;
    const residual = violation(geometry.output);
    const candidateText = geometry.candidate ? `Candidate ${pair(geometry.candidate)} → ` : 'Decoded ';
    root.querySelector('[data-result]').textContent = `${candidateText}output ${pair(geometry.output)}. Violation ${residual === 0 ? '0' : residual.toExponential(2)}; ${isFeasible(geometry.output) ? 'feasible within tolerance' : 'outside the feasible set'}.`;
    const flow = root.querySelector('[data-flow]');
    if (state.mode === 'penalty') flow.innerHTML = '<span>Task loss + violation penalty → learning</span><span class="hc-flow-secondary">At deployment: model → direct prediction</span>';
    else if (state.mode === 'parameterization') flow.innerHTML = `<span>Coordinates (b, q) → feasible decoder → output y</span><span class="hc-flow-secondary">Weights (unused, y₁, y₂) = ${format(1 - state.b, 2)}, ${format(state.b * state.q, 2)}, ${format(state.b * (1 - state.q), 2)}</span>`;
    else if (state.role === 'layer') flow.innerHTML = '<span>Model → candidate → projection → output → task loss</span><span class="hc-flow-secondary">Training signal ← projection ← task loss <em>(a chosen backward rule; no training is run)</em></span>';
    else flow.innerHTML = '<span>Model → candidate → projection → output</span><span class="hc-flow-secondary">Deployment correction; training does not pass through this operation.</span>';
    root.querySelector('[data-candidate-key]').hidden = state.mode === 'parameterization';
  };
  const bindings = {
    a: value => { state.a = value; },
    lambda: value => { state.lambda = value; },
    c1: value => { state.candidate[0] = value; },
    c2: value => { state.candidate[1] = value; },
    b: value => { state.b = value; },
    q: value => { state.q = value; },
  };
  for (const [name, update] of Object.entries(bindings)) {
    root.querySelector(`#${id}-${name}`).addEventListener('input', event => {
      const value = Number(event.target.value);
      update(value);
      setValue(name, value, name === 'lambda' ? 0 : 2);
      render();
    });
  }
  root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; render(); }));
  root.querySelector(`#${id}-role`).addEventListener('change', event => { state.role = event.target.value; render(); });
  root.querySelector('.hc-reset').addEventListener('click', () => {
    Object.assign(state, { mode: 'penalty', a: 0.8, lambda: 1, candidate: [0.8, 0.8], b: 1, q: 0.5, role: 'post' });
    for (const [name, value] of Object.entries({ a: 0.8, lambda: 1, c1: 0.8, c2: 0.8, b: 1, q: 0.5 })) setValue(name, value, name === 'lambda' ? 0 : 2);
    root.querySelector(`#${id}-role`).value = 'post';
    render();
  });
  let dragPointer = null;
  svg.addEventListener('pointerdown', event => {
    if (state.mode !== 'projection' || !event.target.closest('[data-candidate]')) return;
    dragPointer = event.pointerId;
    svg.setPointerCapture(dragPointer);
    event.preventDefault();
  });
  svg.addEventListener('pointermove', event => {
    if (dragPointer !== event.pointerId) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const coordinate = point.matrixTransform(svg.getScreenCTM().inverse());
    state.candidate = [clamp((coordinate.x - MECHANISM_PLOT.originX) / MECHANISM_PLOT.unit, -0.25, 1.25), clamp((MECHANISM_PLOT.originY - coordinate.y) / MECHANISM_PLOT.unit, -0.25, 1.25)]
      .map(value => Math.round(value * 100) / 100);
    setValue('c1', state.candidate[0]);
    setValue('c2', state.candidate[1]);
    render();
  });
  const finishDrag = () => { dragPointer = null; };
  svg.addEventListener('pointerup', finishDrag);
  svg.addEventListener('pointercancel', finishDrag);
  svg.addEventListener('lostpointercapture', finishDrag);
  render();
  setValue('lambda', state.lambda, 0);
  hideFallback(root);
  root.dataset.demoMounted = 'true';
}

function generationPlot(points, moved, label) {
  const toX = value => 48 + 250 * value;
  const toY = value => 282 - 250 * value;
  const mean = summarize(points, 1).mean;
  // Combine exact coincidences without moving any sample. Marker area counts samples.
  const groups = new Map();
  points.forEach((point, index) => {
    const boundary = Boolean(moved?.[index]);
    const key = `${point[0]},${point[1]},${boundary}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { point, boundary, count: 1 });
  });
  const dots = [...groups.values()].sort((a, b) => b.count - a.count).map(({ point, boundary, count }) => {
    const radius = 1.8 * Math.sqrt(count);
    return `<circle class="${boundary ? 'hc-sample-boundary' : 'hc-sample-interior'}${count > 1 ? ' hc-sample-stack' : ''}" cx="${toX(point[0])}" cy="${toY(point[1])}" r="${radius}" data-count="${count}"><title>${count} sample${count === 1 ? '' : 's'} at (${point[0]}, ${point[1]})</title></circle>`;
  }).join('');
  const meanMark = mean ? `<path class="hc-sample-mean" d="M ${toX(mean[0]) - 5} ${toY(mean[1]) - 5} l 10 10 M ${toX(mean[0]) - 5} ${toY(mean[1]) + 5} l 10 -10"/>` : '';
  return `<title>${label}: returned samples</title><desc>Samples inside the triangular feasible set. Teal circles show retained samples; copper circles show candidates moved to the boundary. Circle area counts exactly coincident samples; no locations are shifted. The cross marks the sample mean and the hollow ring marks the conditional target mean at one third in both coordinates.</desc>
    <path class="hc-feasible" d="M 48 282 L 298 282 L 48 32 Z"/><path class="hc-axis" d="M 37 282 H 320 M 48 295 V 18"/>
    <path class="hc-tick" d="M 173 277 V 287 M 298 277 V 287 M 43 157 H 53 M 43 32 H 53"/>
    <text class="hc-axis-label" x="320" y="308">y₁</text><text class="hc-axis-label" x="19" y="22">y₂</text>
    <text class="hc-tick-label" x="15" y="307">0</text><text class="hc-tick-label" x="173" y="307" text-anchor="middle">0.5</text><text class="hc-tick-label" x="298" y="307" text-anchor="middle">1</text>
    <text class="hc-tick-label" x="33" y="162" text-anchor="end">0.5</text><text class="hc-tick-label" x="33" y="37" text-anchor="end">1</text>
    ${dots}<circle class="hc-target-mean" cx="${toX(1 / 3)}" cy="${toY(1 / 3)}" r="6"/>${meanMark}`;
}

export function mountGeneration(root) {
  let seed = DEFAULT_SEED;
  root.classList.add('hc-demo');
  root.innerHTML = `<div class="hc-demo-heading"><p class="hc-demo-kicker">Explore the returned distribution · Budget = 1</p><div class="hc-actions"><button class="hc-button" data-resample type="button">Resample</button><button class="hc-button" data-reset type="button">Reset</button></div></div>
    <p class="hc-generation-setup">Proposals: uniform on [−1, 1]². Target: uniform in K. Both methods request 512 outputs; the two plots use identical scales.</p>
    <p class="hc-plot-units">Both axes: allocation / budget</p>
    <div class="hc-generation-layout"><figure><figcaption>Rejection sampling</figcaption><svg viewBox="0 0 345 325" role="img" aria-label="Rejection samples" data-rejection-plot></svg><p class="hc-cloud-note" data-rejection-note></p></figure><figure><figcaption>Euclidean projection</figcaption><svg viewBox="0 0 345 325" role="img" aria-label="Projected samples" data-projection-plot></svg><p class="hc-cloud-note" data-projection-note></p></figure></div>
    <p class="hc-legend hc-generation-legend"><span class="hc-legend-item"><i class="hc-key-dot" aria-hidden="true"></i>Retained sample</span><span class="hc-legend-item"><i class="hc-key-boundary" aria-hidden="true"></i>Moved to boundary</span><span class="hc-legend-item"><i class="hc-key-cross" aria-hidden="true">×</i>Sample mean</span><span class="hc-legend-item"><i class="hc-key-ring" aria-hidden="true"></i>Target mean</span></p>
    <p class="hc-marker-note">Circle area = sample count at the same location. No jitter.</p>
    <p class="hc-takeaway">Projection adds boundary mass; rejection samples the uniform interior.</p>
    <p class="hc-result-line" data-generation-warning aria-live="polite" hidden></p>
    <details class="hc-details"><summary>Sample statistics &amp; analytic reference</summary>
    <div class="hc-table-wrap"><table class="hc-sample-table"><caption>Measured values; validity uses tolerance 10⁻⁹.</caption><colgroup><col class="hc-col-method"><col class="hc-col-proposals"><col class="hc-col-valid"><col class="hc-col-mean"></colgroup><thead><tr><th scope="col">Method</th><th scope="col" title="Number of candidate proposals">Draws</th><th scope="col">Returned / valid</th><th scope="col">Mean (y₁, y₂)</th></tr></thead><tbody data-sample-rows></tbody></table></div>
    <p class="hc-result-line" data-generation-status aria-live="polite" aria-atomic="true"></p>
    <p class="hc-theory-note">The continuous target has zero boundary mass; projection puts 7/8 on the boundary, including 1/4 at the origin. These are analytic values, rather than sample measurements.</p>
    <p class="hc-control-note">Population rejection acceptance = 1/8. Target mean = (1/3, 1/3); projected mean = (11/48, 11/48). This synthetic illustration runs no model training. Mulberry32, seed <span data-seed></span>. Both methods start with the same proposal stream. Rejection has a cap of 64 × 512 candidates and reports any partial return.</p></details>`;
  const render = () => {
    const result = sampleGeneration({ seed });
    root.querySelector('[data-rejection-plot]').innerHTML = generationPlot(result.rejection.points, null, 'Rejection sampling');
    root.querySelector('[data-projection-plot]').innerHTML = generationPlot(result.projected.points, result.projected.movedFromOutside, 'Euclidean projection');
    root.querySelector('[data-rejection-note]').textContent = `${result.rejection.returned} kept from ${result.rejection.proposals.toLocaleString('en-US')} proposals`;
    root.querySelector('[data-projection-note]').textContent = `${result.projected.originCount} / ${result.projected.returned} overlap exactly at (0, 0); no jitter`;
    root.querySelector('[data-sample-rows]').innerHTML = `<tr><th scope="row">Rejection</th><td>${result.rejection.proposals.toLocaleString('en-US')}</td><td>${result.rejection.returned} / ${result.rejection.valid}</td><td>${pair(result.rejection.mean)}</td></tr><tr><th scope="row">Projection</th><td>${result.projected.proposals}</td><td>${result.projected.returned} / ${result.projected.valid}</td><td>${pair(result.projected.mean)}</td></tr>`;
    const capText = result.rejection.capped ? ` Rejection reached its ${result.rejection.cap} candidate cap and returned only ${result.rejection.returned} samples.` : '';
    root.querySelector('[data-generation-status]').textContent = `Measured acceptance: ${percent(result.rejection.acceptance)}. Projection moved ${result.projected.movedToBoundary} / ${result.projected.returned} outside candidates to the boundary (${percent(result.projected.movedToBoundary / result.projected.returned)}).${capText}`;
    root.querySelector('[data-generation-warning]').textContent = capText.trim();
    root.querySelector('[data-generation-warning]').hidden = !result.rejection.capped;
    root.querySelector('[data-seed]').textContent = seed;
  };
  root.querySelector('[data-resample]').addEventListener('click', () => { seed = (seed + 1) >>> 0; render(); });
  root.querySelector('[data-reset]').addEventListener('click', () => { seed = DEFAULT_SEED; render(); });
  render();
  hideFallback(root);
  root.dataset.demoMounted = 'true';
}

/** Mount only when visible, and preserve the static figure if enhancement fails. */
export function initializeDemos(documentRoot = document) {
  const widgets = documentRoot.querySelectorAll('[data-demo="mechanism"], [data-demo="generation"]');
  const mount = root => {
    if (root.dataset.demoMounted === 'true') return;
    try {
      if (root.dataset.demo === 'mechanism') mountMechanism(root);
      else mountGeneration(root);
    } catch (error) {
      root.replaceChildren();
      root.classList.remove('hc-demo');
      // Do not hide the fallback or leave unusable controls visible.
      console.warn('Hard-constrained illustration could not be enhanced.', error);
    }
  };
  if (typeof IntersectionObserver === 'undefined') {
    // Older browsers retain the useful static figure; they do not compute invisible demos.
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      mount(entry.target);
    }
  }, { threshold: 0 });
  widgets.forEach(root => observer.observe(root));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeDemos(), { once: true });
  else initializeDemos();
}
