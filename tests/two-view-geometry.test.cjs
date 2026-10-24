const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { twoViewGeometry } = require('../src/presentation/viewport/two-view-geometry.ts');

const close = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
const pts = list => list.map(([x, y]) => ({ x, y }));
/** Signed volume by the divergence theorem: right only for a closed mesh whose faces all point out. */
function volume(g) {
  const p = g.getAttribute('position'), v = (i) => new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
  let sum = 0;
  for (let i = 0; i < p.count; i += 3) sum += v(i).dot(v(i + 1).cross(v(i + 2))) / 6;
  return sum;
}
/** The mesh holds water: points inside the true solid cross its surface an odd number of times on the way out. */
function sealed(g, contains, box) {
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), ray = new THREE.Raycaster();
  let seed = 7; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 300; k++) {
    const p = new THREE.Vector3(box[0] + random() * (box[1] - box[0]), box[2] + random() * (box[3] - box[2]), box[4] + random() * (box[5] - box[4]));
    ray.set(p, new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize());
    const hits = ray.intersectObject(mesh).map(h => Math.round(h.distance * 1e5));
    if ((new Set(hits).size % 2 === 1) !== contains(p)) return false;
  }
  return true;
}

test('a box from two rectangles is the box', () => {
  const g = twoViewGeometry([pts([[0, 0], [100, 0], [100, 50], [0, 50]])], pts([[0, 0], [30, 0], [30, 50], [0, 50]]));
  close(volume(g), 100 * 30 * 50); assert.ok(sealed(g, p => p.x < 100 && p.y < 50 && p.z < 30, [1, 99, 1, 49, 1, 29]));
});

test('a chamfer from the side cuts the whole run; a window from the front goes right through', () => {
  const side = pts([[0, 0], [30, 0], [30, 20], [10, 50], [0, 50]]);
  const g = twoViewGeometry([pts([[0, 0], [100, 0], [100, 50], [0, 50]])], side);
  const depth = y => y < 20 ? 30 : 30 - 20 * (y - 20) / 30, inSide = p => p.z < depth(p.y);
  close(volume(g), 100 * (30 * 20 + (30 + 10) / 2 * 30)); assert.ok(sealed(g, inSide, [1, 99, 1, 49, 1, 29]));
  const holed = twoViewGeometry([pts([[0, 0], [100, 0], [100, 50], [0, 50]]), pts([[40, 10], [60, 10], [60, 30], [40, 30]])], side);
  // The window (20 × 20, from 10 to 30 high) goes through the side's depth there: 30 deep up to 20, then narrowing.
  const through = 10 * 30 + (30 + (30 - 20 * 10 / 30)) / 2 * 10;
  close(volume(holed), volume(g) - 20 * through);
  assert.ok(sealed(holed, p => inSide(p) && !(p.x > 40 && p.x < 60 && p.y > 10 && p.y < 30), [1, 99, 1, 49, 1, 29]));
});

test('a stair seen from the front and a slope seen from the side: only what both allow', () => {
  // Front: underside rising from 100 at x=0 to 200 at x=100. Side: underside rising from 150 at the wall to 200 at 50 out.
  const g = twoViewGeometry([pts([[0, 100], [100, 200], [100, 260], [0, 260]])], pts([[0, 150], [50, 200], [50, 260], [0, 260]]));
  // Sample the volume numerically: a column is filled above the higher of the two undersides.
  let expected = 0; const n = 400;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i + .5) * 100 / n, z = (j + .5) * 50 / n;
    expected += (260 - Math.max(100 + x, 150 + z)) * (100 / n) * (50 / n);
  }
  close(volume(g), expected, expected * 1e-3);
  assert.ok(sealed(g, p => p.y > Math.max(100 + p.x, 150 + p.z), [1, 99, 101, 259, 1, 49]));
});
