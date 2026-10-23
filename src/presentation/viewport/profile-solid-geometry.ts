import * as THREE from 'three';
import { loopArea, type ProfileSolid } from '../../domain/geometry/profile-solid';
import { solidSideTriangles } from '../../domain/geometry/solid-surfaces';

/** Caps use polygon triangulation, so reentrant corners remain holes rather than a convex hull. */
export function profileSolidGeometry(shape: ProfileSolid, depth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const add = (a: { t: number; y: number; u: number }, b: typeof a, c: typeof a) => {
    for (const p of [a, b, c]) positions.push(p.t, p.y, p.u * depth);
  };
  const positiveOutline = loopArea(shape.loops[0]!.map(i => shape.rings[0]!.points[i]!)) > 0;
  for (const triangle of solidSideTriangles(shape)) {
    const [a, b, c] = triangle;
    if (positiveOutline) add(a, b, c); else add(a, c, b);
  }
  for (const ring of [shape.rings[0]!, shape.rings.at(-1)!]) {
    const loops = shape.loops.map(loop => loop.map(i => ring.points[i]!));
    const indices = shape.loops.flat(), vectors = loops.map(loop => loop.map(p => new THREE.Vector2(p.t, p.y)));
    const triangles = THREE.ShapeUtils.triangulateShape(vectors[0]!, vectors.slice(1));
    for (const face of triangles) {
      const points = face.map(i => ({ ...ring.points[indices[i]!]!, u: ring.u }));
      const a = points[0]!, b = points[1]!, c = points[2]!;
      const positive = (b.t - a.t) * (c.y - a.y) - (b.y - a.y) * (c.t - a.t) > 0;
      if (positive === (ring.u === 1)) add(a, b, c); else add(a, c, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); return geometry;
}
