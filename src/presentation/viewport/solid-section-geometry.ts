import * as THREE from 'three';
import type { BoundaryPoint, BoundarySection } from '../../domain/geometry/boundary';
import { sectionTriangles, type SolidPoint } from '../../domain/geometry/solid-boundary';
import type { StudioOpening, StudioWall } from '../../domain/studio/studio';
import { isWallUtility } from '../../domain/studio/wall-utilities';

/** A loft through editable depth rings. Caps and side faces share the same vertices and diagonals. */
export function solidSectionGeometry(sections: readonly BoundarySection[], local: (p: SolidPoint) => { x: number; y: number; z: number }, holes: readonly (readonly BoundaryPoint[])[] = []) {
  const vertices: number[] = [];
  const vector = (p: SolidPoint) => { const q = local(p); return new THREE.Vector3(q.x, q.y, q.z); };
  const origin = vector({ t: 0, y: 0, u: 0 }), t = vector({ t: 1, y: 0, u: 0 }).sub(origin);
  const y = vector({ t: 0, y: 1, u: 0 }).sub(origin), u = vector({ t: 0, y: 0, u: 1 }).sub(origin);
  const handedness = t.cross(y).dot(u);
  const outline = sections[0]!.outline;
  const area = outline.reduce((sum, p, k) => { const q = outline[(k + 1) % outline.length]!; return sum + p.t * q.y - q.t * p.y; }, 0);
  const add = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, flip = false) => {
    for (const p of flip ? [a, c, b] : [a, b, c]) vertices.push(p.x, p.y, p.z);
  };
  for (const triangle of sectionTriangles(sections)) add(vector(triangle[0]), vector(triangle[1]), vector(triangle[2]), area * handedness < 0);
  for (const hole of holes) for (let k = 0; k < sections.length - 1; k++) {
    const rings = [{ u: sections[k]!.u, outline: hole }, { u: sections[k + 1]!.u, outline: hole }];
    for (const triangle of sectionTriangles(rings)) add(vector(triangle[0]), vector(triangle[1]), vector(triangle[2]), handedness < 0);
  }
  for (const index of [0, sections.length - 1]) {
    const ring = sections[index]!, contour = ring.outline.map(p => new THREE.Vector2(p.t, p.y));
    const points = [...ring.outline, ...holes.flat()];
    for (const face of THREE.ShapeUtils.triangulateShape(contour, holes.map(hole => hole.map(p => new THREE.Vector2(p.t, p.y))))) {
      const [a, b, c] = face.map(k => vector({ ...points[k]!, u: ring.u })) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      const toward = b.clone().sub(a).cross(c.clone().sub(a)).dot(u);
      add(a, b, c, index === 0 ? toward > 0 : toward < 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function wallSectionGeometry(wall: StudioWall, openings: readonly StudioOpening[]) {
  const holes = openings.filter(o => !isWallUtility(o.kind)).map(o => [
    { t: o.offset - o.width / 2, y: o.sill }, { t: o.offset - o.width / 2, y: o.sill + o.height },
    { t: o.offset + o.width / 2, y: o.sill + o.height }, { t: o.offset + o.width / 2, y: o.sill },
  ]);
  return solidSectionGeometry(wall.sections!, p => ({ x: p.t, y: p.y, z: (p.u - .5) * wall.thickness }), holes);
}
