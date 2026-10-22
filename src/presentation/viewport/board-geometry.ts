import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VENEER_TILE } from './wood-textures';

/** A sanded, lacquered board edge: 1.5 mm, enough to catch a line of light, not a rounded edge. */
export const BOARD_EDGE = .15;

/** A board w × h × d (centimetres) with its edges eased by BOARD_EDGE. Its size is the board's nominal size,
 * so joins, hit areas and measurements are unchanged. */
export function boardBox(w: number, h: number, d: number) {
  const r = Math.min(BOARD_EDGE, Math.min(w, h, d) / 2 - .01);
  return r > .02 ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d);
}

/** UVs at the veneer's true scale, with the grain along the board: one UV unit is one VENEER_TILE, u runs
 * along the board's longer edge in the front view (up a side or a back, across a shelf or a top) on every face
 * that contains it, and each board starts at its own place on the sheet (`seed`, from where it stands), so
 * boards do not repeat one another and keep their figure when the wardrobe is rebuilt.
 * Works for any geometry: each vertex is mapped in the plane its normal faces most. */
interface BoardMapping { readonly sizeCm: readonly [number, number]; readonly grainAxis: 'u' | 'v' }
export function boardUVs(geometry: THREE.BufferGeometry, seed: number, direction?: 'vertical' | 'horizontal' | 'none', mapping?: BoardMapping) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3());
  const grain = direction === 'vertical' && size.y > Math.min(size.x, size.z) ? 1 : direction === 'horizontal' ? 0 : size.y > size.x ? 1 : 0;
  const pos = geometry.attributes.position as THREE.BufferAttribute, normal = geometry.attributes.normal as THREE.BufferAttribute | undefined;
  const uv = (geometry.attributes.uv as THREE.BufferAttribute | undefined) ?? new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  const du = fraction(seed * 12.9898), dv = fraction(seed * 78.233);
  const p = [0, 0, 0], n = [0, 0, 0];
  const imageSize = mapping?.sizeCm ?? (direction ? [231.1, 130] : [VENEER_TILE, VENEER_TILE]);
  const verticalImageGrain = mapping?.grainAxis === 'v';
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i); p[1] = pos.getY(i); p[2] = pos.getZ(i);
    n[0] = Math.abs(normal?.getX(i) ?? 0); n[1] = Math.abs(normal?.getY(i) ?? 0); n[2] = Math.abs(normal?.getZ(i) ?? 1);
    const facing = n[0]! >= n[1]! && n[0]! >= n[2]! ? 0 : n[1]! >= n[2]! ? 1 : 2;
    const inFace = [0, 1, 2].filter(a => a !== facing);
    const u = inFace.includes(grain) ? grain : inFace[0]!, v = inFace.find(a => a !== u)!;
    // Egger full-board scans have horizontal grain; the Swiss Krono sample has vertical grain.
    uv.setXY(i, p[verticalImageGrain ? v : u]! / imageSize[0]! + du, p[verticalImageGrain ? u : v]! / imageSize[1]! + dv);
  }
  uv.needsUpdate = true;
  geometry.setAttribute('uv', uv);
  return geometry;
}

/** A stable seed for a board from where it stands. */
export const boardSeed = (x: number, y: number, z: number) => fraction(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) * 1000;

function fraction(x: number) { return x - Math.floor(x); }
