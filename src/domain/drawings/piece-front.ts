import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { plinthOf } from '../wardrobe/carcass';
import { resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { type Item, type Line, type P, line, mm, note, rect } from './drawing';
import { type Front, piecefronts } from './fronts';
import { type PlacedPiece, pieceName } from './room-pieces';

/** How far a hidden outline stands in from its true edges. Centimetres. */
const INSET = 1;

/** The height of a design's top at `x` from its left face: the lower of two points at a step. Centimetres. */
export function topAt(design: EditorDesign, x: number) {
  const top = resolveShape(design).top;
  let best = Infinity;
  for (let k = 0; k < top.length - 1; k++) {
    const a = top[k]!, b = top[k + 1]!;
    if (x < a.x - 1e-6 || x > b.x + 1e-6) continue;
    best = Math.min(best, b.x - a.x < 1e-6 ? Math.min(a.y, b.y) : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
  }
  return Number.isFinite(best) ? best : design.h;
}

/** How a front opens, drawn on it: two long-dashed lines from the edge that moves meeting at the hinges (a door at
 * its hinge side, a lift-up flap at its top, a fall-down door at its bottom). Drawers and fixed fronts have none. */
function swing(f: Front, at: (x: number, y: number) => P, top: (x: number) => number): Line[] {
  const y1 = (x: number) => Math.min(f.y1, top(x)), mid = (f.x0 + f.x1) / 2, path = (a: P, apex: P, b: P): Line => ({ kind: 'line', stroke: 'swing', points: [a, apex, b] });
  if (f.opens === 'side') {
    const hinge = f.hinge === 'right' ? f.x1 : f.x0, free = f.hinge === 'right' ? f.x0 : f.x1;
    return [path(at(free, f.y0), at(hinge, (f.y0 + y1(hinge)) / 2), at(free, y1(free)))];
  }
  if (f.opens === 'up') return [path(at(f.x0, f.y0), at(mid, y1(mid)), at(f.x1, f.y0))];
  if (f.opens === 'down') return [path(at(f.x0, y1(f.x0)), at(mid, f.y0), at(f.x1, y1(f.x1)))];
  return [];
}

/** A piece seen from the front, its left face `left` along the elevation and its bottom at its own height: the outline
 * (following a sloped or stepped top), the plinth, its fronts with how each opens and what appliance it is, what is
 * behind them dashed (a cupboard's shelves, a wardrobe's fittings and rails), and its mark. A sink or hob is its centre
 * line on the worktop; a shelf its board. Millimetres. */
export function pieceFront(p: PlacedPiece, left: number): Item[] {
  const d = p.design, at = (x: number, y: number): P => ({ x: mm(left + x), y: mm(p.y + y) }), mid = d.w / 2;
  if (p.fixture === 'sink' || p.fixture === 'hob') {
    return [line(at(mid, -12), at(mid, 16), 'centre'), note(at(mid, 20), pieceName(p))];
  }
  if (p.fixture === 'shelf') return [rect(mm(left), mm(p.y), mm(left + d.w), mm(p.y + d.h), 'outline'), { kind: 'tag', at: at(mid, d.h + 12), text: p.mark }];
  const top = resolveShape(d).top, out: Item[] = [], under = (x: number) => topAt(d, Math.min(d.w, Math.max(0, x)));
  out.push({ kind: 'line', stroke: 'outline', closed: true, points: [at(0, 0), at(d.w, 0), ...top.slice().reverse().map(q => at(q.x, q.y))] });
  const plinth = plinthOf(d);
  if (plinth > 0) out.push(line(at(0, plinth), at(d.w, plinth), 'thin'));
  const { fronts, inside, covered } = piecefronts(d), behind = covered || fronts.length > 0;
  for (const b of inside) {
    const y1 = Math.min(b.y1, under((b.x0 + b.x1) / 2) - PANEL), stroke = behind ? 'hidden' : b.kind === 'rail' ? 'centre' : 'thin';
    // Behind the fronts each outline stands a little in, so two dashed edges never merge into what reads as a solid one.
    const k = behind && b.kind === 'box' ? Math.min(INSET, (b.x1 - b.x0) / 4, (y1 - b.y0) / 4) : 0;
    out.push(b.kind === 'box' ? rect(mm(left + b.x0 + k), mm(p.y + b.y0 + k), mm(left + b.x1 - k), mm(p.y + y1 - k), stroke) : line(at(b.x0 + 2, b.y0), at(b.x1 - 2, b.y0), stroke));
  }
  for (const f of fronts) {
    const y1 = (x: number) => Math.min(f.y1, under(x));
    out.push({ kind: 'line', stroke: 'thin', closed: true, points: [at(f.x0, f.y0), at(f.x1, f.y0), at(f.x1, y1(f.x1)), at(f.x0, y1(f.x0))] });
    out.push(...swing(f, at, under));
    if (f.label) out.push({ ...note(at((f.x0 + f.x1) / 2, y1((f.x0 + f.x1) / 2) - 7), f.label), small: true });
  }
  const tall = Math.min(...top.map(q => q.y));
  out.push({ kind: 'tag', at: at(mid, (plinth + tall) / 2), text: p.mark });
  return out;
}

/** The heights a piece adds to an elevation's height string: its bottom, its plinth, its top (highest point). */
export function pieceHeights(p: PlacedPiece): number[] {
  if (p.fixture === 'sink' || p.fixture === 'hob') return [];
  const d = p.design, plinth = plinthOf(d), top = Math.max(...resolveShape(d).top.map(q => q.y));
  return [p.y, ...(plinth > 0 ? [p.y + plinth] : []), p.y + (p.fixture ? d.h : top)];
}
