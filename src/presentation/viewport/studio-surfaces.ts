import * as THREE from 'three';
import { corner } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';
import { oakMaps, PLANK_TILE_CM } from './wood-textures';
import type { OakMaps } from './wood-textures';

/** The corners of the room's closed loop of walls, in order, or null when no walls close a loop (a single
 * wall, a corner, an alcove...). Walls standing free inside the room are not part of it. Floor and
 * ceiling follow this outline. */
export function roomOutline(studio: Studio): { x: number; z: number }[] | null {
  for (const first of studio.walls) {
    const order = [first];
    let at = first.b;
    while (at !== first.a) {
      const next = studio.walls.find(w => !order.includes(w) && (w.a === at || w.b === at));
      if (!next) break;
      order.push(next);
      at = next.a === at ? next.b : next.a;
    }
    if (at !== first.a || order.length < 3) continue;
    const points: { x: number; z: number }[] = [];
    let from = first.a;
    for (const w of order) {
      const c = corner(studio, from);
      if (!c) return null;
      points.push({ x: c.x, z: c.z });
      from = w.a === from ? w.b : w.a;
    }
    return points;
  }
  return null;
}

/** Oak floor boards: the photographed Oak Wood Planks (wood-textures.ts), 1.2 m square, boards along x.
 * UVs in centimetres give the true size: the colour map's repeat is one tile per PLANK_TILE (in Three r128 every
 * map follows the colour map's repeat and offset). The caller disposes the three textures. */
export const PLANK_TILE = Object.freeze({ long: PLANK_TILE_CM, wide: PLANK_TILE_CM });
export function planks(): OakMaps {
  const maps = oakMaps(document, 'planks');
  maps.map.repeat.set(1 / PLANK_TILE.long, 1 / PLANK_TILE.wide);
  return maps;
}
export const disposeMaps = (maps: OakMaps) => { maps.map.dispose(); maps.roughnessMap.dispose(); maps.normalMap.dispose(); };

/** A soft shadow that fades from dark at u = 0 to nothing at u = 1, for where surfaces meet (a wall and the
 * floor, two walls): the cue that makes a room in a photograph look solid. */
export function contactShade() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 4;
  const g = canvas.getContext('2d')!, gradient = g.createLinearGradient(0, 0, 64, 0);
  gradient.addColorStop(0, 'rgba(48,38,26,.34)');
  gradient.addColorStop(.35, 'rgba(48,38,26,.12)');
  gradient.addColorStop(1, 'rgba(48,38,26,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
