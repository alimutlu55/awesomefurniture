const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/domain/geometry/profile-polygon.ts');

const close = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const pts = list => list.map(([x, y]) => ({ x, y }));
const xy = list => list.map(p => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]);
const bounds = (maxX, maxY) => ({ minX: 0, maxX, minY: 0, maxY });

test('vector 1: a trapezoid top slides up until it is the shortest edge, its sides keep their slope', () => {
  const trapezoid = pts([[0, 0], [100, 0], [80, 50], [20, 50]]);
  const r = P.slideEdge(trapezoid, 2, 90, bounds(300, 250));
  close(r.applied, 68.75);
  assert.deepEqual(xy(r.points), [[0, 0], [100, 0], [52.5, 118.75], [47.5, 118.75]]);
  close(P.edgeLength(r.points, 2), 5);
  const slope = (a, b) => (b.y - a.y) / (b.x - a.x);
  close(slope(r.points[1], r.points[2]), slope(trapezoid[1], trapezoid[2]));
  close(slope(r.points[3], r.points[0]), slope(trapezoid[3], trapezoid[0]));
});

test('vector 2: a neighbour at 6 degrees gets a riser instead of a mitre that would fly off', () => {
  const thin = pts([[0, 0], [100, 0], [95, .524], [0, .524]]);
  const r = P.slideEdge(thin, 2, 10, bounds(300, 250));
  close(r.applied, 10);
  assert.deepEqual(xy(r.points), [[0, 0], [100, 0], [95, .524], [95, 10.524], [0, 10.524]]);
  assert.equal(r.edge, 3, 'the slid edge is still selected');
});

