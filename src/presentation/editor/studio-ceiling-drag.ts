import { roomHeight } from '../../domain/studio/studio';
import type { Studio, StudioCeiling } from '../../domain/studio/studio';
import { ceilingFrame, profileAt } from '../../domain/studio/studio-ceiling';
import { alignTo, type Align } from './align-snap';
import type { RoomHandle, RoomMeasure } from './studio-editor.ports';
import { measureNumber } from './editor-format.js';

/** The geometry of shaping a ceiling on the model: where its height pills and depth grip sit, which way
 * they move, what a dragged point snaps to, and the ruler that says where it is. Plain data in scene
 * centimetres; the room editor turns it into edits. */

const f = (v: number) => measureNumber(Math.round(v)) + ' cm';
type Frame = NonNullable<ReturnType<typeof ceilingFrame>>;

/** The direction a ceiling's points move in on the floor: along its wall, or into the room. */
export function runAxis(fr: Frame, c: StudioCeiling) {
  return c.run === 'along' ? { x: fr.line.ux, z: fr.line.uz } : { x: fr.line.nx, z: fr.line.nz };
}
/** A profile point on the model: on the underside's edge nearest the room, where it is seen from inside. */
export function pointAt(fr: Frame, c: StudioCeiling, k: number) {
  const p = c.profile[k]!, mid = (fr.along.from + fr.along.to) / 2;
  const floor = c.run === 'along' ? fr.at(p.t, c.depth) : fr.at(mid, p.t);
  return { x: floor.x, y: p.y, z: floor.z };
}

/** A dot on every point of the selected ceiling, and a grip on its edge to set how far it reaches into the
 * room (a ceiling along a wall; a sloped roof reaches to its last point). */
export function ceilingHandles(room: Studio, c: StudioCeiling): RoomHandle[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  // A dot a finger can cover: the height it sets is drawn beside it as a dimension line, not on the dot.
  const axis = runAxis(fr, c), out: RoomHandle[] = c.profile.map((p, k) => ({
    key: 'ceiling:' + c.id + ':' + k, kind: 'ceiling' as const, id: c.id, index: k, ...pointAt(fr, c, k),
    label: 'Point ' + (k + 1) + ', ' + f(p.y) + ' high. Drag up or down, or along to move it; tap to type its height', ux: axis.x, uz: axis.z,
  }));
  if (c.run === 'along') {
    // In the middle of its longest stretch, clear of the pills.
    let best = 0;
    for (let k = 1; k < c.profile.length - 1; k++) if (c.profile[k + 1]!.t - c.profile[k]!.t > c.profile[best + 1]!.t - c.profile[best]!.t) best = k;
    const s = (c.profile[best]!.t + c.profile[best + 1]!.t) / 2, at = fr.at(s, c.depth);
    out.push({ key: 'depth:' + c.id, kind: 'depth', id: c.id, x: at.x, y: profileAt(c.profile, s) ?? roomHeight(room), z: at.z,
      label: 'How far it reaches into the room. Drag in or out', nx: fr.line.nx, nz: fr.line.nz });
  }
  return out;
}

/** Where a dragged point goes: level with other points or the ceiling, and onto its neighbours' positions
 * (a step), the wall's ends or other points along the run. `tolerance` is in centimetres. */
export function snapPoint(room: Studio, c: StudioCeiling, k: number, raw: { t: number; y: number }, locks: { t: Align | null; y: Align | null }, tolerance: number) {
  const fr = ceilingFrame(room, c);
  if (!fr) return { at: raw, locks };
  const others = c.profile.filter((_, j) => j !== k);
  const ys: Align[] = [{ v: roomHeight(room), label: 'Ceiling' }, ...others.map(p => ({ v: p.y, label: 'Level' }))];
  const ends = c.run === 'along' ? [fr.face.start, fr.face.end] : [0];
  const ts: Align[] = [...others.map(p => ({ v: p.t, label: 'Step' })), ...ends.map(v => ({ v, label: 'Wall' }))];
  const y = alignTo(raw.y, ys, locks.y, tolerance), t = alignTo(raw.t, ts, locks.t, tolerance);
  return { at: { t: t?.v ?? raw.t, y: y?.v ?? raw.y }, locks: { t, y } };
}

/** The ruler while a point moves: from the nearer end of the wall (or from the wall, for a sloped roof)
 * to the point, just under the underside. */
export function pointRuler(room: Studio, c: StudioCeiling, k: number): RoomMeasure | null {
  const fr = ceilingFrame(room, c), p = c.profile[k];
  if (!fr || !p) return null;
  const y = Math.max(8, p.y - 12);
  if (c.run === 'across') {
    const s = (fr.along.from + fr.along.to) / 2, a = fr.at(s, 0), b = fr.at(s, p.t);
    return p.t > 1 ? { a: { x: a.x, y, z: a.z }, b: { x: b.x, y, z: b.z }, text: f(p.t) } : null;
  }
  const end = p.t - fr.face.start <= fr.face.end - p.t ? fr.face.start : fr.face.end, a = fr.at(end, c.depth), b = fr.at(p.t, c.depth);
  return Math.abs(p.t - end) > 1 ? { a: { x: a.x, y, z: a.z }, b: { x: b.x, y, z: b.z }, text: f(Math.abs(p.t - end)) } : null;
}
/** The ruler while the depth grip moves: from the wall's face into the room. */
export function depthRuler(room: Studio, c: StudioCeiling, h: RoomHandle): RoomMeasure | null {
  const fr = ceilingFrame(room, c);
  if (!fr) return null;
  const s = (h.x - fr.line.a.x) * fr.line.ux + (h.z - fr.line.a.z) * fr.line.uz, a = fr.at(s, 0), b = fr.at(s, c.depth), y = Math.max(8, h.y - 12);
  return { a: { x: a.x, y, z: a.z }, b: { x: b.x, y, z: b.z }, text: f(c.depth) };
}

/** A point's height as a dimension line from the floor up to it, beside the ceiling's edge: what a tape reads.
 * Its number sits on the line, below the point, so the finger on the point never covers it. Tap it to type.
 * `at` places it elsewhere along the run (the middle of a level stretch). */
export function heightRuler(room: Studio, c: StudioCeiling, k: number, at?: number): RoomMeasure | null {
  const fr = ceilingFrame(room, c), p = c.profile[k];
  if (!fr || !p) return null;
  const t = at ?? p.t, mid = (fr.along.from + fr.along.to) / 2, floor = c.run === 'along' ? fr.at(t, c.depth) : fr.at(mid, t);
  return { a: { x: floor.x, y: 0, z: floor.z }, b: { x: floor.x, y: p.y, z: floor.z }, text: f(p.y), axis: 'height', edit: 'p' + k };
}
/** The heights at rest, one per level: a level stretch (a landing, the low end) has one, in its middle. */
export function restHeights(room: Studio, c: StudioCeiling): RoomMeasure[] {
  const out: (RoomMeasure | null)[] = [];
  for (let k = 0; k < c.profile.length;) {
    let e = k;
    while (e + 1 < c.profile.length && Math.abs(c.profile[e + 1]!.y - c.profile[k]!.y) < .05 && c.profile[e + 1]!.t > c.profile[e]!.t) e++;
    out.push(heightRuler(room, c, k, (c.profile[k]!.t + c.profile[e]!.t) / 2));
    k = e + 1;
  }
  return out.filter((m): m is RoomMeasure => !!m);
}
