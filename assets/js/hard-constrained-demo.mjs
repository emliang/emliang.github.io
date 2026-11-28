/** Analytic illustrations, not trained models or benchmark results. */
import { demoMath } from './hard-constrained-math.mjs?v=20261018.6';
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
  const x = candidate[0] / budget;
  const y = candidate[1] / budget;
  const positiveX = Math.max(x, 0);
  const positiveY = Math.max(y, 0);
  if (positiveX + positiveY <= 1) return [budget * positiveX, budget * positiveY];
  if (x - y >= 1) return [budget, 0];
  if (y - x >= 1) return [0, budget];
  return [budget * (x - y + 1) / 2, budget * (y - x + 1) / 2];
}

/** Exact minimizer of the displayed toy objective, only for y hat = (a, a), 0 <= a <= B. */
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
  const rejectedPreview = [];
  let attempts = 0;
  const cap = capMultiplier * count;
  while (rejectionPoints.length < count && attempts < cap) {
    const point = proposal(rejectionRandom);
    attempts += 1;
    if (point[0] >= 0 && point[1] >= 0 && point[0] + point[1] <= budget) rejectionPoints.push(point);
    else if (rejectedPreview.length < 360) rejectedPreview.push(point);
  }
  const projectionRandom = makeRandom(seed);
  const projectedPoints = [];
  const rawProposals = [];
  const movedFromOutside = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = proposal(projectionRandom);
    const outside = candidate[0] < 0 || candidate[1] < 0 || candidate[0] + candidate[1] > budget;
    rawProposals.push(candidate);
    projectedPoints.push(projection(candidate, budget));
    movedFromOutside.push(outside);
  }
  return {
    seed,
    count,
    budget,
    rejection: {
      points: rejectionPoints,
      rejectedPreview,
      proposals: attempts,
      cap,
      capped: rejectionPoints.length < count,
      acceptance: rejectionPoints.length / attempts,
      ...summarize(rejectionPoints, budget),
    },
    projected: {
      points: projectedPoints,
      rawProposals,
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

function plotVariable(symbol, subscript = null) {
  const base = `<tspan font-family="KaTeX_Math, 'Times New Roman', serif" font-style="italic">${symbol}</tspan>`;
  return subscript === null ? base : `${base}<tspan font-family="KaTeX_Main, 'Times New Roman', serif" font-style="normal" baseline-shift="sub" font-size="70%">${subscript}</tspan>`;
}

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
  if (state.mode === 'penalty') {
    marks += `<line class="hc-guide-line" x1="${toX(0.5)}" y1="${toY(0.5)}" x2="${toX(1)}" y2="${toY(1)}"/>`;
  } else if (state.mode === 'parameterization' && state.b > 0.02) {
    marks += `<line class="hc-param-slice" x1="${toX(state.b)}" y1="${toY(0)}" x2="${toX(0)}" y2="${toY(state.b)}"/>`;
    marks += `<circle cx="${toX(state.b)}" cy="${toY(0)}" r="3" fill="#1f6f6d"/><circle cx="${toX(0)}" cy="${toY(state.b)}" r="3" fill="#1f6f6d"/>`;
    if (state.b >= 0.25) {
      const midX = toX(state.b * 0.5) + 8;
      const midY = toY(state.b * 0.5) - 8;
      marks += `<text class="hc-param-label" x="${midX}" y="${midY}">sum = ${format(state.b, 2)}</text>`;
    }
  }
  if (candidate) {
    marks += `<line class="hc-connection" x1="${toX(candidate[0])}" y1="${toY(candidate[1])}" x2="${toX(output[0])}" y2="${toY(output[1])}"/>`;
    marks += `<circle class="hc-candidate ${state.mode === 'projection' ? 'hc-drag-handle' : ''}" data-candidate cx="${toX(candidate[0])}" cy="${toY(candidate[1])}" r="8"><title>Candidate ${pair(candidate)}. Drag or use the sliders to move it.</title></circle>`;
  }
  const x = toX(output[0]);
  const y = toY(output[1]);
  marks += `<path class="hc-result" d="M ${x} ${y - 6} l 6 6 l -6 6 l -6 -6 Z"><title>Output ${pair(output)}</title></path>`;
  const labelAreas = [];
  const pointLabel = (point, text, offset) => {
    const pointX = toX(point[0]);
    const labelX = pointX + (pointX > 220 ? -12 : 12);
    const pointY = toY(point[1]);
    const labelY = clamp(pointY + (pointY < 42 && offset < 0 ? 24 : offset), 20, 350);
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
  const domainLabels = labelAreas.some(area => area.left < 200 && area.right > 85 && area.top < 271 && area.bottom > 226)
    ? '' : `<text class="hc-domain-label" x="90" y="241">feasible set ${plotVariable('K')}</text><text class="hc-domain-label" x="90" y="263">${plotVariable('y', '1')} + ${plotVariable('y', '2')} ≤ 1</text>`;
  const description = candidate
    ? 'A hollow circle marks a physical candidate and a filled diamond marks the returned output.'
    : 'A filled diamond marks the feasible output decoded from admissible reference coordinates. No physical candidate is being corrected.';
  return {
    output,
    candidate,
    viewBox: '0 0 380 365',
    svg: `<title>Triangle resource-allocation example: ${state.mode}</title><desc>The shaded triangle satisfies nonnegative allocations with total allocation at most one. ${description} Output coordinates and violation are available under Numerical details.</desc>
      <path class="hc-feasible" d="M 68 294 L 288 294 L 68 74 Z"/>
      <path class="hc-axis" d="M 13 294 H 352 M 68 349 V 22"/>
      <path class="hc-tick" d="M 178 289 V 299 M 288 289 V 299 M 63 184 H 73 M 63 74 H 73"/>
      <text class="hc-axis-label" x="352" y="321">${plotVariable('y', '1')}</text><text class="hc-axis-label" x="40" y="24">${plotVariable('y', '2')}</text>
      <text class="hc-tick-label" x="51" y="318">0</text><text class="hc-tick-label" x="178" y="318" text-anchor="middle">0.5</text><text class="hc-tick-label" x="288" y="318" text-anchor="middle">1</text>
      <text class="hc-tick-label" x="51" y="189" text-anchor="end">0.5</text><text class="hc-tick-label" x="51" y="79" text-anchor="end">1</text>
      ${domainLabels}${marks}`,
  };
}

export function mountMechanism(root) {
  const id = `hc-mechanism-${++widgetNumber}`;
  const state = { mode: 'penalty', a: 0.8, lambda: 1, candidate: [0.8, 0.8], b: 0.6, q: 0.7 };
  root.classList.add('hc-demo');
  root.innerHTML = `<div class="hc-toolbar">
      <div class="hc-mode-picker" aria-label="Constraint mechanism">
        <button type="button" data-mode="penalty" aria-pressed="true" aria-controls="${id}-penalty">Penalty</button>
        <button type="button" data-mode="projection" aria-pressed="false" aria-controls="${id}-projection">Projection</button>
        <button type="button" data-mode="parameterization" aria-pressed="false" aria-controls="${id}-parameterization">Parameterization</button>
      </div>
      <button class="hc-button hc-reset" type="button">Reset</button>
    </div>
    <div class="hc-mechanism-layout"><div class="hc-plot-wrap"><svg class="hc-mechanism-plot" viewBox="0 0 380 365" role="img" aria-label="Resource allocation geometry"></svg>
      <p class="hc-legend"><span class="hc-legend-item" data-candidate-key><i class="hc-key-circle" aria-hidden="true"></i>Candidate</span><span class="hc-legend-item"><i class="hc-key-diamond" aria-hidden="true"></i>Output</span></p></div>
    <div class="hc-controls">
      <fieldset id="${id}-penalty" data-panel="penalty"><legend>Symmetric candidate (a, a)</legend>
        <div class="hc-slider-pair">${slider(`${id}-a`, 'Candidate coordinate a', 0, 1, 0.01, state.a, '', 'Candidate a')}
        ${slider(`${id}-lambda`, 'Penalty weight λ', 0, 10, 0.1, state.lambda, '', 'Penalty λ')}</div>
      </fieldset>
      <fieldset id="${id}-projection" data-panel="projection" hidden><legend>Move or drag candidate</legend>
        <div class="hc-slider-pair">${slider(`${id}-c1`, 'Candidate y hat, coordinate 1', -0.25, 1.25, 0.01, state.candidate[0], '', `Candidate ${demoMath.candidate1}`)}
        ${slider(`${id}-c2`, 'Candidate y hat, coordinate 2', -0.25, 1.25, 0.01, state.candidate[1], '', `Candidate ${demoMath.candidate2}`)}</div>
      </fieldset>
      <fieldset id="${id}-parameterization" data-panel="parameterization" hidden><legend>Choose budget and share</legend>
        <div class="hc-slider-pair">${slider(`${id}-b`, 'Budget fraction b', 0, 1, 0.01, state.b, '', 'Budget used b')}
        ${slider(`${id}-q`, 'First-service share q', 0, 1, 0.01, state.q, '', 'Service 1 share q')}</div>
      </fieldset>
      <div class="hc-readout" data-readout aria-live="polite" aria-atomic="true"></div>
      <p class="hc-observation" data-observation aria-live="polite" aria-atomic="true"></p>
    </div></div>
    <div class="demo-preset-bar" aria-label="Comparison presets">
      <span class="demo-preset-label">Presets:</span>
      <button type="button" class="demo-preset-link" data-preset="high-lambda">Penalty λ = 10</button><span class="demo-preset-sep" aria-hidden="true">·</span>
      <button type="button" class="demo-preset-link" data-preset="project-same">Same target → Projection</button><span class="demo-preset-sep" aria-hidden="true">·</span>
      <button type="button" class="demo-preset-link" data-preset="already-feasible">Already feasible</button><span class="demo-preset-sep" aria-hidden="true">·</span>
      <button type="button" class="demo-preset-link" data-preset="full-budget">Full budget split</button>
    </div>
    <details class="hc-details"><summary>Numerical details</summary><p class="hc-control-note" data-result></p><p class="hc-control-note hc-numerical-note">${demoMath.violation}Coordinates are rounded; violation is computed before rounding. Displayed feasibility uses normalized tolerance 10⁻⁹; real-arithmetic formulas explain the construction.</p></details>`;
  const svg = root.querySelector('svg');
  const setValue = (name, value, decimals = 2) => {
    const input = root.querySelector(`#${id}-${name}`);
    input.value = value;
    root.querySelector(`[data-value="${id}-${name}"]`).textContent = format(value, decimals);
  };
  const presets = {
    'high-lambda': () => ({ mode: 'penalty', a: 0.8, lambda: 10 }),
    'project-same': () => ({ mode: 'projection', candidate: [0.8, 0.8] }),
    'already-feasible': () => ({ mode: 'penalty', a: 0.4, lambda: 1 }),
    'full-budget': () => ({ mode: 'parameterization', b: 1.0, q: 0.7 }),
  };
  const syncActivePresets = () => {
    const matches = {
      'high-lambda': state.mode === 'penalty' && Math.abs(state.a - 0.8) < 1e-6 && Math.abs(state.lambda - 10) < 1e-6,
      'project-same': state.mode === 'projection' && Math.abs(state.candidate[0] - 0.8) < 1e-6 && Math.abs(state.candidate[1] - 0.8) < 1e-6,
      'already-feasible': state.mode === 'penalty' && Math.abs(state.a - 0.4) < 1e-6 && Math.abs(state.lambda - 1) < 1e-6,
      'full-budget': state.mode === 'parameterization' && Math.abs(state.b - 1.0) < 1e-6 && Math.abs(state.q - 0.7) < 1e-6,
    };
    for (const button of root.querySelectorAll('[data-preset]')) {
      button.classList.toggle('is-active', Boolean(matches[button.dataset.preset]));
    }
  };
  const render = () => {
    for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    syncActivePresets();
    for (const panel of root.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== state.mode;
    const geometry = mechanismGeometry(state);
    svg.setAttribute('viewBox', geometry.viewBox);
    svg.innerHTML = geometry.svg;
    const residual = violation(geometry.output);
    const feasible = isFeasible(geometry.output);
    const residualShort = residual === 0 ? '0' : (residual < 0.001 ? residual.toExponential(1) : format(residual, 3));
    root.querySelector('[data-readout]').innerHTML = `<span>Output <strong>(${format(geometry.output[0], 2)}, ${format(geometry.output[1], 2)})</strong></span><span class="hc-readout-status ${feasible ? 'is-feasible' : 'is-violated'}">${feasible ? 'Feasible ✓' : `Violation ${residualShort}`}</span>`;
    root.querySelector('[data-result]').textContent = `Output ${pair(geometry.output)} · normalized violation ${residual === 0 ? '0' : residual.toExponential(2)} · ${feasible ? 'feasible within tolerance' : 'outside the feasible set'}`;
    let explanation;
    if (state.mode === 'penalty') {
      if (2 * state.a <= 1) {
        explanation = 'The candidate already fits the budget, so the penalty leaves it unchanged.';
      } else if (state.lambda === 0) {
        explanation = 'At λ = 0, the output stays at the candidate, outside the triangle.';
      } else {
        const excess = residual < 0.001 ? residual.toExponential(1) : format(residual, 3);
        explanation = `The output still exceeds the budget by ${excess} units; increasing λ reduces this excess.`;
      }
    } else if (state.mode === 'projection') {
      const moved = geometry.candidate.some((value, index) => value !== geometry.output[index]);
      explanation = moved
        ? 'Projection moves the candidate to the nearest point in the triangle.'
        : 'The candidate is already feasible, so projection leaves it unchanged.';
    } else {
      if (state.b === 0) {
        explanation = 'With b = 0, both allocations are zero regardless of the share q.';
      } else {
        explanation = 'The coordinates construct a feasible allocation: b sets the total, and q splits it between the two services.';
      }
    }
    root.querySelector('[data-observation]').textContent = explanation;
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
      setValue(name, value, name === 'lambda' ? 1 : 2);
      render();
    });
  }
  root.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    const nextMode = button.dataset.mode;
    if (state.mode === 'penalty' && nextMode === 'projection') {
      state.candidate = [state.a, state.a];
      setValue('c1', state.a);
      setValue('c2', state.a);
    } else if (state.mode === 'projection' && nextMode === 'penalty'
      && state.candidate[0] === state.candidate[1] && state.candidate[0] >= 0 && state.candidate[0] <= 1) {
      state.a = state.candidate[0];
      setValue('a', state.a);
    }
    state.mode = nextMode;
    render();
  }));
  root.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const next = presets[button.dataset.preset]?.();
    if (!next) return;
    if (next.mode) state.mode = next.mode;
    if (next.a !== undefined) { state.a = next.a; setValue('a', next.a); }
    if (next.lambda !== undefined) { state.lambda = next.lambda; setValue('lambda', next.lambda, 1); }
    if (next.candidate) {
      state.candidate = [...next.candidate];
      setValue('c1', next.candidate[0]);
      setValue('c2', next.candidate[1]);
    }
    if (next.b !== undefined) { state.b = next.b; setValue('b', next.b); }
    if (next.q !== undefined) { state.q = next.q; setValue('q', next.q); }
    render();
  }));
  root.querySelector('.hc-reset').addEventListener('click', () => {
    Object.assign(state, { mode: 'penalty', a: 0.8, lambda: 1, candidate: [0.8, 0.8], b: 0.6, q: 0.7 });
    for (const [name, value] of Object.entries({ a: 0.8, lambda: 1, c1: 0.8, c2: 0.8, b: 0.6, q: 0.7 })) setValue(name, value, name === 'lambda' ? 1 : 2);
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
  setValue('lambda', state.lambda, 1);
  hideFallback(root);
  root.dataset.demoMounted = 'true';
}

function generationPlot(points, moved, label, options = {}) {
  const { view = 'feasible', rawProposals = null, rejectedPreview = null } = options;
  const isProposal = view === 'proposal';
  const toX = isProposal ? value => 173 + 125 * value : value => 48 + 250 * value;
  const toY = isProposal ? value => 157 - 125 * value : value => 282 - 250 * value;
  const mean = summarize(points, 1).mean;
  const groups = new Map();
  points.forEach((point, index) => {
    const boundary = Boolean(moved?.[index]);
    const key = `${point[0]},${point[1]},${boundary}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { point, boundary, count: 1 });
  });
  const baseR = isProposal ? 1.35 : 1.8;
  const dots = [...groups.values()].sort((a, b) => b.count - a.count).map(({ point, boundary, count }) => {
    const radius = baseR * Math.sqrt(count);
    return `<circle class="${boundary ? 'hc-sample-boundary' : 'hc-sample-interior'}${count > 1 ? ' hc-sample-stack' : ''}" cx="${toX(point[0])}" cy="${toY(point[1])}" r="${radius}" data-count="${count}"><title>${count} sample${count === 1 ? '' : 's'} at (${point[0]}, ${point[1]})</title></circle>`;
  }).join('');
  const meanMark = mean ? `<path class="hc-sample-mean" d="M ${toX(mean[0]) - 5} ${toY(mean[1]) - 5} l 10 10 M ${toX(mean[0]) - 5} ${toY(mean[1]) + 5} l 10 -10"/>` : '';
  if (isProposal) {
    let extras = `<rect class="hc-proposal-box" x="48" y="32" width="250" height="250"/>`;
    if (rejectedPreview) {
      extras += rejectedPreview.map(pt => `<circle class="hc-rejected-dot" cx="${toX(pt[0])}" cy="${toY(pt[1])}" r="1.4"/>`).join('');
    }
    if (rawProposals && moved) {
      extras += `<rect class="hc-origin-quad" x="48" y="157" width="125" height="125"/>`;
      let drawn = 0;
      for (let i = 0; i < rawProposals.length && drawn < 52; i += 1) {
        if (!moved[i]) continue;
        extras += `<line class="hc-proj-arrow" x1="${toX(rawProposals[i][0])}" y1="${toY(rawProposals[i][1])}" x2="${toX(points[i][0])}" y2="${toY(points[i][1])}"/>`;
        drawn += 1;
      }
      extras += `<text class="hc-quad-label" x="110" y="224" text-anchor="middle">1/4 → (0, 0)</text>`;
    }
    return `<title>${label}: full proposal domain [-1, 1]²</title><desc>Full uniform proposal square [-1, 1]² around the triangular feasible set K. ${rawProposals ? 'The shaded third quadrant [-1, 0]² collapses onto the origin (0, 0).' : 'Gray dots outside K are rejected proposals.'}</desc>
      ${extras}
      <path class="hc-feasible" d="M 173 157 L 298 157 L 173 32 Z"/>
      <path class="hc-axis" d="M 38 157 H 316 M 173 292 V 16"/>
      <path class="hc-tick" d="M 48 277 V 287 M 173 277 V 287 M 298 277 V 287 M 43 282 H 53 M 43 157 H 53 M 43 32 H 53"/>
      <text class="hc-axis-label" x="320" y="162">${plotVariable('y', '1')}</text><text class="hc-axis-label" x="182" y="22">${plotVariable('y', '2')}</text>
      <text class="hc-tick-label" x="48" y="307" text-anchor="middle">−1</text><text class="hc-tick-label" x="173" y="307" text-anchor="middle">0</text><text class="hc-tick-label" x="298" y="307" text-anchor="middle">1</text>
      <text class="hc-tick-label" x="33" y="287" text-anchor="end">−1</text><text class="hc-tick-label" x="33" y="162" text-anchor="end">0</text><text class="hc-tick-label" x="33" y="37" text-anchor="end">1</text>
      ${dots}<circle class="hc-target-mean" cx="${toX(1 / 3)}" cy="${toY(1 / 3)}" r="5"/>${meanMark}`;
  }
  return `<title>${label}: returned samples</title><desc>Samples inside the triangular feasible set. Teal circles show retained samples; terracotta circles show candidates moved to the boundary. Circle area counts exactly coincident samples; no locations are shifted. The cross marks the sample mean and the hollow ring marks the conditional target mean at one third in both coordinates.</desc>
    <path class="hc-feasible" d="M 48 282 L 298 282 L 48 32 Z"/><path class="hc-axis" d="M 37 282 H 320 M 48 295 V 12"/>
    <path class="hc-tick" d="M 173 277 V 287 M 298 277 V 287 M 43 157 H 53 M 43 32 H 53"/>
    <text class="hc-axis-label" x="320" y="308">${plotVariable('y', '1')}</text><text class="hc-axis-label" x="58" y="22">${plotVariable('y', '2')}</text>
    <text class="hc-tick-label" x="15" y="307">0</text><text class="hc-tick-label" x="173" y="307" text-anchor="middle">0.5</text><text class="hc-tick-label" x="298" y="307" text-anchor="middle">1</text>
    <text class="hc-tick-label" x="33" y="162" text-anchor="end">0.5</text><text class="hc-tick-label" x="33" y="37" text-anchor="end">1</text>
    ${dots}<circle class="hc-target-mean" cx="${toX(1 / 3)}" cy="${toY(1 / 3)}" r="6"/>${meanMark}`;
}

export function mountGeneration(root) {
  let seed = DEFAULT_SEED;
  let view = 'feasible';
  root.classList.add('hc-demo');
  root.innerHTML = `<div class="hc-toolbar">
      <div class="hc-mode-picker" aria-label="Plot zoom view">
        <button type="button" data-gen-view="feasible" aria-pressed="true">Feasible set K</button>
        <button type="button" data-gen-view="proposal" aria-pressed="false">Proposal square [−1, 1]²</button>
      </div>
      <div class="hc-actions"><button class="hc-button" data-resample type="button">Resample</button><button class="hc-button" data-reset type="button">Reset</button></div>
    </div>
    <div class="hc-generation-layout"><figure><figcaption>Rejection sampling</figcaption><svg viewBox="0 0 345 325" role="img" aria-label="Rejection samples" data-rejection-plot></svg><p class="hc-cloud-note" data-rejection-note></p></figure><figure><figcaption>Euclidean projection</figcaption><svg viewBox="0 0 345 325" role="img" aria-label="Projected samples" data-projection-plot></svg><p class="hc-cloud-note" data-projection-note></p></figure></div>
    <p class="hc-legend hc-generation-legend"><span class="hc-legend-item"><i class="hc-key-dot" aria-hidden="true"></i>Retained sample</span><span class="hc-legend-item"><i class="hc-key-boundary" aria-hidden="true"></i>Moved to boundary</span><span class="hc-legend-item"><i class="hc-key-stack" aria-hidden="true"></i>Area ∝ coincident count</span><span class="hc-legend-item"><i class="hc-key-cross" aria-hidden="true">×</i>Sample mean</span><span class="hc-legend-item"><i class="hc-key-ring" aria-hidden="true"></i>Target mean</span></p>
    <div class="hc-gen-summary" data-gen-summary aria-live="polite" aria-atomic="true"></div>
    <p class="hc-result-line" data-generation-warning aria-live="polite" hidden></p>
    <details class="hc-details"><summary>Sample statistics &amp; analytic reference</summary>
    <div class="hc-table-wrap"><table class="hc-sample-table"><caption>Measured values; validity uses tolerance 10⁻⁹.</caption><colgroup><col class="hc-col-method"><col class="hc-col-proposals"><col class="hc-col-valid"><col class="hc-col-mean"></colgroup><thead><tr><th scope="col">Method</th><th scope="col" title="Number of candidate proposals">Draws</th><th scope="col">Returned / valid</th><th scope="col">Mean (y₁, y₂)</th></tr></thead><tbody data-sample-rows></tbody></table></div>
    <p class="hc-result-line" data-generation-status aria-live="polite" aria-atomic="true"></p>
    <p class="hc-theory-note">The continuous target has zero boundary mass; projection puts 7/8 on the boundary, including 1/4 at the origin. These are analytic values, rather than sample measurements.</p>
    <p class="hc-control-note">Population rejection acceptance = 1/8. Target mean = (1/3, 1/3); projected mean = (11/48, 11/48). This synthetic illustration runs no model training. Mulberry32, seed <span data-seed></span>. Both methods start with the same proposal stream. Rejection has a cap of 64 × 512 candidates and reports any partial return.</p></details>`;
  const render = () => {
    for (const button of root.querySelectorAll('[data-gen-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.genView === view));
    }
    const result = sampleGeneration({ seed });
    root.querySelector('[data-rejection-plot]').innerHTML = generationPlot(result.rejection.points, null, 'Rejection sampling', { view, rejectedPreview: result.rejection.rejectedPreview });
    root.querySelector('[data-projection-plot]').innerHTML = generationPlot(result.projected.points, result.projected.movedFromOutside, 'Euclidean projection', { view, rawProposals: result.projected.rawProposals });
    root.querySelector('[data-rejection-note]').textContent = `${result.rejection.returned} kept from ${result.rejection.proposals.toLocaleString('en-US')} proposals`;
    root.querySelector('[data-projection-note]').textContent = `${result.projected.originCount} / ${result.projected.returned} samples coincide at (0, 0)`;
    const boundaryPct = percent(result.projected.movedToBoundary / result.projected.returned);
    const originPct = percent(result.projected.originCount / result.projected.returned);
    root.querySelector('[data-gen-summary]').innerHTML = `<div><strong>Rejection:</strong> <span class="is-teal">${percent(result.rejection.acceptance)}</span> acceptance (analytic 12.5%), mean ${pair(result.rejection.mean)}</div><div><strong>Projection:</strong> <span class="is-brick">${boundaryPct}</span> on boundary (origin ${originPct}), mean ${pair(result.projected.mean)}</div>`;
    root.querySelector('[data-sample-rows]').innerHTML = `<tr><th scope="row">Rejection</th><td>${result.rejection.proposals.toLocaleString('en-US')}</td><td>${result.rejection.returned} / ${result.rejection.valid}</td><td>${pair(result.rejection.mean)}</td></tr><tr><th scope="row">Projection</th><td>${result.projected.proposals}</td><td>${result.projected.returned} / ${result.projected.valid}</td><td>${pair(result.projected.mean)}</td></tr>`;
    const capText = result.rejection.capped ? ` Rejection reached its ${result.rejection.cap} candidate cap and returned only ${result.rejection.returned} samples.` : '';
    root.querySelector('[data-generation-status]').textContent = `Measured acceptance: ${percent(result.rejection.acceptance)}. Projection moved ${result.projected.movedToBoundary} / ${result.projected.returned} outside candidates to the boundary (${boundaryPct}).${capText}`;
    root.querySelector('[data-generation-warning]').textContent = capText.trim();
    root.querySelector('[data-generation-warning]').hidden = !result.rejection.capped;
    root.querySelector('[data-seed]').textContent = seed;
  };
  root.querySelectorAll('[data-gen-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.genView;
    render();
  }));
  root.querySelector('[data-resample]').addEventListener('click', () => { seed = (seed + 1) >>> 0; render(); });
  root.querySelector('[data-reset]').addEventListener('click', () => { seed = DEFAULT_SEED; view = 'feasible'; render(); });
  render();
  hideFallback(root);
  root.dataset.demoMounted = 'true';
}

/* Analytic 1D monotone flow transport for Figure 04: N(0, 1) -> symmetric bimodal mixture. */
function erfApprox(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(z, mu = 0, sigma = 1) { return 0.5 * (1 + erfApprox((z - mu) / (sigma * Math.SQRT2))); }
function normalPdf(z, mu = 0, sigma = 1) {
  const d = (z - mu) / sigma;
  return Math.exp(-0.5 * d * d) / (sigma * Math.sqrt(2 * Math.PI));
}
function targetCdf(z) { return 0.5 * normalCdf(z, -1.35, 0.48) + 0.5 * normalCdf(z, 1.35, 0.48); }
function targetPdf(z) { return 0.5 * normalPdf(z, -1.35, 0.48) + 0.5 * normalPdf(z, 1.35, 0.48); }
function invertCdf(cdf, u) {
  let lo = -4;
  let hi = 4;
  for (let i = 0; i < 40; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (cdf(mid) < u) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function mountFlowTransport(root) {
  const id = `hc-flow-${++widgetNumber}`;
  const count = 15;
  const trackedIdx = 10;
  const paths = Array.from({ length: count }, (_, i) => {
    const u = (i + 0.5) / count;
    return { z0: invertCdf(z => normalCdf(z, 0, 1), u), z1: invertCdf(targetCdf, u) };
  });
  const toX = t => 104 + 392 * t;
  const toY = z => 147 - 35 * z;
  const ease = t => t * t * (3 - 2 * t);
  const posAt = (path, t) => (1 - ease(t)) * path.z0 + ease(t) * path.z1;

  const densityPath = (pdfFn, baseX, dir) => {
    const pts = [];
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const z = -2.85 + (5.7 * i) / steps;
      const x = baseX + dir * pdfFn(z) * 145;
      pts.push(`${x.toFixed(1)},${toY(z).toFixed(1)}`);
    }
    return `M ${baseX},${toY(-2.85).toFixed(1)} L ${pts.join(' L ')} L ${baseX},${toY(2.85).toFixed(1)} Z`;
  };
  const curvePath = path => {
    const pts = [];
    for (let i = 0; i <= 32; i += 1) {
      const t = i / 32;
      pts.push(`${toX(t).toFixed(1)},${toY(posAt(path, t)).toFixed(1)}`);
    }
    return `M ${pts.join(' L ')}`;
  };
  const staticBg = `
    <path d="${densityPath(z => normalPdf(z, 0, 1), 104, -1)}" fill="#eef3f9" stroke="#1b4d89" stroke-width="1.6"/>
    <path d="${densityPath(targetPdf, 496, 1)}" fill="#ebf4f3" stroke="#1f6f6d" stroke-width="1.6"/>
    <line x1="104" y1="36" x2="104" y2="258" stroke="#c8c8c4" stroke-width="1.1"/>
    <line x1="496" y1="36" x2="496" y2="258" stroke="#c8c8c4" stroke-width="1.1"/>
    ${paths.map((p, i) => i === trackedIdx ? '' : `<path d="${curvePath(p)}" fill="none" stroke="#9eb3b2" stroke-width="1.2" opacity="0.72"/>`).join('')}
    <path d="${curvePath(paths[trackedIdx])}" fill="none" stroke="#a84a32" stroke-width="2.2"/>
    <text x="104" y="278" text-anchor="middle" font-size="13" fill="#1b4d89" font-weight="500">Prior p₀ (t = 0)</text>
    <text x="300" y="278" text-anchor="middle" font-size="12.5" fill="#5c5c5c">Generation time t →</text>
    <text x="496" y="278" text-anchor="middle" font-size="13" fill="#1f6f6d" font-weight="500">Target p₁ (t = 1)</text>
  `;

  let currentT = 0.5;
  let playing = false;
  let rafId = 0;
  let lastTs = 0;

  root.classList.add('hc-demo');
  root.innerHTML = `<div class="hc-flow-toolbar">
      <div class="hc-actions">
        <button class="hc-button" type="button" data-flow-play>Play</button>
        <button class="hc-button" type="button" data-flow-reset>Reset</button>
      </div>
      <label class="hc-flow-scrubber" for="${id}-t"><span>Time</span><input id="${id}-t" type="range" min="0" max="1" step="0.01" value="0.50" aria-label="Generation time t"><output for="${id}-t" data-flow-t>t = 0.50</output></label>
    </div>
    <svg class="hc-flow-svg" viewBox="0 0 600 294" role="img" aria-label="Interactive flow transport from a normal prior to a bimodal target"></svg>`;

  const svg = root.querySelector('svg');
  const playBtn = root.querySelector('[data-flow-play]');
  const sliderEl = root.querySelector(`#${id}-t`);
  const outEl = root.querySelector('[data-flow-t]');

  const render = () => {
    const cx = toX(currentT);
    const trackedY = toY(posAt(paths[trackedIdx], currentT));
    const particles = paths.map((p, i) => {
      if (i === trackedIdx) return '';
      return `<circle cx="${cx.toFixed(1)}" cy="${toY(posAt(p, currentT)).toFixed(1)}" r="3.1" fill="#1f6f6d" opacity="0.72"/>`;
    }).join('');
    const labelAnchor = currentT > 0.84 ? 'end' : 'start';
    const labelDx = currentT > 0.84 ? -11 : 11;
    svg.innerHTML = `<title>Flow transport at generation time t = ${currentT.toFixed(2)}</title>
      ${staticBg}
      <line x1="${cx.toFixed(1)}" y1="30" x2="${cx.toFixed(1)}" y2="258" stroke="#5c5c5c" stroke-width="1.1" stroke-dasharray="4 3"/>
      <text x="${cx.toFixed(1)}" y="21" text-anchor="middle" font-size="12" fill="#141414" font-weight="600">t = ${currentT.toFixed(2)}</text>
      ${particles}
      <circle cx="${cx.toFixed(1)}" cy="${trackedY.toFixed(1)}" r="5.5" fill="#a84a32" stroke="#ffffff" stroke-width="1.8"/>
      <text class="hc-point-label" x="${(cx + labelDx).toFixed(1)}" y="${(trackedY - 8).toFixed(1)}" text-anchor="${labelAnchor}" style="fill:#a84a32;font-size:14px;">${plotVariable('z', 't')}</text>`;
    sliderEl.value = currentT.toFixed(2);
    outEl.textContent = `t = ${currentT.toFixed(2)}`;
    playBtn.textContent = playing ? 'Pause' : 'Play';
  };

  const stop = () => {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    render();
  };
  const step = ts => {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    currentT += dt * 0.28;
    if (currentT >= 1) {
      currentT = 1;
      stop();
      return;
    }
    render();
    rafId = requestAnimationFrame(step);
  };

  playBtn.addEventListener('click', () => {
    if (playing) { stop(); return; }
    if (currentT >= 0.99) currentT = 0;
    playing = true;
    lastTs = 0;
    render();
    rafId = requestAnimationFrame(step);
  });
  root.querySelector('[data-flow-reset]').addEventListener('click', () => {
    currentT = 0.5;
    stop();
  });
  sliderEl.addEventListener('input', event => {
    currentT = Number(event.target.value);
    if (playing) stop();
    else render();
  });

  render();
  hideFallback(root);
  root.dataset.demoMounted = 'true';
}

/** Mount only when visible, and preserve the static figure if enhancement fails. */
export function initializeDemos(documentRoot = document) {
  const widgets = documentRoot.querySelectorAll('[data-demo="mechanism"], [data-demo="generation"], [data-demo="flow-transport"]');
  const mount = root => {
    if (root.dataset.demoMounted === 'true') return;
    try {
      if (root.dataset.demo === 'mechanism') mountMechanism(root);
      else if (root.dataset.demo === 'flow-transport') mountFlowTransport(root);
      else mountGeneration(root);
    } catch (error) {
      root.replaceChildren();
      root.classList.remove('hc-demo');
      console.warn('Hard-constrained illustration could not be enhanced.', error);
    }
  };
  if (typeof IntersectionObserver === 'undefined') {
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
