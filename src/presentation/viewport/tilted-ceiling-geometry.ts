import * as THREE from 'three';
import type { StudioCeiling } from '../../domain/studio/studio';

type Point = { x: number; y: number; z: number };
/** Extrude the complete face, shear around its attachment, and close every cut at the room top. */
export function tiltedCeilingGeometry(c: StudioCeiling, top: number) {
  const rise = c.edgeRise ?? 0, cap = top + Math.abs(rise) + 1;
  const shape = new THREE.Shape(), first = c.profile[0]!, last = c.profile.at(-1)!;
  const outline = c.outline ?? [...c.profile, { t: last.t, y: cap }, { t: first.t, y: cap }];
  shape.moveTo(outline[0]!.t, outline[0]!.y);
  outline.slice(1).forEach(p => shape.lineTo(p.t, p.y)); shape.closePath();
  const source = new THREE.ExtrudeGeometry(shape, { depth: c.depth, bevelEnabled: false });
  const positions = source.getAttribute('position'), vertices: number[] = [];
  const add = (a: Point, b: Point, d: Point) => vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  const cuts = new Map<string, [Point, Point]>(), stamp = (p: Point) => Math.round(p.x * 1e5) + ':' + Math.round(p.z * 1e5);
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(k => ({ x: positions.getX(i + k),
      y: positions.getY(i + k) + rise * positions.getZ(i + k) / c.depth, z: positions.getZ(i + k) }));
    const polygon: Point[] = [], intersections: Point[] = [];
    for (let k = 0; k < 3; k++) {
      const a = triangle[k]!, b = triangle[(k + 1) % 3]!;
      if (a.y <= top) polygon.push(a);
      if (Math.abs(a.y - top) < 1e-7) intersections.push(a);
      if ((a.y <= top) !== (b.y <= top)) {
        const f = (top - a.y) / (b.y - a.y), p = { x: a.x + (b.x - a.x) * f, y: top, z: a.z + (b.z - a.z) * f };
        polygon.push(p); intersections.push(p);
      }
    }
    for (let k = 1; k < polygon.length - 1; k++) add(polygon[0]!, polygon[k]!, polygon[k + 1]!);
    const unique = [...new Map(intersections.map(p => [stamp(p), p])).values()];
    if (unique.length === 2 && triangle.some(p => p.y > top + 1e-7)) {
      const pair = unique as [Point, Point]; cuts.set(pair.map(stamp).sort().join('/'), pair);
    }
  }
  // Join triangle intersections into closed contours; each contour may be concave.
  while (cuts.size) {
    const [key, pair] = cuts.entries().next().value!, loop = [...pair]; cuts.delete(key);
    const start = stamp(loop[0]!);
    let end = stamp(loop.at(-1)!);
    while (end !== start) {
      const next = [...cuts].find(([, [a, b]]) => stamp(a) === end || stamp(b) === end);
      if (!next) break;
      cuts.delete(next[0]);
      const p = stamp(next[1][0]) === end ? next[1][1] : next[1][0]; loop.push(p); end = stamp(p);
    }
    if (end !== start || loop.length < 4) continue;
    loop.pop();
    for (const [a, b, d] of THREE.ShapeUtils.triangulateShape(loop.map(p => new THREE.Vector2(p.x, p.z)), [])) {
      const p = loop[a!]!, q = loop[b!]!, r = loop[d!]!;
      if ((q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z) >= 0) add(p, q, r); else add(p, r, q);
    }
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
