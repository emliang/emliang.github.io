// Unified geometric process animations for Figures 03 (Bisection), 04 (Hom-PGD), and 06 (Gauge Flow Matching).
// All three share the exact 640x256 B <-> K template and semantic palette (#1b4d89 / #1f6f6d / #a84a32).

const NS = 'http://www.w3.org/2000/svg';
const COL = Object.freeze({
  blue: '#1b4d89',
  blueFill: '#eef3f9',
  blueGrid: '#c5d4e6',
  teal: '#1f6f6d',
  tealFill: '#ebf4f3',
  tealGrid: '#bdd8d5',
  brick: '#a84a32',
  brickSoft: '#faefec',
  ink: '#141414',
  body: '#2e2e2e',
  muted: '#5c5c5c',
  white: '#ffffff',
});

const B_CX = 148;
const K_CX = 492;
const CY = 136;
const R_B = 72;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
const ptStr = pts => 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');

function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeMarker(id, fill, size = 7) {
  const m = el('marker', {
    id, viewBox: '0 0 10 10', refX: 8, refY: 5,
    markerWidth: size, markerHeight: size, orient: 'auto',
  });
  m.append(el('path', { d: 'M0 0L10 5L0 10Z', fill }));
  return m;
}

function headingText(x, y, fill, prefix, sym, suffix = '') {
  const t = el('text', { x, y, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 600, fill });
  t.append(document.createTextNode(prefix));
  t.append(el('tspan', { class: 'figure-symbol', 'font-weight': 400 }, sym));
  if (suffix) t.append(document.createTextNode(suffix));
  return t;
}

function boundaryLoop(cx, cy, scale, radiusFn, steps = 180) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    const r = radiusFn(a) * scale;
    pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
  }
  return ptStr(pts) + ' Z';
}

function toB(z) { return [B_CX + R_B * z[0], CY - R_B * z[1]]; }

// =============================================================================
// Shared animation harness: monochrome toolbar + viewport auto-play + Step/Reset
// =============================================================================
function createAnimator(host, spec) {
  const svg = host.querySelector('svg');
  if (!svg) return;
  const reducedMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bar = document.createElement('div');
  bar.className = 'hm-anim-bar';
  const statusEl = document.createElement('p');
  statusEl.className = 'hm-anim-status';
  statusEl.setAttribute('aria-live', 'off');

  const controls = document.createElement('div');
  controls.className = 'hm-anim-controls';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'hm-anim-btn';

  const stepBtn = document.createElement('button');
  stepBtn.type = 'button';
  stepBtn.className = 'hm-anim-btn';
  stepBtn.textContent = 'Step';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'hm-anim-btn';
  resetBtn.textContent = 'Reset';

  controls.append(playBtn, stepBtn, resetBtn);
  bar.append(statusEl, controls);

  const track = document.createElement('div');
  track.className = 'hm-anim-progress';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'hm-anim-progress-fill';
  track.append(fill);

  svg.before(bar, track);

  const totalDur = spec.phaseDurations.reduce((a, b) => a + b, 0);
  const phaseStarts = [];
  let acc = 0;
  for (const d of spec.phaseDurations) {
    phaseStarts.push(acc);
    acc += d;
  }

  let timeMs = reducedMotion ? totalDur - 1 : 0;
  let playing = !reducedMotion;
  let userPaused = reducedMotion;
  let inView = false;
  let rafId = null;
  let lastTs = null;

  function syncButton() {
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(playing));
  }

  function phaseAt(ms) {
    const t = clamp(ms, 0, totalDur);
    for (let i = spec.phaseDurations.length - 1; i >= 0; i--) {
      if (t >= phaseStarts[i]) {
        const local = spec.phaseDurations[i] > 0
          ? clamp((t - phaseStarts[i]) / spec.phaseDurations[i], 0, 1)
          : 1;
        return { phase: i, u: local, norm: totalDur > 0 ? t / totalDur : 1 };
      }
    }
    return { phase: 0, u: 0, norm: 0 };
  }

  function draw() {
    const state = phaseAt(timeMs);
    fill.style.transform = `scaleX(${state.norm.toFixed(4)})`;
    spec.render(svg, statusEl, state.phase, state.u);
  }

  function tick(ts) {
    if (!playing || !inView) {
      rafId = null;
      lastTs = null;
      return;
    }
    if (lastTs !== null) {
      timeMs += Math.min(ts - lastTs, 80);
      if (timeMs >= totalDur) timeMs = 0;
    }
    lastTs = ts;
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (playing && inView && rafId === null) {
      lastTs = null;
      rafId = requestAnimationFrame(tick);
    }
  }

  playBtn.addEventListener('click', () => {
    playing = !playing;
    userPaused = !playing;
    if (playing && timeMs >= totalDur - 10) timeMs = 0;
    syncButton();
    draw();
    ensureLoop();
  });

  stepBtn.addEventListener('click', () => {
    playing = false;
    userPaused = true;
    syncButton();
    const { phase } = phaseAt(timeMs);
    const nextPhase = (phase + 1) % spec.phaseDurations.length;
    timeMs = phaseStarts[nextPhase] + spec.phaseDurations[nextPhase] * 0.92;
    draw();
  });

  resetBtn.addEventListener('click', () => {
    timeMs = 0;
    if (!reducedMotion) {
      playing = true;
      userPaused = false;
    }
    syncButton();
    draw();
    ensureLoop();
  });

  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView && !userPaused && !reducedMotion) {
          playing = true;
          syncButton();
          ensureLoop();
        } else if (!inView && rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
          lastTs = null;
        }
      }
    }, { threshold: 0.15 });
    observer.observe(host);
  } else {
    inView = true;
    ensureLoop();
  }

  syncButton();
  draw();
}

