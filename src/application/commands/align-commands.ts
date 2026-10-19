import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { alignments, gapsAround, nearerWallEnds, wallEndsAround, type GapSide, type PlacedBox } from '../../domain/studio/scene-gaps';

type Collision = { cabinetCollides(cabinet: EditorCabinet): boolean };

const box = (c: EditorCabinet): PlacedBox => ({ id: c.id, x: c.x, z: c.z, y: c.y || 0, angle: c.angle, w: c.state.w, d: c.state.d, h: c.state.h });
/** A gap this small beside a unit is one to fill; a bigger one is room for another cabinet. Centimetres. */
export const FILL_REACH = 15;
/** The gaps on the given sides of a wardrobe in a scene, and what it lines up with. With `wallEnds`, a side reads
 * to where the wall behind stops (its end, a doorway) when that comes first: for the eye, never for fillers or snaps. */
export function measureAround(scene: EditorScene, cabinet: EditorCabinet, sides: readonly GapSide[], { wallEnds = false } = {}) {
  const all = scene.wardrobes.map(box), found = gapsAround(box(cabinet), all, scene.studio, sides);
  const gaps = wallEnds ? nearerWallEnds(found, wallEndsAround(box(cabinet), scene.studio, sides)) : found;
  return { gaps, aligned: alignments(box(cabinet), gaps, all) };
}

/** The measuring assistant's commands for wardrobes: the small move that lines one up while it is dragged. */
export function createAlignCommands(getScene: () => EditorScene, collision: Collision) {
  /** While a wardrobe is dragged: the nearest of touching its neighbour or the wall on either side, sitting
   * centred between them, or putting its front in line with another wardrobe's, within `tolerance` cm. The
   * pose to use (unchanged when nothing is that close, or when it would run into something). */
  function alignSnap(cabinet: EditorCabinet, tolerance: number, depth = true): Pick<EditorCabinet, 'x' | 'z'> & { y?: number } {
    const a = cabinet.angle * Math.PI / 180, u = { x: Math.cos(a), z: -Math.sin(a) }, f = { x: Math.sin(a), z: Math.cos(a) };
    const { gaps } = measureAround(getScene(), cabinet, ['left', 'right', 'back', 'top', 'bottom']), at = (side: GapSide) => gaps.find(g => g.side === side)?.distance;
    const left = at('left'), right = at('right'), y0 = cabinet.y || 0;
    // Along its width: touching a neighbour or the wall on either side, or centred between them.
    // A piece already touching something stays touching it: a snap never pulls it away from the side it was put against.
    const touchingLeft = left !== undefined && left <= .05, touchingRight = right !== undefined && right <= .05;
    const across: number[] = [];
    if (left !== undefined && !touchingRight) across.push(-left);
    if (right !== undefined && !touchingLeft) across.push(right);
    if (left !== undefined && right !== undefined && !touchingLeft && !touchingRight) across.push((right - left) / 2);
    // Along its depth: its front in line with a wardrobe turned the same way (not when it is pressed to a wall: the wall wins).
    const along: number[] = [], vertical: number[] = [];
    for (const o of getScene().wardrobes) {
      const oy0 = o.y || 0;
      if (o.id === cabinet.id || Math.abs(((o.angle - cabinet.angle) % 360 + 540) % 360 - 180) > .5) continue;
      if (y0 > .5 && oy0 > .5) {
        vertical.push(oy0 - y0, (oy0 + o.state.h) - (y0 + cabinet.state.h));
      }
      if (!depth || oy0 >= y0 + cabinet.state.h - .5 || oy0 + o.state.h <= y0 + .5) continue;
      along.push((o.x - cabinet.x) * f.x + (o.z - cabinet.z) * f.z + (o.state.d - cabinet.state.d) / 2);
    }
    // The two are separate choices: a front that is nearly in line must not stop it closing a gap beside a neighbour.
    const nearest = (moves: number[]) => moves.filter(m => Math.abs(m) > .05 && Math.abs(m) <= tolerance).sort((p, q) => Math.abs(p) - Math.abs(q))[0] ?? 0;
    const s = nearest(across), t = nearest(along), dy = y0 > .5 ? nearest(vertical) : 0;
    if (!s && !t && !dy) return { x: cabinet.x, z: cabinet.z };
    const round = (v: number) => Math.round(v * 10) / 10;
    let out: Pick<EditorCabinet, 'x' | 'z'> & { y?: number } = { x: cabinet.x, z: cabinet.z };
    for (const [ds, dt] of [[s, t], [s, 0], [0, t]] as const) {
      if (!ds && !dt) continue;
      const pose = { x: round(cabinet.x + u.x * ds + f.x * dt), z: round(cabinet.z + u.z * ds + f.z * dt) };
      if (!collision.cabinetCollides({ ...cabinet, ...pose })) { out = pose; break; }
    }
    if (dy) {
      const nextY = Math.max(0, round(y0 + dy));
      if (!collision.cabinetCollides({ ...cabinet, ...out, y: nextY })) out = { ...out, y: nextY };
    }
    return out;
  }
  /** Room beside a kitchen unit that a wider unit could fill: its gaps to the walls and units on either side, where
   * those are close (a gap that is a whole other cabinet wide is not one to fill). Centimetres. */
  function fillableGap(cabinet: EditorCabinet): number {
    const { gaps } = measureAround(getScene(), cabinet, ['left', 'right']);
    return Math.round(gaps.filter(g => g.distance > .05 && g.distance <= FILL_REACH).reduce((sum, g) => sum + g.distance, 0) * 10) / 10;
  }
  return { alignSnap, fillableGap };
}
