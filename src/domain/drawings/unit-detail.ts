import { PANEL, PLINTH } from '../wardrobe/catalog.js';
import { BACK_PANEL, fittingDepth, plinthOf } from '../wardrobe/carcass';
import { resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { KITCHEN_PLINTH_SETBACK, WORKTOP, kitchenUnit } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { type Item, type P, type View, line, mm, note, rect, stops } from './drawing';
import { type Board, cabinetBoards } from './cabinet-boards';
import { piecefronts } from './fronts';
import { pieceFront } from './piece-front';
import type { PlacedPiece } from './room-pieces';

const at = (x: number, y: number): P => ({ x: mm(x), y: mm(y) });
const vertical = (x: number, values: readonly number[], side: 1 | -1, row = 0): Item =>
  ({ kind: 'dims', origin: at(x, 0), dir: { x: 0, y: 1 }, side, clear: 0, row, stops: stops(values.map(mm)) });
const across = (y: number, values: readonly number[], side: 1 | -1, row = 0): Item =>
  ({ kind: 'dims', origin: at(0, y), dir: { x: 1, y: 0 }, side, clear: 0, row, stops: stops(values.map(mm)) });

/** The boards of a piece, as cut: a cabinet's carcass, shelves and fronts; a wall shelf's one board; nothing for a sink
 * or hob (they are bought). Centimetres, from the piece's left face, bottom and back. */
export function pieceBoards(p: PlacedPiece): Board[] {
  if (p.fixture === 'sink' || p.fixture === 'hob') return [];
  const { w, h, d } = p.design;
  if (p.fixture === 'shelf') return [{ name: 'Shelf board', stock: 'carcass', x0: 0, x1: w, y0: 0, y1: h, z0: 0, z1: d, cut: { length: w, width: d, thickness: h }, edges: 'L1 W2' }];
  return cabinetBoards(p.design);
}

/** The heights a board's outline reaches at `x` (a sloped top, a side cut to the slope), or its box's. */
function heightsAt(b: Board, x: number): [number, number] {
  if (!b.outline) return [b.y0, b.y1];
  const ys: number[] = [];
  b.outline.forEach((a, k) => {
    const c = b.outline![(k + 1) % b.outline!.length]!;
    if ((a.x - x) * (c.x - x) <= 0 && Math.abs(c.x - a.x) > 1e-6) ys.push(a.y + (c.y - a.y) * (x - a.x) / (c.x - a.x));
  });
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : [b.y0, b.y1];
}

/** Front: the piece with its fronts or doors, each front's width × height written on it, and strings of where the
 * fronts start and end across and up, then the whole width and height. */
function frontView(p: PlacedPiece, boards: readonly Board[]): Item[] {
  const own = { ...p, y: 0 }, out = pieceFront(own, 0, { inside: false }), fronts = boards.filter(b => b.stock === 'front' || b.stock === 'door');
  for (const b of fronts) out.push({ ...note(at((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - 4), mm(b.x1 - b.x0) + ' × ' + mm(b.y1 - b.y0)), small: true });
  const top = Math.max(...resolveShape(p.design).top.map(q => q.y));
  if (fronts.length) {
    out.push(across(0, [0, p.design.w, ...fronts.flatMap(b => [b.x0, b.x1])], -1, 0), vertical(0, [0, top, ...fronts.flatMap(b => [b.y0, b.y1])], 1, 0));
  }
  out.push(across(0, [0, p.design.w], -1, fronts.length ? 1 : 0), vertical(0, [0, top], 1, fronts.length ? 1 : 0));
  return out;
}

/** Inside: the fronts taken off. Every board's front edge (sides, top, base, partitions, shelves), rails, where each front
 * goes (dashed); the clear width of each section between the boards, the clear heights up each section, the carcass
 * heights on the left. The line of Section A–A through the first section. */
function insideView(p: PlacedPiece, boards: readonly Board[]): Item[] {
  const d = p.design, out: Item[] = [], carcass = boards.filter(b => b.stock !== 'front' && b.stock !== 'door' && b.stock !== 'back' && !(b.stock === 'plinth' && b.z1 < d.d - 5));
  for (const b of carcass) out.push(b.outline ? { kind: 'line', stroke: 'outline', closed: true, points: b.outline.map(q => at(q.x, q.y)) } : rect(mm(b.x0), mm(b.y0), mm(b.x1), mm(b.y1), 'outline'));
  const { fronts, inside } = piecefronts(d);
  for (const r of inside.filter(q => q.kind === 'rail')) out.push(line(at(r.x0 + 2, r.y0), at(r.x1 - 2, r.y0), 'centre'));
  if (isKitchen(d)) for (const f of fronts) out.push(rect(mm(f.x0), mm(f.y0), mm(f.x1), mm(f.y1), 'hidden'), { ...note(at((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2), f.name.replace(/ (door|front)$/, '')), small: true });
  const geometry = createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null })), widths = geometry.widths(), lift = plinthOf(d), iy = lift + PANEL;
  const edges = [0, PANEL];
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    edges.push(bayL + sw, bayL + sw + PANEL);
    // Up each section: the boards in it, from the base board to the underside of the top.
    const inBay = carcass.filter(b => b.x0 >= bayL - .01 && b.x1 <= bayL + sw + .01 && b.y0 > iy - .01 && b.name !== 'Side');
    if (inBay.length) out.push(vertical(bayL, [iy, iy + geometry.ceilingTop(i, 0, sw), ...inBay.flatMap(b => [b.y0, b.y1])], -1));
    bayL += sw + PANEL;
  });
  const top = Math.max(...resolveShape(d).top.map(q => q.y)), cut = PANEL + widths[0]! / 2;
  out.push(across(0, edges, -1, 0), across(0, [0, d.w], -1, 1), vertical(0, [0, lift, iy, top - PANEL, top], 1, 0));
  out.push(line(at(cut, -8), at(cut, top + 8), 'centre'), { kind: 'view-mark', at: at(cut, top + 14), dir: { x: 1, y: 0 }, text: 'A' });
  return out;
}

