import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { alignments, gapsAround, type GapSide, type PlacedBox } from '../../domain/studio/scene-gaps';

type Collision = { cabinetCollides(cabinet: EditorCabinet): boolean };

const box = (c: EditorCabinet): PlacedBox => ({ id: c.id, x: c.x, z: c.z, y: c.y || 0, angle: c.angle, w: c.state.w, d: c.state.d, h: c.state.h });
/** The gaps on the given sides of a wardrobe in a scene, and what it lines up with. */
export function measureAround(scene: EditorScene, cabinet: EditorCabinet, sides: readonly GapSide[]) {
  const all = scene.wardrobes.map(box), gaps = gapsAround(box(cabinet), all, scene.studio, sides);
  return { gaps, aligned: alignments(box(cabinet), gaps, all) };
}

/** The measuring assistant's commands for wardrobes: the small move that lines one up while it is dragged. */
export function createAlignCommands(getScene: () => EditorScene, collision: Collision) {
  /** While a wardrobe is dragged: the nearest of touching its neighbour or the wall on either side, sitting
   * centred between them, or putting its front in line with another wardrobe's, within `tolerance` cm. The
   * pose to use (unchanged when nothing is that close, or when it would run into something). */
  function alignSnap(cabinet: EditorCabinet, tolerance: number): Pick<EditorCabinet, 'x' | 'z'> {
    const a = cabinet.angle * Math.PI / 180, u = { x: Math.cos(a), z: -Math.sin(a) }, f = { x: Math.sin(a), z: Math.cos(a) };
    const { gaps } = measureAround(getScene(), cabinet, ['left', 'right', 'back']), at = (side: GapSide) => gaps.find(g => g.side === side)?.distance;
    const left = at('left'), right = at('right'), moves: { s: number; t: number }[] = [];
    if (left !== undefined) moves.push({ s: -left, t: 0 });
    if (right !== undefined) moves.push({ s: right, t: 0 });
    if (left !== undefined && right !== undefined) moves.push({ s: (right - left) / 2, t: 0 });
    // Fronts in line with a wardrobe turned the same way.
    for (const o of getScene().wardrobes) {
      if (o.id === cabinet.id || Math.abs(((o.angle - cabinet.angle) % 360 + 540) % 360 - 180) > .5) continue;
      const off = (o.x - cabinet.x) * f.x + (o.z - cabinet.z) * f.z + (o.state.d - cabinet.state.d) / 2;
      moves.push({ s: 0, t: off });
    }
    const best = moves.filter(m => Math.abs(m.s) + Math.abs(m.t) > .05 && Math.abs(m.s) <= tolerance && Math.abs(m.t) <= tolerance)
      .sort((p, q) => Math.abs(p.s) + Math.abs(p.t) - Math.abs(q.s) - Math.abs(q.t))[0];
    if (!best) return { x: cabinet.x, z: cabinet.z };
    const round = (v: number) => Math.round(v * 10) / 10;
    const pose = { x: round(cabinet.x + u.x * best.s + f.x * best.t), z: round(cabinet.z + u.z * best.s + f.z * best.t) };
    return collision.cabinetCollides({ ...cabinet, ...pose }) ? { x: cabinet.x, z: cabinet.z } : pose;
  }
  return { alignSnap };
}
