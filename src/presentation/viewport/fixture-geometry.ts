import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A point of a plan outline: `x` across the fixture (0 its middle), `z` out from its back. Centimetres. */
export type PlanPoint = { readonly x: number; readonly z: number };
/** One ring of a lofted solid: a plan outline at height `y`. Every ring of a loft has the same number of points. */
export type Ring = { readonly y: number; readonly points: readonly PlanPoint[] };

/** Points round the ring; enough for ceramic to read smooth up close. */
export const SEGMENTS = 64;

/** A rounded plan outline filling the box `x` in [-half, half], `z` in [back, front]: a superellipse whose back half
 * has exponent `nBack` (high is square, as a bowl that meets a wall) and front half `nFront` (2 is an ellipse).
 * Starts at the back middle and runs round through the right side (+x), so rings line up point for point and a loft
 * going up faces outwards. */
export function plan(half: number, back: number, front: number, nFront = 2.2, nBack = nFront): PlanPoint[] {
  const out: PlanPoint[] = [], mid = (back + front) / 2, depth = (front - back) / 2;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = -Math.PI / 2 + i / SEGMENTS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), n = s > 0 ? nFront : nBack;
    const p = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / n);
    out.push({ x: half * p(c), z: mid + depth * p(s) });
  }
  return out;
}
/** The same outline grown or shrunk by `by` centimetres all round (approximately, by scaling about its middle). */
export function inset(points: readonly PlanPoint[], by: number): PlanPoint[] {
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const hx = (Math.max(...xs) - Math.min(...xs)) / 2, hz = (Math.max(...zs) - Math.min(...zs)) / 2;
  const sx = Math.max(.01, (hx - by) / hx), sz = Math.max(.01, (hz - by) / hz);
  return points.map(p => ({ x: cx + (p.x - cx) * sx, z: cz + (p.z - cz) * sz }));
}

/** A smooth solid through its rings, bottom to top. `capStart` and `capEnd` close the first and last ring flat;
 * `closed` joins the last ring back to the first (a seat, a lid's edge). Normals are shared round each ring, so
 * curved ceramic shades smooth; repeat a ring to make a crisp edge. */
export function loft(rings: readonly Ring[], { capStart = false, capEnd = false, closed = false } = {}): THREE.BufferGeometry {
  const n = rings[0]!.points.length, position: number[] = [], index: number[] = [];
  for (const r of rings) for (const p of r.points) position.push(p.x, r.y, p.z);
  const count = closed ? rings.length : rings.length - 1;
  for (let k = 0; k < count; k++) {
    const a = k * n, b = ((k + 1) % rings.length) * n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      index.push(a + i, b + i, a + j, a + j, b + i, b + j);
    }
  }
  const cap = (ring: Ring, base: number, up: boolean) => {
    const c = position.length / 3, xs = ring.points.map(p => p.x), zs = ring.points.map(p => p.z);
    position.push(xs.reduce((s, v) => s + v, 0) / n, ring.y, zs.reduce((s, v) => s + v, 0) / n);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; index.push(...(up ? [c, base + j, base + i] : [c, base + i, base + j])); }
  };
  // The rings run round clockwise seen from above, so a cap facing up winds the other way.
  if (capStart) cap(rings[0]!, 0, false);
  if (capEnd) cap(rings.at(-1)!, (rings.length - 1) * n, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A pipe of radius `r` along a path, its ends closed round as polished metal is: a spout, a waste pipe. */
export function pipe(path: readonly THREE.Vector3[], r: number, smooth = true): THREE.BufferGeometry {
  const curve = smooth ? new THREE.CatmullRomCurve3(path as THREE.Vector3[], false, 'centripetal') : new THREE.CurvePath<THREE.Vector3>();
  if (!smooth) for (let i = 0; i < path.length - 1; i++) (curve as THREE.CurvePath<THREE.Vector3>).add(new THREE.LineCurve3(path[i]!, path[i + 1]!));
  const tube = new THREE.TubeGeometry(curve as THREE.Curve<THREE.Vector3>, smooth ? 32 : 8 * path.length, r, 20, false);
  const end = (p: THREE.Vector3) => new THREE.SphereGeometry(r, 20, 12).translate(p.x, p.y, p.z);
  return BufferGeometryUtils.mergeBufferGeometries([tube, end(path[0]!), end(path.at(-1)!)])!;
}

/** A cylinder standing on (x, y, z), or turned to run out from the wall along z when `out` is set. */
export function cylinder(r: number, length: number, out = false, top = r): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(top, r, length, 32);
  return out ? g.rotateX(Math.PI / 2) : g;
}
