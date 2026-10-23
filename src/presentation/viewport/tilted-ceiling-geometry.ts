import * as THREE from 'three';
import type { StudioCeiling } from '../../domain/studio/studio';

type Point = { x: number; y: number; z: number };
/** Shear the underside around its wall attachment, then trim the closed solid to the room's top. */
export function tiltedCeilingGeometry(c: StudioCeiling, top: number) {
  const rise = c.edgeRise ?? 0, cap = top + Math.abs(rise) + 1;
  const shape = new THREE.Shape(), first = c.profile[0]!, last = c.profile.at(-1)!;
  shape.moveTo(first.t, cap);
  c.profile.forEach(p => shape.lineTo(p.t, p.y));
  shape.lineTo(last.t, cap); shape.closePath();
  const source = new THREE.ExtrudeGeometry(shape, { depth: c.depth, bevelEnabled: false });
  const positions = source.getAttribute('position'), vertices: number[] = [];
  const add = (a: Point, b: Point, d: Point) => vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  const trim = (polygon: Point[]) => {
    const out: Point[] = [];
    for (let k = 0; k < polygon.length; k++) {
      const a = polygon[k]!, b = polygon[(k + 1) % polygon.length]!;
      if (a.y <= top) out.push(a);
      if ((a.y <= top) !== (b.y <= top)) {
        const f = (top - a.y) / (b.y - a.y);
        out.push({ x: a.x + (b.x - a.x) * f, y: top, z: a.z + (b.z - a.z) * f });
      }
    }
    return out;
  };
  const fan = (polygon: Point[]) => { for (let k = 1; k < polygon.length - 1; k++) add(polygon[0]!, polygon[k]!, polygon[k + 1]!); };
  for (let i = 0; i < positions.count; i += 3) {
    const triangle = [0, 1, 2].map(k => ({ x: positions.getX(i + k), y: positions.getY(i + k) + rise * positions.getZ(i + k) / c.depth, z: positions.getZ(i + k) }));
    fan(trim(triangle));
  }
  // The cap footprint is each profile strip clipped against its underside plane.
  for (let k = 0; k < c.profile.length - 1; k++) {
    const a = c.profile[k]!, b = c.profile[k + 1]!;
    if (b.t - a.t <= 1e-8) continue;
    const bottom = (x: number, z: number): Point => ({ x, z, y: a.y + (b.y - a.y) * (x - a.t) / (b.t - a.t) + rise * z / c.depth });
    const polygon = trim([bottom(a.t, 0), bottom(a.t, c.depth), bottom(b.t, c.depth), bottom(b.t, 0)]);
    fan(polygon.map(p => ({ ...p, y: top })));
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
