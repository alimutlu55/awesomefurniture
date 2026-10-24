import * as THREE from 'three';

type V2 = { readonly x: number; readonly y: number };
type Edge = { a: V2; b: V2 };
/** A side of an interval in a band: where it is at a height. */
type Side = (y: number) => number;

/** The solid that a front outline and a side outline both allow, as seen in a drawing: a part made to two
 * elevations. `front` is closed outlines in (x, y), holes included (inside where an odd number of them cover);
 * `side` is one closed outline in (z, y). Built band by band between every corner's height: inside a band each
 * outline's edges are straight, so every piece is a block with flat faces. Caps are added only where the solid
 * starts or stops, so the outline drawn round it shows its real edges. Local x along, y up, z across. */
export function twoViewGeometry(front: readonly (readonly V2[])[], side: readonly V2[]): THREE.BufferGeometry {
  const ring = (list: readonly V2[]): Edge[] => list.map((a, i) => ({ a, b: list[(i + 1) % list.length]! }));
  const frontEdges = front.flatMap(ring), sideEdges = ring(side);
  const levels = [...new Set([...front.flat(), ...side].map(p => Math.round(p.y * 1e6) / 1e6))].sort((p, q) => p - q);
  const positions: number[] = [];
  const push = (...ps: THREE.Vector3[]) => ps.forEach(p => positions.push(p.x, p.y, p.z));
  /** A face of the solid, wound so its normal points `out`. */
  const quad = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3, s: THREE.Vector3, out: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(q, p).cross(new THREE.Vector3().subVectors(r, p));
    const m = new THREE.Vector3().subVectors(r, p).cross(new THREE.Vector3().subVectors(s, p));
    const normal = n.lengthSq() > m.lengthSq() ? n : m;
    if (normal.lengthSq() < 1e-14) return;
    if (normal.dot(out) < 0) push(p, s, r, p, r, q); else push(p, q, r, p, r, s);
  };
  /** Where edges cross a height, paired into the intervals they bound. */
  const intervals = (edges: readonly Edge[], y: number): [Side, Side][] => {
    const cuts = edges.filter(e => Math.min(e.a.y, e.b.y) < y && Math.max(e.a.y, e.b.y) > y).map(({ a, b }) => {
      const at: Side = h => a.x + (b.x - a.x) * (h - a.y) / (b.y - a.y);
      return { at, x: at(y) };
    }).sort((p, q) => p.x - q.x);
    const out: [Side, Side][] = [];
    for (let k = 0; k + 1 < cuts.length; k += 2) out.push([cuts[k]!.at, cuts[k + 1]!.at]);
    return out;
  };
  type Rect = { x0: number; x1: number; z0: number; z1: number };
  const tops: Rect[][] = [], bottoms: Rect[][] = [];
  for (let k = 0; k + 1 < levels.length; k++) {
    const y0 = levels[k]!, y1 = levels[k + 1]!, mid = (y0 + y1) / 2;
    if (y1 - y0 < 1e-6) continue;
    const bottom: Rect[] = [], top: Rect[] = [];
    for (const [fl, fr] of intervals(frontEdges, mid)) for (const [sl, sr] of intervals(sideEdges, mid)) {
      const v = (x: Side, z: Side, y: number) => new THREE.Vector3(x(y), y, z(y));
      const corners = (y: number) => [v(fl, sl, y), v(fr, sl, y), v(fr, sr, y), v(fl, sr, y)];
      const [a0, b0, c0, d0] = corners(y0), [a1, b1, c1, d1] = corners(y1);
      quad(a0!, b0!, b1!, a1!, new THREE.Vector3(0, 0, -1));
      quad(b0!, c0!, c1!, b1!, new THREE.Vector3(1, 0, 0));
      quad(c0!, d0!, d1!, c1!, new THREE.Vector3(0, 0, 1));
      quad(d0!, a0!, a1!, d1!, new THREE.Vector3(-1, 0, 0));
      bottom.push({ x0: fl(y0), x1: fr(y0), z0: sl(y0), z1: sr(y0) });
      top.push({ x0: fl(y1), x1: fr(y1), z0: sl(y1), z1: sr(y1) });
    }
    bottoms[k] = bottom; tops[k] = top;
  }
  // At each height, a cap where the solid below and the solid above do not both cover the floor plan.
  const inside = (rects: readonly Rect[] | undefined, x: number, z: number) => !!rects?.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  for (let k = 0; k < levels.length; k++) {
    const below = tops[k - 1], above = bottoms[k], y = levels[k]!, all = [...below ?? [], ...above ?? []];
    if (!all.length) continue;
    const xs = [...new Set(all.flatMap(r => [r.x0, r.x1]))].sort((p, q) => p - q), zs = [...new Set(all.flatMap(r => [r.z0, r.z1]))].sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) {
      const x0 = xs[i]!, x1 = xs[i + 1]!, z0 = zs[j]!, z1 = zs[j + 1]!, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const under = inside(below, cx, cz), over = inside(above, cx, cz);
      if (under === over) continue;
      quad(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y, z1), new THREE.Vector3(0, under ? 1 : -1, 0));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Plaster and paint are matt and plain: a planar mapping in metres is enough.
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uv.push((positions[i]! + positions[i + 2]!) / 100, positions[i + 1]! / 100);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