// =============================================================================
// FIGURE 03: Bisection in reference coordinates + constraint verification in K
// =============================================================================
function buildBisectionSpec() {
  const trueR = a => 1.0 + 0.14 * Math.cos(2 * a - 0.4) + 0.08 * Math.sin(3 * a + 0.5);
  const learnedR = a => trueR(a) * (1.0 + 0.11 * Math.cos(a - 0.65));
  const K_SCALE = 64;

  function phi(z) {
    const r = Math.hypot(z[0], z[1]);
    if (r < 1e-9) return [0, 0];
    const a = Math.atan2(z[1], z[0]);
    const aRot = a + 0.34 * Math.min(r, 1.8);
    const R = learnedR(aRot);
    return [r * R * Math.cos(aRot), r * R * Math.sin(aRot)];
  }
  function inTrueK(x) {
    const r = Math.hypot(x[0], x[1]);
    if (r < 1e-9) return true;
    return r <= trueR(Math.atan2(x[1], x[0]));
  }
  const toK = x => [K_CX + K_SCALE * x[0], CY - K_SCALE * x[1]];

  const angle0 = (36 * Math.PI) / 180;
  const rRaw = 1.48;
  const zRaw = [rRaw * Math.cos(angle0), rRaw * Math.sin(angle0)];
  const xRaw = phi(zRaw);

  // Full curved path in K for t in [0, 1]
  const curvePts = Array.from({ length: 61 }, (_, i) => {
    const t = i / 60;
    return toK(phi([t * zRaw[0], t * zRaw[1]]));
  });
  const subCurve = (t0, t1) => {
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const t = lerp(t0, t1, i / 28);
      pts.push(toK(phi([t * zRaw[0], t * zRaw[1]])));
    }
    return ptStr(pts);
  };

  // Precompute 6 real bisection iterations
  const steps = [];
  let lo = 0, hi = 1;
  for (let iter = 1; iter <= 6; iter++) {
    const mid = 0.5 * (lo + hi);
    const zm = [mid * zRaw[0], mid * zRaw[1]];
    const xm = phi(zm);
    const ok = inTrueK(xm);
    const nextLo = ok ? mid : lo;
    const nextHi = ok ? hi : mid;
    steps.push({ iter, lo, hi, mid, zm, xm, ok, nextLo, nextHi });
    lo = nextLo;
    hi = nextHi;
  }
  const finalLo = lo;
  const zFinal = [finalLo * zRaw[0], finalLo * zRaw[1]];
  const xFinal = phi(zFinal);

  const trueKPath = boundaryLoop(K_CX, CY, K_SCALE, trueR);
  const learnedKPath = boundaryLoop(K_CX, CY, K_SCALE, learnedR);
  const pB0 = toB([0, 0]);
  const pBRaw = toB(zRaw);
  const pK0 = toK([0, 0]);
  const pKRaw = toK(xRaw);

  // Phases: 0 = inverse map Φ⁻¹, 1..6 = bisection iters 1..6, 7 = hold converged
  const phaseDurations = [1100, 1150, 1150, 1200, 1050, 1000, 1000, 2200];

  function render(svg, statusEl, phase, u) {
    svg.setAttribute('viewBox', '0 0 640 256');
    const nodes = [];
    const defs = el('defs');
    defs.append(makeMarker('bi-arr-blue', COL.blue, 7));
    defs.append(makeMarker('bi-arr-teal', COL.teal, 7));
    nodes.push(defs);

    nodes.push(headingText(B_CX, 22, COL.blue, 'Reference space · ', 'B'));
    nodes.push(headingText(K_CX, 22, COL.teal, 'Decision space · ', 'K'));

    // Unit ball B & subtle radial grid
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: R_B, fill: COL.blueFill, stroke: COL.blue, 'stroke-width': 2 }));
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: R_B * 0.5, fill: 'none', stroke: COL.blueGrid, 'stroke-width': 1, 'stroke-dasharray': '2 3' }));

    // Decision set K (true boundary solid teal + approximate learned boundary faint dashed)
    nodes.push(el('path', { d: learnedKPath, fill: 'none', stroke: COL.blueGrid, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
    nodes.push(el('path', { d: trueKPath, fill: COL.tealFill, stroke: COL.teal, 'stroke-width': 2 }));

    // Transfer arrows between B and K
    const invActive = phase === 0;
    const fwdActive = phase >= 1 && phase <= 6;
    nodes.push(el('path', {
      d: 'M368 96 Q320 70 272 96', fill: 'none',
      stroke: COL.blue, 'stroke-width': invActive ? 2.6 : 1.5,
      opacity: invActive ? 1 : 0.45, 'marker-end': 'url(#bi-arr-blue)',
    }));
    const invLbl = el('text', { x: 320, y: 68, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': invActive ? 600 : 400, fill: COL.blue, opacity: invActive ? 1 : 0.65 });
    invLbl.append(document.createTextNode('1. '), el('tspan', { class: 'figure-symbol' }, 'Φ'), el('tspan', { 'baseline-shift': 'super', 'font-size': '72%' }, '−1'));
    nodes.push(invLbl);

    nodes.push(el('path', {
      d: 'M272 162 Q320 188 368 162', fill: 'none',
      stroke: COL.teal, 'stroke-width': fwdActive ? 2.6 : 1.5,
      opacity: fwdActive || phase === 7 ? 1 : 0.45, 'marker-end': 'url(#bi-arr-teal)',
    }));
    const fwdLbl = el('text', { x: 320, y: 198, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': fwdActive ? 600 : 400, fill: COL.teal, opacity: fwdActive || phase === 7 ? 1 : 0.65 });
    fwdLbl.append(document.createTextNode('3. '), el('tspan', { class: 'figure-symbol' }, 'Φ'), document.createTextNode(' + check'));
    nodes.push(fwdLbl);

    // Full ray & full curved path (faint reference)
    nodes.push(el('line', { x1: pB0[0], y1: pB0[1], x2: pBRaw[0], y2: pBRaw[1], stroke: COL.brick, 'stroke-width': 1.4, 'stroke-dasharray': '4 3', opacity: phase === 0 ? ease(u) * 0.7 : 0.45 }));
    nodes.push(el('path', { d: ptStr(curvePts), fill: 'none', stroke: COL.brick, 'stroke-width': 1.4, 'stroke-dasharray': '4 3', opacity: 0.45 }));

    // Centers
    nodes.push(el('circle', { cx: pB0[0], cy: pB0[1], r: 3.5, fill: COL.ink }));
    nodes.push(el('text', { x: pB0[0] - 12, y: pB0[1] + 15, 'font-size': 12, fill: COL.body }, '0'));
    nodes.push(el('circle', { cx: pK0[0], cy: pK0[1], r: 3.5, fill: COL.ink }));
    const x0Lbl = el('text', { x: pK0[0] - 16, y: pK0[1] + 16, 'font-size': 12, fill: COL.body });
    x0Lbl.append(el('tspan', { class: 'figure-symbol' }, 'x'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, '0'));
    nodes.push(x0Lbl);

    // Raw infeasible point in K (always visible)
    nodes.push(el('circle', { cx: pKRaw[0], cy: pKRaw[1], r: 5.5, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.8 }));
    const rawKLbl = el('text', { x: pKRaw[0] + 10, y: pKRaw[1] - 4, 'font-size': 12, fill: COL.brick });
    rawKLbl.append(document.createTextNode('raw '), el('tspan', { class: 'figure-symbol' }, 'x'));
    nodes.push(rawKLbl);

    if (phase === 0) {
      // Animate inverse pulse along top arrow & landing at z_raw
      const t = ease(u);
      const bx = (1 - t) * (1 - t) * 368 + 2 * (1 - t) * t * 320 + t * t * 272;
      const by = (1 - t) * (1 - t) * 96 + 2 * (1 - t) * t * 70 + t * t * 96;
      nodes.push(el('circle', { cx: bx, cy: by, r: 4.5, fill: COL.blue, stroke: COL.white, 'stroke-width': 1.5 }));
      if (u > 0.35) {
        const a = clamp((u - 0.35) / 0.4, 0, 1);
        nodes.push(el('circle', { cx: pBRaw[0], cy: pBRaw[1], r: 5.5, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.8, opacity: a }));
        const rawZLbl = el('text', { x: pBRaw[0] - 12, y: pBRaw[1] - 12, 'text-anchor': 'middle', 'font-size': 12, fill: COL.brick, opacity: a });
        rawZLbl.append(document.createTextNode('raw '), el('tspan', { class: 'figure-symbol' }, 'z'));
        nodes.push(rawZLbl);
      }
      statusEl.innerHTML = '<strong>1. Inverse map:</strong> raw <em>x</em> → ray [0, <em>z</em><sub>raw</sub>] <span class="hm-anim-tag hm-anim-tag--ball">‖z<sub>raw</sub>‖ = 1.48</span>';
    } else if (phase >= 1 && phase <= 6) {
      const st = steps[phase - 1];
      const curLo = u > 0.72 ? st.nextLo : st.lo;
      const curHi = u > 0.72 ? st.nextHi : st.hi;
      const zLo = toB([curLo * zRaw[0], curLo * zRaw[1]]);
      const zHi = toB([curHi * zRaw[0], curHi * zRaw[1]]);
      const zMid = toB(st.zm);
      const xMid = toK(st.xm);
      const xLo = toK(phi([curLo * zRaw[0], curLo * zRaw[1]]));

      // Active shrinking bracket in B and K
      nodes.push(el('line', { x1: zLo[0], y1: zLo[1], x2: zHi[0], y2: zHi[1], stroke: COL.blue, 'stroke-width': 3.2, 'stroke-linecap': 'round' }));
      nodes.push(el('path', { d: subCurve(curLo, curHi), fill: 'none', stroke: COL.blue, 'stroke-width': 3, 'stroke-linecap': 'round' }));

      // Raw z point
      nodes.push(el('circle', { cx: pBRaw[0], cy: pBRaw[1], r: 4.5, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.5, opacity: 0.7 }));

      // Current verified lower endpoint
      nodes.push(el('circle', { cx: zLo[0], cy: zLo[1], r: 4.5, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.6 }));
      nodes.push(el('circle', { cx: xLo[0], cy: xLo[1], r: 4.5, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.6 }));

      // Active midpoint probe
      const checked = u > 0.42;
      const midCol = !checked ? COL.blue : (st.ok ? COL.teal : COL.brick);
      nodes.push(el('circle', { cx: zMid[0], cy: zMid[1], r: 5.5, fill: COL.white, stroke: midCol, 'stroke-width': 2.2 }));

      // Forward check pulse along bottom arrow during u in [0.15, 0.55]
      if (u >= 0.12 && u <= 0.55) {
        const pt = ease((u - 0.12) / 0.43);
        const fx = (1 - pt) * (1 - pt) * 272 + 2 * (1 - pt) * pt * 320 + pt * pt * 368;
        const fy = (1 - pt) * (1 - pt) * 162 + 2 * (1 - pt) * pt * 188 + pt * pt * 162;
        nodes.push(el('circle', { cx: fx, cy: fy, r: 4, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.4 }));
      }

      // Show mapped probe x_mid in K + verdict pill
      if (u > 0.25) {
        const pulseR = checked ? 10 + 4 * Math.sin(clamp((u - 0.42) / 0.58, 0, 1) * Math.PI) : 6;
        if (checked) {
          nodes.push(el('circle', { cx: xMid[0], cy: xMid[1], r: pulseR, fill: 'none', stroke: midCol, 'stroke-width': 1.5, opacity: 0.45 }));
        }
        nodes.push(el('circle', { cx: xMid[0], cy: xMid[1], r: 5.5, fill: midCol, stroke: COL.white, 'stroke-width': 1.8 }));
        if (checked) {
          const verdict = st.ok ? '∈ K ✓' : '∉ K ✕';
          nodes.push(el('text', { x: xMid[0] + 10, y: xMid[1] + 14, 'font-size': 12, 'font-weight': 600, fill: midCol }, verdict));
        }
      }

      const zNorm = (st.mid * rRaw).toFixed(2);
      const badge = checked
        ? (st.ok
          ? '<span class="hm-anim-tag hm-anim-tag--ok">∈ K ✓ · lo ↑</span>'
          : '<span class="hm-anim-tag hm-anim-tag--out">∉ K ✕ · hi ↓</span>')
        : '<span class="hm-anim-tag hm-anim-tag--ball">check Φ(z)</span>';
      statusEl.innerHTML = `<strong>Bisect ${st.iter}/6:</strong> ‖z<sub>mid</sub>‖ = ${zNorm} · [${curLo.toFixed(2)}, ${curHi.toFixed(2)}] ${badge}`;
    } else {
      // Phase 7: converged verified feasible decision
      const zF = toB(zFinal);
      const xF = toK(xFinal);
      nodes.push(el('circle', { cx: pBRaw[0], cy: pBRaw[1], r: 4.5, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.5, opacity: 0.7 }));
      nodes.push(el('circle', { cx: zF[0], cy: zF[1], r: 6.5, fill: COL.teal, stroke: COL.white, 'stroke-width': 2 }));
      const zLbl = el('text', { x: zF[0] - 10, y: zF[1] - 12, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 600, fill: COL.teal });
      zLbl.append(document.createTextNode('z'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, 'lo'));
      nodes.push(zLbl);

      nodes.push(el('circle', { cx: xF[0], cy: xF[1], r: 6.5, fill: COL.teal, stroke: COL.white, 'stroke-width': 2 }));
      const xLbl = el('text', { x: xF[0] + 11, y: xF[1] + 15, 'font-size': 12, 'font-weight': 600, fill: COL.teal });
      xLbl.append(document.createTextNode('verified '), el('tspan', { class: 'figure-symbol' }, 'x'));
      nodes.push(xLbl);

      statusEl.innerHTML = `<strong>Converged (6/6):</strong> verified feasible <em>x</em> ∈ <em>K</em> <span class="hm-anim-tag hm-anim-tag--ok">width 0.016</span>`;
    }

    // Bottom axis captions
    nodes.push(el('text', { x: B_CX, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted }, '2. Binary search halves the straight ray in B'));
    const rightCap = el('text', { x: K_CX, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted });
    rightCap.append(document.createTextNode('Dashed: approx. Φ(∂B) · Solid: verified boundary ∂'), el('tspan', { class: 'figure-symbol' }, 'K'));
    nodes.push(rightCap);

    svg.replaceChildren(...nodes);
  }

  return { phaseDurations, render };
}

// =============================================================================
// FIGURE 04: Hom-PGD real gradient steps + exact radial ball projection Π_B
// =============================================================================
function buildHomPgdSpec() {
  const convexR = a => ((Math.cos(a) / 1.18) ** 4 + (Math.sin(a) / 0.82) ** 4) ** -0.25;
  const K_SCALE = 68;
  function phi(z) {
    const r = Math.hypot(z[0], z[1]);
    if (r < 1e-9) return [0, 0];
    const s = convexR(Math.atan2(z[1], z[0]));
    return [z[0] * s, z[1] * s];
  }
  const toK = x => [K_CX + K_SCALE * x[0], CY - K_SCALE * x[1]];

  const xStar = [1.50, 1.35];
  const fObj = x => 0.5 * (1.2 * (x[0] - xStar[0]) ** 2 + 0.65 * (x[1] - xStar[1]) ** 2);
  const hObj = z => fObj(phi(z));
  function gradH(z) {
    const eps = 1e-5;
    return [
      (hObj([z[0] + eps, z[1]]) - hObj([z[0] - eps, z[1]])) / (2 * eps),
      (hObj([z[0], z[1] + eps]) - hObj([z[0], z[1] - eps])) / (2 * eps),
    ];
  }

  // Precompute 6 real Hom-PGD iterations
  const iters = [];
  let z = [-0.56, -0.44];
  const eta = 0.28;
  for (let k = 0; k < 6; k++) {
    const x = phi(z);
    const g = gradH(z);
    const zTilde = [z[0] - eta * g[0], z[1] - eta * g[1]];
    const normTilde = Math.hypot(zTilde[0], zTilde[1]);
    const clipped = normTilde > 1.0;
    const zNext = clipped ? [zTilde[0] / normTilde, zTilde[1] / normTilde] : zTilde;
    const xNext = phi(zNext);
    iters.push({ k, z, x, zTilde, normTilde, clipped, zNext, xNext, fVal: fObj(xNext) });
    z = zNext;
  }

  const kPath = boundaryLoop(K_CX, CY, K_SCALE, convexR);
  const xStarPx = toK(xStar);

  // Phases: 0 = init, 1..6 = iter 0..5, 7 = hold converged
  const phaseDurations = [850, 1100, 1100, 1300, 1300, 1250, 1200, 2200];

  function render(svg, statusEl, phase, u) {
    svg.setAttribute('viewBox', '0 0 640 256');
    const nodes = [];
    const defs = el('defs');
    defs.append(makeMarker('pgd-arr-brick', COL.brick, 6.5));
    defs.append(makeMarker('pgd-arr-blue', COL.blue, 7));
    defs.append(makeMarker('pgd-arr-teal', COL.teal, 7));
    const clip = el('clipPath', { id: 'pgd-k-clip' });
    clip.append(el('path', { d: kPath }));
    defs.append(clip);
    nodes.push(defs);

    const hLeft = el('text', { x: B_CX, y: 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 600, fill: COL.blue });
    hLeft.append(document.createTextNode('Updates in '), el('tspan', { class: 'figure-symbol', 'font-weight': 400 }, 'B'), document.createTextNode(' (cheap Π'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, 'B'), document.createTextNode(')'));
    nodes.push(hLeft);
    nodes.push(headingText(K_CX, 22, COL.teal, 'Feasible iterates in ', 'K'));

    // Unit ball B
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: R_B, fill: COL.blueFill, stroke: COL.blue, 'stroke-width': 2 }));
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: 2.5, fill: COL.ink }));

    // Feasible set K + true elliptical level sets of f clipped to K
    nodes.push(el('path', { d: kPath, fill: COL.tealFill, stroke: COL.teal, 'stroke-width': 2 }));
    const contourGroup = el('g', { 'clip-path': 'url(#pgd-k-clip)' });
    for (const c of [0.35, 0.75, 1.35, 2.2, 3.3]) {
      const rx = Math.sqrt((2 * c) / 1.2) * K_SCALE;
      const ry = Math.sqrt((2 * c) / 0.65) * K_SCALE;
      contourGroup.append(el('ellipse', {
        cx: xStarPx[0], cy: xStarPx[1], rx, ry,
        fill: 'none', stroke: COL.tealGrid, 'stroke-width': 1.2, 'stroke-dasharray': '3 3',
      }));
    }
    nodes.push(contourGroup);

    // Center decode arrow
    nodes.push(el('path', { d: 'M278 136 H360', fill: 'none', stroke: COL.teal, 'stroke-width': 2, 'marker-end': 'url(#pgd-arr-teal)' }));
    const mapLbl = el('text', { x: 319, y: 122, 'text-anchor': 'middle', 'font-size': 13.5, fill: COL.teal });
    mapLbl.append(el('tspan', { class: 'figure-symbol' }, 'Φ'), document.createTextNode('('), el('tspan', { class: 'figure-symbol' }, 'z'), document.createTextNode(')'));
    nodes.push(mapLbl);

    // Completed trail up to current phase
    const completedCount = phase === 0 ? 0 : (phase <= 6 ? phase - 1 : iters.length);
    const zTrail = [toB(iters[0].z)];
    const xTrail = [toK(iters[0].x)];
    for (let i = 0; i < completedCount; i++) {
      zTrail.push(toB(iters[i].zNext));
      xTrail.push(toK(iters[i].xNext));
    }
    if (zTrail.length > 1) {
      nodes.push(el('path', { d: ptStr(zTrail), fill: 'none', stroke: COL.brick, 'stroke-width': 2 }));
      nodes.push(el('path', { d: ptStr(xTrail), fill: 'none', stroke: COL.brick, 'stroke-width': 2 }));
    }
    zTrail.forEach(([px, py]) => nodes.push(el('circle', { cx: px, cy: py, r: 4, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.4 })));
    xTrail.forEach(([px, py]) => nodes.push(el('circle', { cx: px, cy: py, r: 4, fill: COL.brick, stroke: COL.white, 'stroke-width': 1.4 })));

    // Labels for z_0 and x_0
    const z0p = toB(iters[0].z);
    const z0l = el('text', { x: z0p[0] - 14, y: z0p[1] + 15, 'font-size': 11.5, fill: COL.body });
    z0l.append(el('tspan', { class: 'figure-symbol' }, 'z'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, '0'));
    nodes.push(z0l);
    const x0p = toK(iters[0].x);
    const x0l = el('text', { x: x0p[0] - 14, y: x0p[1] + 15, 'font-size': 11.5, fill: COL.body });
    x0l.append(el('tspan', { class: 'figure-symbol' }, 'x'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, '0'));
    nodes.push(x0l);

    if (phase === 0) {
      statusEl.innerHTML = `<strong>Init (k = 0):</strong> start at feasible <em>z</em><sub>0</sub> ∈ <em>B</em>, <em>x</em><sub>0</sub> = Φ(<em>z</em><sub>0</sub>) · <em>f</em>(<em>x</em><sub>0</sub>) = ${fObj(iters[0].x).toFixed(2)}`;
    } else if (phase >= 1 && phase <= 6) {
      const it = iters[phase - 1];
      const pCur = toB(it.z);
      const pTilde = toB(it.zTilde);
      const pNext = toB(it.zNext);
      const xCur = toK(it.x);
      const xNext = toK(it.xNext);

      // Sub-phase A (0..0.42): gradient step in B
      const tGrad = ease(clamp(u / 0.42, 0, 1));
      const gTip = [lerp(pCur[0], pTilde[0], tGrad), lerp(pCur[1], pTilde[1], tGrad)];
      nodes.push(el('line', {
        x1: pCur[0], y1: pCur[1], x2: gTip[0], y2: gTip[1],
        stroke: COL.brick, 'stroke-width': 1.9, 'stroke-dasharray': '4 3',
      }));
      nodes.push(el('circle', {
        cx: gTip[0], cy: gTip[1], r: 4.5,
        fill: it.clipped ? COL.white : COL.brick,
        stroke: COL.brick, 'stroke-width': 1.8,
      }));
      if (it.clipped && u > 0.25) {
        const gLbl = el('text', { x: pTilde[0] + 6, y: pTilde[1] - 10, 'text-anchor': 'middle', 'font-size': 11, fill: COL.brick });
        gLbl.append(el('tspan', { class: 'figure-symbol' }, 'z'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, String(it.k)), document.createTextNode('−η∇'), el('tspan', { class: 'figure-symbol' }, 'h'));
        nodes.push(gLbl);
      }

      // Sub-phase B (0.42..0.74): radial clip Π_B if outside ball
      if (it.clipped && u >= 0.40) {
        const tProj = ease(clamp((u - 0.40) / 0.34, 0, 1));
        const pTip = [lerp(pTilde[0], pNext[0], tProj), lerp(pTilde[1], pNext[1], tProj)];
        // Faint radial ray to origin to prove projection is exact radial scaling
        nodes.push(el('line', { x1: B_CX, y1: CY, x2: pNext[0], y2: pNext[1], stroke: COL.blueGrid, 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }));
        nodes.push(el('line', {
          x1: pTilde[0], y1: pTilde[1], x2: pTip[0], y2: pTip[1],
          stroke: COL.blue, 'stroke-width': 2.2, 'marker-end': tProj > 0.7 ? 'url(#pgd-arr-blue)' : '',
        }));
      }

      // Sub-phase C (0.70..1.0): decode Φ(z_{k+1}) into K
      if (u >= 0.65) {
        const tDec = ease(clamp((u - 0.65) / 0.35, 0, 1));
        const zDot = it.clipped ? pNext : pTilde;
        nodes.push(el('circle', { cx: zDot[0], cy: zDot[1], r: 6, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.8 }));
        const xMov = [lerp(xCur[0], xNext[0], tDec), lerp(xCur[1], xNext[1], tDec)];
        nodes.push(el('line', { x1: xCur[0], y1: xCur[1], x2: xMov[0], y2: xMov[1], stroke: COL.brick, 'stroke-width': 2.2 }));
        nodes.push(el('circle', { cx: xMov[0], cy: xMov[1], r: 6, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.8 }));
      }

      const tag = it.clipped
        ? `<span class="hm-anim-tag hm-anim-tag--ball">‖z̃‖ = ${it.normTilde.toFixed(2)} → Π<sub>B</sub> clips to 1.00</span>`
        : `<span class="hm-anim-tag hm-anim-tag--ok">‖z̃‖ = ${it.normTilde.toFixed(2)} (inside B)</span>`;
      statusEl.innerHTML = `<strong>Iter ${it.k + 1}/6:</strong> ${tag} · <em>f</em>(<em>x</em><sub>${it.k + 1}</sub>) = ${it.fVal.toFixed(2)}`;
    } else {
      // Phase 7: converged summary with last radial projection visible
      const last = iters[iters.length - 1];
      const pTilde = toB(last.zTilde);
      const pNext = toB(last.zNext);
      const xNext = toK(last.xNext);
      nodes.push(el('line', { x1: B_CX, y1: CY, x2: pNext[0], y2: pNext[1], stroke: COL.blueGrid, 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }));
      nodes.push(el('line', { x1: pNext[0], y1: pNext[1], x2: pTilde[0], y2: pTilde[1], stroke: COL.brick, 'stroke-width': 1.6, 'stroke-dasharray': '4 3' }));
      nodes.push(el('line', { x1: pTilde[0], y1: pTilde[1], x2: pNext[0], y2: pNext[1], stroke: COL.blue, 'stroke-width': 2, 'marker-end': 'url(#pgd-arr-blue)' }));
      nodes.push(el('circle', { cx: pTilde[0], cy: pTilde[1], r: 4, fill: COL.white, stroke: COL.brick, 'stroke-width': 1.8 }));
      nodes.push(el('circle', { cx: pNext[0], cy: pNext[1], r: 6, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.8 }));
      nodes.push(el('circle', { cx: xNext[0], cy: xNext[1], r: 6, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.8 }));
      const xEndLbl = el('text', { x: xNext[0] + 10, y: xNext[1] - 4, 'font-size': 12, 'font-weight': 600, fill: COL.teal });
      xEndLbl.append(el('tspan', { class: 'figure-symbol' }, 'x'), el('tspan', { 'baseline-shift': 'sub', 'font-size': '72%' }, 'opt'));
      nodes.push(xEndLbl);
      statusEl.innerHTML = `<strong>Converged:</strong> <em>f</em> dropped 2.52 → ${last.fVal.toFixed(2)} <span class="hm-anim-tag hm-anim-tag--ok">no oracle over K</span>`;
    }

    nodes.push(el('text', { x: B_CX, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted }, 'Exact radial norm clipping keeps z in B'));
    const capR = el('text', { x: K_CX - 6, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted });
    capR.append(document.createTextNode('Every iterate stays feasible (dashed: level sets of '), el('tspan', { class: 'figure-symbol' }, 'f'), document.createTextNode(')'));
    nodes.push(capR);

    svg.replaceChildren(...nodes);
  }

  return { phaseDurations, render };
}

