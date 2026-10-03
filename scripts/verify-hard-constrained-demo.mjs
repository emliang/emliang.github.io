import assert from 'node:assert/strict';
import {
  DEFAULT_SEED, GENERATION_THEORY, violation, isFeasible,
  projection, penalty, parameterize, makeRandom, sampleGeneration,
} from '../assets/js/hard-constrained-demo.mjs';

let checks = 0;
const near = (actual, expected, tolerance = 1e-12, message = '') => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} expected ${expected}, got ${actual}`);
  checks += 1;
};
const nearPair = (actual, expected, tolerance = 1e-12) => actual.forEach((value, index) => near(value, expected[index], tolerance));

// Independent closed-form fixtures cover all projection regions, including ties.
for (const [candidate, expected] of [
  [[0.8, 0.8], [0.5, 0.5]], [[-0.2, 0.3], [0, 0.3]],
  [[1.5, -0.2], [1, 0]], [[-0.2, 1.5], [0, 1]],
  [[0.1, 0.2], [0.1, 0.2]], [[-1, -1], [0, 0]],
  [[1.1, 0.1], [1, 0]], [[0, 1], [0, 1]],
]) nearPair(projection(candidate), expected);

nearPair(penalty(0.8, 0), [0.8, 0.8]);
nearPair(penalty(0.8, 1), [0.6, 0.6]);
near(violation(penalty(0.8, 1)), 0.2);
nearPair(penalty(0.8, 10), [18 / 35, 18 / 35]);
nearPair(penalty(0.2, 100), [0.2, 0.2]);
nearPair(penalty(0.5, 100), [0.5, 0.5]);
for (const lambda of [0, 1, 2, 10, 100, 1000]) {
  const output = penalty(0.8, lambda);
  near(violation(output), 0.6 / (1 + 2 * lambda));
  // First-order optimality of this strictly convex toy objective.
  near(output[0] - 0.8 + lambda * Math.max(output[0] + output[1] - 1, 0), 0, 1e-10);
  assert.ok(violation(output) > 0, 'A finite penalty retains a positive violation for this outside candidate.');
  checks += 1;
}

nearPair(parameterize(0, 0.3), [0, 0]);
nearPair(parameterize(1, 0), [0, 1]);
nearPair(parameterize(1, 1), [1, 0]);
nearPair(parameterize(0.6, 0.25), [0.15, 0.45]);
for (let rhoIndex = 0; rhoIndex <= 20; rhoIndex += 1) {
  for (let pIndex = 0; pIndex <= 20; pIndex += 1) {
    assert.ok(isFeasible(parameterize(rhoIndex / 20, pIndex / 20), 1, 1e-12));
    checks += 1;
  }
}

// The projection variational inequality characterizes the Euclidean minimizer.
// Random feasible comparison points are not produced by the projection under test.
const random = makeRandom(981743);
for (let index = 0; index < 1000; index += 1) {
  const budget = 10 ** (12 * random() - 6);
  const candidate = [budget * (8 * random() - 4), budget * (8 * random() - 4)];
  const output = projection(candidate, budget);
  assert.ok(isFeasible(output, budget, 1e-12));
  nearPair(projection(output, budget).map(value => value / budget), output.map(value => value / budget), 1e-12);
  for (const z of [[0, 0], [budget, 0], [0, budget], parameterize(random(), random(), budget)]) {
    const inequality = ((candidate[0] - output[0]) * (z[0] - output[0]) + (candidate[1] - output[1]) * (z[1] - output[1])) / budget ** 2;
    assert.ok(inequality <= 1e-10, `Projection optimality failed: ${inequality}`);
    checks += 1;
  }
  checks += 1;
}

// Mulberry32 seed-1 reference value also catches accidental RNG algorithm changes.
near(makeRandom(1)(), 0.6270739405881613, 0);
const baseline = sampleGeneration();
assert.deepEqual(sampleGeneration(), baseline, 'Resetting the seed reproduces the exact returned samples and candidate count.');
assert.notDeepEqual(sampleGeneration({ seed: DEFAULT_SEED + 1 }).projected.points, baseline.projected.points);
assert.equal(baseline.rejection.returned, 512);
assert.equal(baseline.projected.proposals, 512);
assert.equal(baseline.rejection.valid, 512);
assert.equal(baseline.projected.valid, 512);
assert.ok(baseline.rejection.points.every(point => point[0] >= 0 && point[1] >= 0 && point[0] + point[1] <= 1));
assert.ok(baseline.projected.points.every(point => isFeasible(point)));
checks += 8;
for (let index = 0; index < baseline.count; index += 1) {
  const point = baseline.projected.points[index];
  if (baseline.projected.movedFromOutside[index]) {
    // This is a numerical check of the analytic projection property, not a boundary-mass estimator.
    near(Math.min(Math.abs(point[0]), Math.abs(point[1]), Math.abs(point[0] + point[1] - 1)), 0, 1e-12);
  } else {
    assert.ok(point[0] >= 0 && point[1] >= 0 && point[0] + point[1] <= 1);
    checks += 1;
  }
}

// Candidate cap is real: a partial return must remain visible rather than change method.
const capped = sampleGeneration({ count: 512, capMultiplier: 1 });
assert.equal(capped.rejection.proposals, 512);
assert.equal(capped.rejection.capped, true);
assert.ok(capped.rejection.returned < 512);
checks += 3;

// Fixed-seed statistical sanity checks against independently derived population values.
// These finite-sample bounds are regression checks, not empirical proofs of the laws.
const large = sampleGeneration({ count: 8192 });
near(large.rejection.acceptance, GENERATION_THEORY.acceptance, 0.01, 'Rejection acceptance');
near(large.projected.movedToBoundary / large.count, GENERATION_THEORY.boundaryMass, 0.02, 'Outside proposals moved to the boundary');
near(large.projected.originCount / large.count, GENERATION_THEORY.originMass, 0.02, 'Origin atom');
for (const coordinate of large.rejection.mean) near(coordinate, GENERATION_THEORY.conditionalMean, 0.02, 'Conditional mean');
for (const coordinate of large.projected.mean) near(coordinate, GENERATION_THEORY.projectedMean, 0.02, 'Projected mean');

assert.throws(() => projection([0, 0], 0), RangeError);
assert.throws(() => penalty(1.1, 1), RangeError);
assert.throws(() => penalty(0.8, -1), RangeError);
assert.throws(() => parameterize(1.1, 0.2), RangeError);
assert.throws(() => makeRandom(-1), RangeError);
checks += 5;

console.log(`Passed ${checks} analytic, feasibility, projection-optimality, seeded reproduction, cap, and statistical checks.`);
console.log(JSON.stringify({
  seed: baseline.seed,
  requested: baseline.count,
  rejection: { proposals: baseline.rejection.proposals, returned: baseline.rejection.returned, acceptance: baseline.rejection.acceptance, mean: baseline.rejection.mean },
  projection: { proposals: baseline.projected.proposals, returned: baseline.projected.returned, movedToBoundary: baseline.projected.movedToBoundary, originCount: baseline.projected.originCount, mean: baseline.projected.mean },
}, null, 2));
