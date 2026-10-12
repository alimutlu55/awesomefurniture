import * as THREE from 'three';
import { corner } from '../../domain/studio/studio';
import type { Studio } from '../../domain/studio/studio';

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

/** Oak floor boards, 14 cm wide and 1.2–2.2 m long, as they look on a real floor: long boards with
 * staggered joints, gentle tone changes from board to board, fine grain and hairline seams. Drawn once
 * into a repeating texture 448 cm long (along x) by 112 cm wide (8 boards). */
export const PLANK_TILE = Object.freeze({ long: 448, wide: 112 });
export function planks() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const g = canvas.getContext('2d')!;
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const px = 2048 / PLANK_TILE.long, row = 512 / 8;
  for (let i = 0; i < 8; i++) {
    const y = i * row;
    let x = -random() * 180 * px;
    while (x < 2048) {
      const len = (120 + random() * 100) * px, tone = 194 + Math.round(random() * 14);
      g.fillStyle = `rgb(${tone + 8},${Math.round(tone * .83)},${Math.round(tone * .6)})`;
      g.fillRect(x, y, len, row);
      // Fine grain along the board.
      for (let n = 0; n < 26; n++) {
        g.strokeStyle = `rgba(${random() > .45 ? '112,80,44' : '246,226,192'},${.04 + random() * .07})`;
        g.lineWidth = .5 + random() * 1.2;
        const gy = y + 3 + random() * (row - 6), wave = random() * 3;
        g.beginPath(); g.moveTo(x, gy); g.bezierCurveTo(x + len * .33, gy + wave, x + len * .66, gy - wave, x + len, gy + wave * .5); g.stroke();
      }
      g.fillStyle = 'rgba(92,64,34,.28)';
      g.fillRect(x, y, 1.5, row);
      x += len;
    }
    g.fillStyle = 'rgba(92,64,34,.3)';
    g.fillRect(0, y, 2048, 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / PLANK_TILE.long, 1 / PLANK_TILE.wide);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 8;
  return texture;
}

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
