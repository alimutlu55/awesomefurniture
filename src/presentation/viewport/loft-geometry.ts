import * as THREE from 'three';
import type { Point2 } from './frame-geometry';
/** Boards whose front has been reshaped keep an independent rear outline. */
export function loftGeometry(front: readonly Point2[], depth: number, z: number, back?: readonly Point2[]) {
  if (!back) {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(front.map(p => new THREE.Vector2(p.x, p.y))), { depth, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, z - depth / 2);
    return geo;
  }
  if (front.length !== back.length) throw new Error('Board outlines must have matching vertices');
  const positions: number[] = [];
  const vertex = (p: Point2, rear: boolean) => [p.x, p.y, z + (rear ? -depth : depth) / 2];
  const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  const faces = THREE.ShapeUtils.triangulateShape(front.map(p => new THREE.Vector2(p.x, p.y)), []);
  for (const [a, b, c] of faces as [number, number, number][]) {
    triangle(vertex(front[a]!, false), vertex(front[b]!, false), vertex(front[c]!, false));
    triangle(vertex(back[c]!, true), vertex(back[b]!, true), vertex(back[a]!, true));
  }
  for (let i = 0; i < front.length; i++) {
    const j = (i + 1) % front.length, fa = vertex(front[i]!, false), fb = vertex(front[j]!, false), ra = vertex(back[i]!, true), rb = vertex(back[j]!, true);
    triangle(ra, rb, fa); triangle(rb, fb, fa);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geo.computeVertexNormals();
  return geo;
}