// =============================================================================
// FIGURE 06: Gauge Flow Matching (1. Φ⁻¹ data -> 2. Reflected flow in B -> 3. Φ decode)
// =============================================================================
function buildGfmSpec() {
  const starR = a => 1.0 + 0.25 * Math.cos(3 * a);
  const K_SCALE = 60;
  function phi(z) {
    const r = Math.hypot(z[0], z[1]);
    if (r < 1e-9) return [0, 0];
    const s = starR(Math.atan2(z[1], z[0]));
    return [z[0] * s, z[1] * s];
  }
  const toK = x => [K_CX + K_SCALE * x[0], CY - K_SCALE * x[1]];

  // Deterministic PRNG for reproducible particles & target data
  let seed = 42019;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Two target modes inside B (corresponding to right lobe & upper-left lobe of star K)
  const modes = [[0.64, 0.06], [-0.36, 0.62]];
  const trainB = [];
  const trainK = [];
  for (let m = 0; m < 2; m++) {
    for (let i = 0; i < 12; i++) {
      const ang = rand() * 2 * Math.PI;
      const rad = 0.05 + 0.14 * Math.sqrt(rand());
      let zx = modes[m][0] + rad * Math.cos(ang);
      let zy = modes[m][1] + rad * Math.sin(ang);
      const n = Math.hypot(zx, zy);
      if (n > 0.93) { zx *= 0.93 / n; zy *= 0.93 / n; }
      trainB.push([zx, zy]);
      trainK.push(phi([zx, zy]));
    }
  }

  // Simulate 16 flow particles inside B with exact specular reflection at |z| = 1.
  // Pick 4 highlighted trajectories that intentionally graze the boundary and reflect cleanly!
  const specs = [
    // 3 highlighted boundary-reflecting trajectories
    { start: [0.34, -0.76], target: [0.64, 0.05], kick: [1.95, -0.85], highlight: true },
    { start: [-0.72, 0.22], target: [-0.36, 0.62], kick: [-1.45, 1.45], highlight: true },
    { start: [0.22, 0.72], target: [0.60, 0.12], kick: [1.85, 1.95], highlight: true },
    { start: [-0.45, -0.58], target: [-0.40, 0.56], kick: [-1.85, -1.05], highlight: false },
    // 12 interior prior particles
    { start: [-0.52, -0.48], target: [-0.32, 0.60], kick: [-0.2, 0.1], highlight: false },
    { start: [0.05, -0.25], target: [0.62, 0.02], kick: [0.15, -0.25], highlight: false },
    { start: [-0.28, -0.10], target: [-0.42, 0.66], kick: [-0.15, 0.1], highlight: false },
    { start: [0.12, 0.22], target: [0.66, 0.12], kick: [0.1, 0.15], highlight: false },
    { start: [-0.10, 0.35], target: [-0.30, 0.58], kick: [0.05, 0.15], highlight: false },
    { start: [0.42, -0.32], target: [0.70, -0.02], kick: [0.3, -0.15], highlight: false },
    { start: [-0.60, -0.12], target: [-0.44, 0.54], kick: [-0.2, 0.05], highlight: false },
    { start: [0.28, 0.45], target: [0.58, 0.16], kick: [0.15, 0.1], highlight: false },
    { start: [-0.40, 0.12], target: [-0.34, 0.68], kick: [-0.1, 0.15], highlight: false },
    { start: [0.48, 0.32], target: [0.64, 0.06], kick: [0.2, 0.05], highlight: false },
    { start: [-0.05, -0.50], target: [0.56, -0.04], kick: [0.25, -0.15], highlight: false },
    { start: [-0.22, 0.64], target: [-0.38, 0.62], kick: [-0.1, 0.1], highlight: false },
  ];

  const STEPS = 60;
  const particles = specs.map(sp => {
    const path = [sp.start];
    const bounces = [];
    let [x, y] = sp.start;
    let [vx, vy] = sp.kick;
    const dt = 1 / STEPS;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
      const pull = 4.5 + 14.0 * t * t;
      const damp = Math.exp(-3.8 * dt);
      vx = vx * damp + pull * (sp.target[0] - x) * dt;
      vy = vy * damp + pull * (sp.target[1] - y) * dt;
      let nx = x + vx * dt;
      let ny = y + vy * dt;
      const nr = Math.hypot(nx, ny);
      if (nr >= 0.985) {
        const ux = nx / nr;
        const uy = ny / nr;
        const hx = ux * 0.985;
        const hy = uy * 0.985;
        const dot = vx * ux + vy * uy;
        if (dot > 0) {
          vx -= 2 * dot * ux;
          vy -= 2 * dot * uy;
        }
        nx = hx + vx * dt * 0.35;
        ny = hy + vy * dt * 0.35;
        const r2 = Math.hypot(nx, ny);
        if (r2 > 0.98) { nx *= 0.98 / r2; ny *= 0.98 / r2; }
        bounces.push({ t, pt: [hx, hy] });
      }
      if (t > 0.85) {
        const blend = (t - 0.85) / 0.15;
        nx = lerp(nx, sp.target[0], blend * 0.35);
        ny = lerp(ny, sp.target[1], blend * 0.35);
      }
      x = nx;
      y = ny;
      path.push([x, y]);
    }
    const endB = path[path.length - 1];
    return { path, bounces, endB, endK: phi(endB), highlight: sp.highlight };
  });

  const starKPath = boundaryLoop(K_CX, CY, K_SCALE, starR);

  // Phases: 0 = 1. Encode Φ⁻¹ (data K->B), 1 = 2. Reflected flow in B (t: 0->1), 2 = 3. Decode Φ (B->K), 3 = hold
  const phaseDurations = [1500, 2900, 1500, 2100];

  function samplePath(path, t) {
    const idx = clamp(t, 0, 1) * (path.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(path.length - 1, i0 + 1);
    const f = idx - i0;
    return [lerp(path[i0][0], path[i1][0], f), lerp(path[i0][1], path[i1][1], f)];
  }

  function render(svg, statusEl, phase, u) {
    svg.setAttribute('viewBox', '0 0 640 256');
    const nodes = [];
    const defs = el('defs');
    defs.append(makeMarker('gfm-arr-blue', COL.blue, 7));
    defs.append(makeMarker('gfm-arr-teal', COL.teal, 7));
    nodes.push(defs);

    nodes.push(headingText(B_CX, 22, COL.blue, 'Ball coordinates · ', 'B'));
    nodes.push(headingText(K_CX, 22, COL.teal, 'Feasible decisions · ', 'K'));

    // Domains B and K (identical star K to Figure 05!)
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: R_B, fill: COL.blueFill, stroke: COL.blue, 'stroke-width': 2 }));
    nodes.push(el('circle', { cx: B_CX, cy: CY, r: R_B * 0.5, fill: 'none', stroke: COL.blueGrid, 'stroke-width': 1, 'stroke-dasharray': '2 3' }));
    nodes.push(el('path', { d: starKPath, fill: COL.tealFill, stroke: COL.teal, 'stroke-width': 2 }));

    // Transfer arrows: top Φ⁻¹ (train data K -> B), bottom Φ (decode B -> K)
    const encActive = phase === 0;
    const decActive = phase === 2;
    nodes.push(el('path', {
      d: 'M370 96 Q320 70 270 96', fill: 'none',
      stroke: COL.blue, 'stroke-width': encActive ? 2.6 : 1.5,
      opacity: encActive ? 1 : 0.45, 'marker-end': 'url(#gfm-arr-blue)',
    }));
    const encLbl = el('text', { x: 320, y: 68, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': encActive ? 600 : 400, fill: COL.blue, opacity: encActive ? 1 : 0.65 });
    encLbl.append(document.createTextNode('1. '), el('tspan', { class: 'figure-symbol' }, 'Φ'), el('tspan', { 'baseline-shift': 'super', 'font-size': '72%' }, '−1'), document.createTextNode(' (train)'));
    nodes.push(encLbl);

    nodes.push(el('path', {
      d: 'M270 162 Q320 188 370 162', fill: 'none',
      stroke: COL.teal, 'stroke-width': decActive ? 2.6 : 1.5,
      opacity: decActive || phase === 3 ? 1 : 0.45, 'marker-end': 'url(#gfm-arr-teal)',
    }));
    const decLbl = el('text', { x: 320, y: 198, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': decActive ? 600 : 400, fill: COL.teal, opacity: decActive || phase === 3 ? 1 : 0.65 });
    decLbl.append(document.createTextNode('3. '), el('tspan', { class: 'figure-symbol' }, 'Φ'), document.createTextNode(' (decode)'));
    nodes.push(decLbl);

    // Training data rings in K (always softly visible as ground-truth modes)
    for (const x of trainK) {
      const [px, py] = toK(x);
      nodes.push(el('circle', { cx: px, cy: py, r: 3.1, fill: COL.white, stroke: COL.teal, 'stroke-width': 1.2, opacity: encActive ? 0.95 : 0.55 }));
    }

    // Encoded target modes in B (fade in during phase 0, stay visible as blue rings thereafter)
    const targetAlpha = phase === 0 ? ease(clamp((u - 0.3) / 0.6, 0, 1)) * 0.7 : 0.55;
    if (targetAlpha > 0.02) {
      for (const z of trainB) {
        const [px, py] = toB(z);
        nodes.push(el('circle', { cx: px, cy: py, r: 3.1, fill: COL.white, stroke: COL.blue, 'stroke-width': 1.2, opacity: targetAlpha }));
      }
    }

    if (phase === 0) {
      // Animate a pulse + glowing transfer particles flying across top arrow from K -> B
      const t = ease(u);
      const bx = (1 - t) * (1 - t) * 370 + 2 * (1 - t) * t * 320 + t * t * 270;
      const by = (1 - t) * (1 - t) * 96 + 2 * (1 - t) * t * 70 + t * t * 96;
      nodes.push(el('circle', { cx: bx, cy: by, r: 4.5, fill: COL.blue, stroke: COL.white, 'stroke-width': 1.5 }));
      statusEl.innerHTML = '<strong>1/3 Encode:</strong> Φ<sup>−1</sup> maps training data into <em>B</em> <span class="hm-anim-tag hm-anim-tag--ball">target modes</span>';
    } else {
      const flowT = phase === 1 ? ease(u) : 1;
      const maxIdx = Math.max(1, Math.floor(flowT * STEPS));
      let bounceCount = 0;

      // Draw trails for highlighted boundary-reflecting trajectories
      for (const p of particles) {
        if (p.highlight) {
          const seg = p.path.slice(0, maxIdx + 1).map(toB);
          seg.push(toB(samplePath(p.path, flowT)));
          nodes.push(el('path', {
            d: ptStr(seg), fill: 'none', stroke: COL.brick,
            'stroke-width': 1.4, opacity: phase === 1 ? 0.65 : 0.4,
          }));
        }
        // Reflection markers when trajectory hits ∂B
        for (const b of p.bounces) {
          if (flowT >= b.t) {
            bounceCount += 1;
            if (p.highlight) {
              const [bx, by] = toB(b.pt);
              const age = clamp((flowT - b.t) / 0.25, 0, 1);
              nodes.push(el('circle', {
                cx: bx, cy: by, r: 3.5 + 4.5 * (1 - age),
                fill: 'none', stroke: COL.blue, 'stroke-width': 1.5,
                opacity: phase === 1 ? 0.85 * (1 - 0.5 * age) : 0.45,
              }));
              nodes.push(el('circle', { cx: bx, cy: by, r: 2.6, fill: COL.blue }));
            }
          }
        }
      }

      // Draw all 16 flowing particles in B
      for (const p of particles) {
        const [px, py] = toB(samplePath(p.path, flowT));
        nodes.push(el('circle', {
          cx: px, cy: py, r: p.highlight ? 4.2 : 3.4,
          fill: COL.brick, stroke: COL.white, 'stroke-width': 1.2,
          opacity: phase === 1 ? 0.95 : 0.82,
        }));
      }

      if (phase === 1) {
        const tag = bounceCount > 0
          ? '<span class="hm-anim-tag hm-anim-tag--ball">reflecting at ∂B</span>'
          : '<span class="hm-anim-tag hm-anim-tag--out">prior → target</span>';
        statusEl.innerHTML = `<strong>2/3 Flow in B:</strong> <em>t</em> = ${flowT.toFixed(2)} · stays in <em>B</em> ${tag}`;
      } else {
        // Phase 2 (Decode) & Phase 3 (Hold): show decoded particles in K
        const decT = phase === 2 ? ease(u) : 1;
        if (phase === 2) {
          const fx = (1 - decT) * (1 - decT) * 270 + 2 * (1 - decT) * decT * 320 + decT * decT * 370;
          const fy = (1 - decT) * (1 - decT) * 162 + 2 * (1 - decT) * decT * 188 + decT * decT * 162;
          nodes.push(el('circle', { cx: fx, cy: fy, r: 4.5, fill: COL.teal, stroke: COL.white, 'stroke-width': 1.5 }));
        }
        const appear = phase === 2 ? clamp((u - 0.25) / 0.65, 0, 1) : 1;
        if (appear > 0.02) {
          for (const p of particles) {
            const [kx, ky] = toK(p.endK);
            nodes.push(el('circle', {
              cx: kx, cy: ky, r: 3.8,
              fill: COL.brick, stroke: COL.white, 'stroke-width': 1.2,
              opacity: appear * 0.92,
            }));
          }
        }
        if (phase === 2) {
          statusEl.innerHTML = '<strong>3/3 Decode:</strong> Φ maps ball samples into <em>K</em> <span class="hm-anim-tag hm-anim-tag--ok">100% feasible</span>';
        } else {
          statusEl.innerHTML = '<strong>Complete:</strong> reflected flow + Φ matches <em>K</em> <span class="hm-anim-tag hm-anim-tag--ok">0 violations</span>';
        }
      }
    }

    nodes.push(el('text', { x: B_CX, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted }, '2. Reflected flow stays inside B (blue dots: bounces)'));
    nodes.push(el('text', { x: K_CX, y: 242, 'text-anchor': 'middle', 'font-size': 11.5, fill: COL.muted }, 'Rings: training data · Solid dots: decoded samples'));

    svg.replaceChildren(...nodes);
  }

  return { phaseDurations, render };
}

// =============================================================================
// Auto-mount on all [data-hm-anim] containers
// =============================================================================
const BUILDERS = {
  bisection: buildBisectionSpec,
  hompgd: buildHomPgdSpec,
  gfm: buildGfmSpec,
};

if (typeof document !== 'undefined') {
  for (const host of document.querySelectorAll('[data-hm-anim]')) {
    const key = host.dataset.hmAnim;
    const build = BUILDERS[key];
    if (build) createAnimator(host, build());
  }
}
