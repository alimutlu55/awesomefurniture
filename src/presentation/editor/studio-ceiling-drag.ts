import { roomHeight } from '../../domain/studio/studio';
import type { Studio, StudioCeiling } from '../../domain/studio/studio';
import { outerEdgePoint, outerEdgeHeight, visibleEdgeHeight } from '../../domain/studio/ceiling-edge';
import { ceilingFrame, profileAt } from '../../domain/studio/studio-ceiling';
import type { RoomHandle, RoomMeasure } from './studio-editor.ports';
import { measureNumber, unitSuffix } from './editor-format.js';

/** A ceiling shape on the model: where its depth and lift grips sit, which way they move, and the rulers that
 * say where it is. Plain data in scene centimetres; the room editor turns it into edits. Its outline is edited
 * face on in the Shape editor. */

const f = (v: number) => measureNumber(Math.round(v)) + unitSuffix();
type Frame = NonNullable<ReturnType<typeof ceilingFrame>>;

/** The direction a ceiling's points move in on the floor: along its wall, or into the room. */
export function runAxis(fr: Frame, c: StudioCeiling) {
  return c.run === 'along' ? { x: fr.line.ux, z: fr.line.uz } : { x: fr.line.nx, z: fr.line.nz };
}
/** A profile point on the model: on the underside's edge nearest the room, where it is seen from inside. */
export function pointOnEdge(fr: Frame, c: StudioCeiling, k: number, fraction = 0) {
  const a = c.profile[k]!, b = c.profile[k + 1] ?? a, t = a.t + (b.t - a.t) * fraction;
  const floor = c.run === 'along' ? fr.at(t, c.depth) : fr.at(fr.along.to, t);
  return { x: floor.x, y: visibleEdgeHeight(fr.studio, c, a.y + (b.y - a.y) * fraction), z: floor.z };
}

/** A ceiling shape's grips on the model: one on its edge to set how far it reaches into the room (a shape along a
 * wall), and one to lift its outer edge. Its outline is drawn and edited in the Shape editor. */
export function ceilingHandles(room: Studio, c: StudioCeiling): RoomHandle[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  const out: RoomHandle[] = [];
  if (c.run === 'along') {
    // On the longest stretch, three quarters along, clear of the lift grip.
    let best = 0;
    for (let k = 1; k < c.profile.length - 1; k++) if (c.profile[k + 1]!.t - c.profile[k]!.t > c.profile[best + 1]!.t - c.profile[best]!.t) best = k;
    const s = c.profile[best]!.t + (c.profile[best + 1]!.t - c.profile[best]!.t) * .75, at = fr.at(s, c.depth);
    out.push({ key: 'depth:' + c.id, kind: 'depth', id: c.id, x: at.x, y: visibleEdgeHeight(room, c, profileAt(c.profile, s) ?? roomHeight(room)), z: at.z,
      label: 'How far it reaches into the room. Drag in or out', nx: fr.line.nx, nz: fr.line.nz });
  }
  const outer = outerEdgePoint(c), at = c.run === 'along' ? fr.at(outer.t, c.depth) : fr.at(fr.along.from + (fr.along.to - fr.along.from) * .25, outer.t);
  out.push({ key: 'tilt:' + c.id, kind: 'tilt', id: c.id, ...at, y: Math.min(roomHeight(room), outerEdgeHeight(c)),
    label: 'Lift outer edge. Drag up or down; the edge attached to the wall stays fixed. Tap to type the outer edge height' });
  return out;
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
  return { a: { x: floor.x, y: 0, z: floor.z }, b: { x: floor.x, y: visibleEdgeHeight(room, c, p.y), z: floor.z }, text: f(visibleEdgeHeight(room, c, p.y)), axis: 'height', edit: 'p' + k };
}
/** The heights at rest, one per level: a level stretch (a landing, the low end) has one, in its middle. */
export function restHeights(room: Studio, c: StudioCeiling): RoomMeasure[] {
  const out: (RoomMeasure | null)[] = [];
  for (let k = 0; k < c.profile.length;) {
    let e = k;
    while (e + 1 < c.profile.length && Math.abs(c.profile[e + 1]!.y - c.profile[k]!.y) < .05 && c.profile[e + 1]!.t > c.profile[e]!.t) e++;
    // A shape standing on the floor (a pillar) has no clear height there to read.
    if (c.profile[k]!.y >= 1) out.push(heightRuler(room, c, k, (c.profile[k]!.t + c.profile[e]!.t) / 2));
    k = e + 1;
  }
  return out.filter((m): m is RoomMeasure => !!m);
}

/** Show both the fixed attachment and the moving edge during a tilt. */
export function outerEdgeMeasures(room: Studio, c: StudioCeiling, h: RoomHandle): RoomMeasure[] {
  const fr = ceilingFrame(room, c);
  if (!fr) return [];
  const outer = outerEdgePoint(c), y = Math.min(roomHeight(room), outerEdgeHeight(c));
  const first = c.profile[0]!, fixed = c.run === 'along' ? fr.at(outer.t, 0) : fr.at(fr.local(h).s, first.t);
  const attached = { ...fixed, y: c.run === 'along' ? outer.y : first.y }, moving = { x: h.x, y, z: h.z };
  return [
    { a: { ...moving, y: 0 }, b: moving, text: f(y), axis: 'height', edit: 'outer' },
    { a: attached, b: moving, text: 'Wall edge fixed' },
  ];
}
