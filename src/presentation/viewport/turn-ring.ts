import * as THREE from 'three';

/** The ring drawn on the floor round a turnable piece while it is selected, as far out as its corners and a little more,
 * the same for every piece. `y` is its height above the piece's own floor. */
export function turnRing(width: number, depth: number, y = .5): { ring: THREE.Line; radius: number } {
  const radius = Math.hypot(width, depth) / 2 + 16, points: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2;
    points.push(new THREE.Vector3(Math.sin(a) * radius, y, Math.cos(a) * radius));
  }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x8d7d65, transparent: true, opacity: .55 }));
  return { ring, radius };
}
/** Where the ↻ button sits on the ring, in the piece's own frame: front left. */
export const turnButtonAt = (radius: number) => ({ x: -radius * .55, z: radius * .835 });
