import type { EditorCabinet, EditorScene } from '../projects/editor-scene';
import { smallestMove, type AlignTarget } from '../../domain/geometry/alignment';
import { alignments, cornerMoves, gapsAround, nearerWallEnds, wallEndsAround, type GapSide, type PlacedBox } from '../../domain/studio/scene-gaps';

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

/** How close a size dragged on a slider must come to one that lines the piece up to catch it. A slider spans hundreds
 * of centimetres in a few hundred pixels, so a hand cannot land on a line such as 218.2 cm; a value farther away than
 * this was meant and is kept. Typed values are never snapped. Centimetres. */
export const SIZE_SNAP = .5;
const turned = (a: EditorCabinet, b: EditorCabinet) => Math.abs(((a.angle - b.angle) % 360 + 540) % 360 - 180) > .5;
/** The sizes `key` of a wardrobe can be dragged to that line it up with what is around it, as the measuring assistant
 * shows them: its top level with a neighbour's; its side touching the nearer neighbour or wall, or filling the gap; its
 * front in line with a neighbour against the same wall. Centimetres. */
export function sizeTargets(scene: EditorScene, cabinet: EditorCabinet, key: 'w' | 'h' | 'd'): AlignTarget[] {
  const s = cabinet.state, y0 = cabinet.y || 0, out: AlignTarget[] = [], a = cabinet.angle * Math.PI / 180;
  const u = { x: Math.cos(a), z: -Math.sin(a) }, f = { x: Math.sin(a), z: Math.cos(a) };
  const { gaps } = measureAround(scene, cabinet, key === 'w' ? ['left', 'right'] : []);
  const gap = (side: GapSide) => gaps.find(g => g.side === side)?.distance;
  // Neighbours turned the same way and standing beside it (less than 30 cm between their sides).
  const beside = scene.wardrobes.filter(o => o.id !== cabinet.id && !turned(o, cabinet)
    && Math.abs((o.x - cabinet.x) * u.x + (o.z - cabinet.z) * u.z) - (o.state.w + s.w) / 2 < 30);
  if (key === 'h') {
    // Not "up to the ceiling": the editor lets a top come CEILING_CLEARANCE_TOLERANCE above it, so the slider's own end
    // is the ceiling as the editor sees it, and a snap a few millimetres short of it would fight the slider.
    for (const o of beside) if (Math.abs((o.y || 0) - y0) < .5) out.push({ v: o.state.h, label: 'Level with ' + o.name, kind: 'level' });
  }
  if (key === 'w') {
    const left = gap('left'), right = gap('right');
    const near = Math.min(left ?? Infinity, right ?? Infinity);
    if (Number.isFinite(near) && near > .05) out.push({ v: s.w + 2 * near, label: 'Touching', kind: 'touch' });
    if (left !== undefined && right !== undefined && left > .05 && right > .05) out.push({ v: s.w + left + right, label: 'Filling the gap', kind: 'fill' });
  }
  if (key === 'd') {
    // Backs in line (against the same wall): the same depth puts the fronts in line.
    for (const o of beside) {
      const back = (o.x - cabinet.x) * f.x + (o.z - cabinet.z) * f.z - (o.state.d - s.d) / 2;
      if (Math.abs(back) < .5) out.push({ v: o.state.d, label: 'Front in line with ' + o.name, kind: 'fronts' });
    }
  }
  return out.filter(t => Number.isFinite(t.v) && t.v > 0).map(t => ({ ...t, v: Math.round(t.v * 10) / 10 }));
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
    // A quarter turn from a neighbour (an L-shaped run): a side in line with its front, or the front in line with its side.
    if (depth) for (const o of getScene().wardrobes) {
      const c = cornerMoves(box(cabinet), box(o));
      if (!touchingLeft && !touchingRight) across.push(...c.across.map(m => m.move));
      along.push(...c.along.map(m => m.move));
    }
    // The two are separate choices: a front that is nearly in line must not stop it closing a gap beside a neighbour.
    const s = smallestMove(across, tolerance), t = smallestMove(along, tolerance), dy = y0 > .5 ? smallestMove(vertical, tolerance) : 0;
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
