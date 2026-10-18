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
  function alignSnap(cabinet: EditorCabinet, tolerance: number, depth = true): Pick<EditorCabinet, 'x' | 'z'> {
    const a = cabinet.angle * Math.PI / 180, u = { x: Math.cos(a), z: -Math.sin(a) }, f = { x: Math.sin(a), z: Math.cos(a) };
    const { gaps } = measureAround(getScene(), cabinet, ['left', 'right', 'back']), at = (side: GapSide) => gaps.find(g => g.side === side)?.distance;
    const left = at('left'), right = at('right');
    // Along its width: touching a neighbour or the wall on either side, or centred between them.
    const across: number[] = [];
    if (left !== undefined) across.push(-left);
    if (right !== undefined) across.push(right);
    if (left !== undefined && right !== undefined) across.push((right - left) / 2);
    // Along its depth: its front in line with a wardrobe turned the same way (not when it is pressed to a wall: the wall wins).
    const along: number[] = [];
    if (depth) for (const o of getScene().wardrobes) {
      if (o.id === cabinet.id || Math.abs(((o.angle - cabinet.angle) % 360 + 540) % 360 - 180) > .5) continue;
      along.push((o.x - cabinet.x) * f.x + (o.z - cabinet.z) * f.z + (o.state.d - cabinet.state.d) / 2);
    }
    // The two are separate choices: a front that is nearly in line must not stop it closing a gap beside a neighbour.
    const nearest = (moves: number[]) => moves.filter(m => Math.abs(m) > .05 && Math.abs(m) <= tolerance).sort((p, q) => Math.abs(p) - Math.abs(q))[0] ?? 0;
    const s = nearest(across), t = nearest(along);
    if (!s && !t) return { x: cabinet.x, z: cabinet.z };
    const round = (v: number) => Math.round(v * 10) / 10;
    for (const [ds, dt] of [[s, t], [s, 0], [0, t]] as const) {
      if (!ds && !dt) continue;
      const pose = { x: round(cabinet.x + u.x * ds + f.x * dt), z: round(cabinet.z + u.z * ds + f.z * dt) };
      if (!collision.cabinetCollides({ ...cabinet, ...pose })) return pose;
    }
    return { x: cabinet.x, z: cabinet.z };
  }
  return { alignSnap };
}
