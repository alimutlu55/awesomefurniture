import type { Studio } from '../studio/studio';
import { isWallUtility, openingNoun } from '../studio/wall-utilities';
import { isKitchen } from '../furniture/furniture';
import { unitAxes } from '../kitchen/kitchen-runs';
import { resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { mm } from './drawing';
import { type PlacedPiece, wallGeometry } from './room-pieces';

/** Less than this is a touch, not a clash. Centimetres. */
const TOUCH = .5;

/** The highest point of a piece above the floor: its top, or the highest point of a shaped top. Centimetres. */
export const pieceTop = (p: PlacedPiece) => p.y + (p.fixture ? p.design.h : Math.max(...resolveShape(p.design).top.map(q => q.y)));
const top = pieceTop;
const heights = (a: PlacedPiece, b: PlacedPiece) => Math.min(top(a), top(b)) - Math.max(a.y, b.y) > TOUCH;

/** Whether two footprints overlap by more than a touch (separating axes of two turned rectangles). */
function overlap(a: PlacedPiece, b: PlacedPiece) {
  const corners = (p: PlacedPiece) => {
    const { u, v } = unitAxes(p.angle), w = p.design.w / 2, d = p.design.d / 2;
    return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([s, t]) => ({ x: p.x + u.x * s! + v.x * t!, z: p.z + u.z * s! + v.z * t! }));
  };
  const ca = corners(a), cb = corners(b);
  for (const p of [a, b]) {
    const { u, v } = unitAxes(p.angle);
    for (const axis of [u, v]) {
      const project = (c: { x: number; z: number }[]) => c.map(q => q.x * axis.x + q.z * axis.z);
      const pa = project(ca), pb = project(cb);
      if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= TOUCH) return false;
    }
  }
  return true;
}

/** Whether two pieces occupy the same space: footprints and heights both overlapping by more than a touch. */
export const piecesOverlap = (a: PlacedPiece, b: PlacedPiece) => overlap(a, b) && heights(a, b);

/**
 * What to check before making, in the words a carpenter would use: two pieces in the same place, a piece in front of a
 * window or door at its height, a piece running past the end of its wall, a piece taller than its wall. Marks and wall
 * letters as on the drawings; lengths in millimetres.
 */
export function designChecks(studio: Studio | undefined, pieces: readonly PlacedPiece[], letters: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  pieces.forEach((a, k) => pieces.slice(k + 1).forEach(b => {
    if (piecesOverlap(a, b)) out.push(a.mark + ' and ' + b.mark + ' overlap');
  }));
  for (const p of pieces) {
    const w = p.wall && studio?.walls.find(x => x.id === p.wall), g = w && wallGeometry(studio!, w);
    if (!w || !g) continue;
    const letter = letters.get(w.id) ?? '';
    for (const o of g.openings) {
      // Kitchen units are meant to connect to water, gas, sockets and vents behind them; radiators, switches and structural openings must stay clear.
      if (isWallUtility(o.kind) && o.kind !== 'radiator' && o.kind !== 'switch' && isKitchen(p.design)) continue;
      const along = Math.min(p.hi, o.offset + o.width / 2) - Math.max(p.lo, o.offset - o.width / 2);
      const up = Math.min(top(p), o.sill + o.height) - Math.max(p.y, o.sill);
      if (along > TOUCH && up > TOUCH) out.push(p.mark + ' stands in front of the ' + openingNoun(o.kind) + ' on wall ' + letter);
    }
    const past = Math.max(g.face.start - p.lo, p.hi - g.face.end);
    if (past > TOUCH) out.push(p.mark + ' runs ' + mm(past) + ' past the end of wall ' + letter);
    if (top(p) - w.height > TOUCH) out.push(p.mark + ' is ' + mm(top(p) - w.height) + ' taller than wall ' + letter);
  }
  return out;
}
