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

/** Oak floor boards 14 cm wide, with staggered joints and a little colour from board to board, drawn
 * once into a repeating texture (112 cm square). */
export function planks() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!;
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tones = ['#c9a676', '#c09c6b', '#cfae80', '#bb9765', '#c6a272'];
  for (let i = 0; i < 8; i++) {
    const y = i * 64, joint = Math.floor(random() * 512);
    for (const [x0, x1] of [[joint - 512, joint], [joint, joint + 512]] as const) {
      g.fillStyle = tones[Math.floor(random() * tones.length)]!;
      g.fillRect(x0, y, x1 - x0, 64);
      // Fine grain along the board.
      for (let n = 0; n < 14; n++) {
        g.strokeStyle = `rgba(${random() > .5 ? '120,86,48' : '238,214,176'},${.05 + random() * .08})`;
        g.lineWidth = .6 + random();
        const gy = y + 4 + random() * 56;
        g.beginPath(); g.moveTo(x0, gy); g.bezierCurveTo(x0 + 170, gy + random() * 4 - 2, x0 + 340, gy + random() * 4 - 2, x1, gy); g.stroke();
      }
    }
    g.fillStyle = 'rgba(92,64,34,.55)';
    g.fillRect(0, y, 512, 2);
    g.fillRect(joint, y, 2, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 112, 1 / 112);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 8;
  return texture;
}