test('vector 3: + Step steps the top in by 15 cm and healing keeps a pinned + Point', () => {
  const square = pts([[0, 0], [100, 0], [100, 100], [0, 100]]), b = bounds(300, 250);
  const pinned = P.addPoint(square, 0);
  assert.deepEqual(xy(pinned.points), [[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]);
  assert.equal(pinned.points[1].pinned, true);
  const stepped = P.stepEdge(pinned.points, 3, b);
  assert.deepEqual(xy(stepped.points), [[0, 0], [50, 0], [100, 0], [100, 100], [50, 100], [50, 85], [0, 85]]);
  assert.deepEqual(xy([stepped.points[stepped.edge], stepped.points[stepped.edge + 1]]), [[50, 85], [0, 85]], 'the moved part is selected');
  const healed = P.healProfile(stepped.points);
  assert.deepEqual(xy(healed), xy(stepped.points), 'the pinned bottom point stays');
  // Once moved off its edge it is an ordinary corner; put back in line, it heals away.
  const bent = P.movePoint(healed, 1, { x: 50, y: 10 }, b), straight = P.movePoint(P.healProfile(bent), 1, { x: 50, y: 0 }, b);
  assert.equal(P.healProfile(straight).length, 6);
});

test('vector 4: a corner dragged across or too close to another edge is refused', () => {
  const l = pts([[0, 0], [60, 0], [60, 40], [30, 40], [30, 80], [0, 80]]), b = bounds(300, 250);
  assert.equal(P.movePoint(l, 3, { x: -5, y: 40 }, b), null);
  assert.equal(P.movePoint(l, 3, { x: 1, y: 40 }, b), null);
  assert.equal(P.profileProblem(l.map((p, i) => i === 3 ? { x: 1, y: 40 } : p), b), 'neck-clearance');
  assert.ok(P.movePoint(l, 3, { x: 20, y: 40 }, b));
});

test('a straight edge pulled sideways makes a step; a short pull snaps to none or the shortest step', () => {
  const b = bounds(300, 250), square = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
  const bent = P.addPoint(square, 2).points; // (100,100) (50,100) (0,100): drag the left half up
  assert.equal(P.slideEdge(bent, 3, 1, b).applied, 0);
  assert.equal(P.slideEdge(bent, 3, 3, b).applied, 5);
  const r = P.slideEdge(bent, 3, 20, b);
  assert.deepEqual(xy(r.points), [[0, 0], [100, 0], [100, 100], [50, 100], [50, 120], [0, 120]]);
});

test('slides stop at the bounds and at the shortest edge', () => {
  const b = bounds(120, 110), square = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
  close(P.slideEdge(square, 2, 50, b).applied, 10);
  close(P.slideEdge(square, 2, -200, b).applied, -95);
  close(P.slideEdge(square, 1, 50, b).applied, 20);
  assert.deepEqual(P.slideRange(square, 2, b), { min: -95, max: 10 });
});

test('setEdgeLength keeps every angle; setExtent slides flat sides and stretches a peak', () => {
  const b = bounds(300, 250), square = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
  assert.deepEqual(xy(P.setEdgeLength(square, 0, 140, b)), [[0, 0], [140, 0], [140, 100], [0, 100]]);
  const trapezoid = pts([[0, 0], [100, 0], [80, 50], [20, 50]]);
  const taller = P.setExtent(trapezoid, 'maxY', 60, b);
  assert.deepEqual(xy(taller), [[0, 0], [100, 0], [76, 60], [24, 60]]);
  const gable = pts([[0, 0], [100, 0], [100, 60], [50, 100], [0, 60]]);
  assert.deepEqual(xy(P.setExtent(gable, 'maxY', 120, b)), [[0, 0], [100, 0], [100, 72], [50, 120], [0, 72]]);
  assert.deepEqual(xy(P.setExtent(gable, 'maxX', 120, b)), [[0, 0], [120, 0], [120, 44], [50, 100], [0, 60]], 'the roof keeps its pitch');
  assert.equal(P.setExtent(square, 'maxX', -10, b), null);
});

test('flip mirrors and stays counter-clockwise; remove and heal keep the polygon valid', () => {
  const b = bounds(300, 250), stairs = pts([[0, 0], [100, 0], [100, 30], [0, 90]]);
  const flipped = P.flipProfile(stairs);
  assert.ok(P.signedArea(flipped) > 0);
  assert.deepEqual(xy(flipped).sort(), [[0, 0], [100, 0], [100, 90], [0, 30]].sort());
  assert.equal(P.removePoint(pts([[0, 0], [10, 0], [0, 10]]), 0, b), null);
  assert.deepEqual(xy(P.healProfile(pts([[0, 0], [50, 0.01], [100, 0], [100, 100], [0, 100]]))), [[0, 0], [100, 0], [100, 100], [0, 100]]);
  assert.deepEqual(xy(P.healProfile(pts([[0, 0], [100, 0], [100, 100], [99.95, 100], [0, 100]]))), [[0, 0], [100, 0], [100, 100], [0, 100]]);
});

test('a step on a sloped underside is an upright riser, and an edge can be set to an angle', () => {
  const b = bounds(400, 260), stairs = pts([[0, 0], [300, 0], [300, 100], [0, 260]]); // underside from (300,100) up to (0,260)
  const ceiling = pts([[100, 260], [400, 40], [400, 260]]);
  const stepped = P.stepEdge(ceiling, 0, b);
  const riser = [stepped.points[1], stepped.points[2]];
  close(riser[0].x, riser[1].x); assert.ok(Math.abs(riser[0].y - riser[1].y) > 5, 'the riser is upright');
  const slope = (a, c) => (c.y - a.y) / (c.x - a.x);
  close(slope(stepped.points[2], stepped.points[3]), slope(ceiling[0], ceiling[1]), 1e-6);
  const turned = P.setEdgeAngle(stairs, 2, 25, b);
  close(P.edgeAngle(turned, 2), 25, 1e-3);
  assert.deepEqual([turned[2].x, turned[2].y], [300, 100], 'turns about its first corner');
  close(turned[3].x, 0, 1e-6); close(turned[3].y, 100 + 300 * Math.tan(25 * Math.PI / 180), 1e-3);
  assert.equal(P.setEdgeAngle(stairs, 2, 35, b), null, 'would rise above the ceiling');
  assert.equal(P.setEdgeAngle(stairs, 2, 95, b), null);
});