/** Section A–A: cut upright through the middle of the first section, seen from its right; the back on the left, the
 * front on the right. Boards cut through are hatched, the side beyond is a thin outline; the worktop and the run's plinth
 * where a kitchen unit has them. Along the bottom: back board, shelf setback, carcass front, front; on the left the heights. */
function sectionView(p: PlacedPiece, boards: readonly Board[]): Item[] {
  const d = p.design, out: Item[] = [], cx = PANEL + createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null })).widths()[0]! / 2;
  const top = Math.max(...resolveShape(d).top.map(q => q.y)), side = boards.find(b => b.name === 'Side');
  if (side) out.push(rect(mm(side.z0), mm(side.y0), mm(side.z1), mm(heightsAt(side, side.x1)[1]), 'thin'));
  const cutThrough = boards.filter(b => b.x0 <= cx + .01 && b.x1 >= cx - .01);
  for (const b of cutThrough) { const [y0, y1] = heightsAt(b, cx); out.push(rect(mm(b.z0), mm(y0), mm(b.z1), mm(y1), 'cut', 'hatch')); }
  for (const r of piecefronts(d).inside.filter(q => q.kind === 'rail' && q.x0 <= cx && q.x1 >= cx)) {
    const z = (fittingDepth(d.d).z0 + fittingDepth(d.d).z1) / 2;
    out.push(rect(mm(z - 1.2), mm(r.y0 - 1.2), mm(z + 1.2), mm(r.y0 + 1.2), 'outline'));
  }
  const kitchen = isKitchen(d), unit = kitchen ? kitchenUnit(d.unit) : null, front = Math.max(d.d, ...cutThrough.map(b => b.z1));
  // Depth: the back board, where shelves stop (a wardrobe's fittings), the carcass front, the fronts' face.
  const depths = [0, BACK_PANEL, ...(kitchen ? [] : [fittingDepth(d.d).z1]), d.d, front], heights = [0, plinthOf(d), plinthOf(d) + PANEL, top - PANEL, top];
  if (unit?.worktop) {
    out.push(rect(0, mm(d.h), mm(d.d + WORKTOP.overhang), mm(d.h + WORKTOP.thickness), 'cut', 'hatch'));
    depths.push(d.d + WORKTOP.overhang); heights.push(d.h + WORKTOP.thickness);
  }
  if (unit?.plinth) {
    const z = d.d - KITCHEN_PLINTH_SETBACK;
    out.push(rect(mm(z - 1.6), 0, mm(z), mm(PLINTH), 'cut', 'hatch'));
    depths.push(z);
  }
  // Heights: the carcass build-up and the top of each shelf cut through, as a shelf is set out from the floor.
  const shelves = cutThrough.filter(b => b.stock === 'carcass' || b.stock === 'shelf').map(b => heightsAt(b, cx)[1]).filter(y => y > plinthOf(d) + PANEL + .5 && y < top - PANEL - .5);
  out.push(across(0, depths, -1, 0), across(0, [0, front], -1, 1), vertical(0, [...heights, ...shelves], 1, 0));
  return out;
}

/** A piece's detail views for making it: Front, Inside and Section A–A, at one scale. */
export function unitDetailViews(p: PlacedPiece): View[] {
  const boards = pieceBoards(p);
  return [{ title: 'Front', items: frontView(p, boards) }, { title: 'Inside', items: insideView(p, boards) }, { title: 'Section A–A', items: sectionView(p, boards) }];
}
