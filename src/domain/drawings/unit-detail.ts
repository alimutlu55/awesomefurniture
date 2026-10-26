import { installationKind } from '../kitchen/kitchen-units';
import { worktopThickness } from '../materials/configured-materials';
import { PANEL } from '../wardrobe/catalog.js';
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
import { cornerFaceWidths, cornerWidthStops } from './corner-widths';

const at = (x: number, y: number): P => ({ x: mm(x), y: mm(y) });
const vertical = (x: number, values: readonly number[], side: 1 | -1, row = 0, quiet?: readonly number[]): Item =>
  ({ kind: 'dims', origin: at(x, 0), dir: { x: 0, y: 1 }, side, clear: 0, row, stops: stops(values.map(mm)), ...(quiet ? { quiet } : {}) });
const across = (y: number, values: readonly number[], side: 1 | -1, row = 0, quiet?: readonly number[]): Item =>
  ({ kind: 'dims', origin: at(0, y), dir: { x: 1, y: 0 }, side, clear: 0, row, stops: stops(values.map(mm)), ...(quiet ? { quiet } : {}) });

/** A gap between two fronts up to this wide is a joint: stated once in the legend, not dimensioned (millimetres). */
const JOINT = 12;

/** One string through the ends of `spans` (centimetres): only the spans carry a figure; what lies between them (joints,
 * board thicknesses) keeps its ticks but is silent, so no figure is written into a space too small for it. */
function chain(draw: (values: readonly number[], quiet: readonly number[]) => Item, spans: readonly (readonly [number, number])[]): Item[] {
  const real = spans.filter(([a, b]) => mm(b) > mm(a));
  if (!real.length) return [];
  const ends = stops(real.flatMap(([a, b]) => [mm(a), mm(b)])), measured = new Set(real.map(([a, b]) => mm(a) + ':' + mm(b)));
  const quiet = ends.slice(1).flatMap((e, k) => measured.has(ends[k]! + ':' + e) ? [] : [k]);
  return [draw(ends.map(v => v / 10), quiet)];
}

/** Where the fronts are, as one string: each front's own size, and the distance to the edge before, after and between
 * them where it is more than a joint. Returns the spans (centimetres) and the joints it left out (millimetres). */
function frontSpans(ranges: readonly (readonly [number, number])[], lo: number, hi: number) {
  const sorted = [...new Map(ranges.map(r => [mm(r[0]) + ':' + mm(r[1]), r] as const)).values()].sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [], joints: number[] = [];
  let at = lo;
  for (const [a, b] of sorted) {
    const gap = mm(a) - mm(at);
    if (gap > 0 && (at === lo || gap > JOINT)) spans.push([at, a]); else if (gap > 0) joints.push(gap);
    spans.push([a, b]); at = Math.max(at, b);
  }
  if (mm(hi) - mm(at) > 0) spans.push([at, hi]);
  return { spans, joints };
}

/** A board lying across a space (a shelf, a base or top), as against an upright divider or post that stands in it: its
 * thinnest side is the vertical one. Only these split a clear height. */
const lies = (b: Board) => !!b.outline || b.y1 - b.y0 <= Math.min(b.x1 - b.x0, b.z1 - b.z0) + .01;

/** The clear spaces between boards (centimetres): from `lo` up to `hi`, minus every board's thickness. */
function clearSpaces(boards: readonly (readonly [number, number])[], lo: number, hi: number): [number, number][] {
  const spans: [number, number][] = [];
  let at = lo;
  for (const [a, b] of [...boards].sort((p, q) => p[0] - q[0])) {
    if (a >= hi - .001) break;
    if (mm(a) - mm(at) > 0) spans.push([at, a]);
    at = Math.max(at, b);
  }
  if (mm(hi) - mm(at) > 0) spans.push([at, hi]);
  return spans;
}

/** The boards of a piece, as cut: a cabinet's carcass, shelves and fronts; a wall shelf's one board; nothing for a sink
 * or hob (they are bought). Centimetres, from the piece's left face, bottom and back. */
export function pieceBoards(p: PlacedPiece, pieces: readonly PlacedPiece[] = [p]): Board[] {
  if (p.fixture === 'sink' || p.fixture === 'hob') return [];
  const { w, h, d } = p.design;
  if (p.fixture === 'shelf') return [{ name: 'Shelf board', stock: 'carcass', x0: 0, x1: w, y0: 0, y1: h, z0: 0, z1: d, cut: { length: w, width: d, thickness: h }, edges: 'L1 W2' }];
  return cabinetBoards(p.design, cornerFaceWidths(p, pieces));
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
function frontView(p: PlacedPiece, boards: readonly Board[], pieces: readonly PlacedPiece[]): Item[] {
  const own = { ...p, y: 0 }, out = pieceFront(own, 0, { inside: false, faceWidths: cornerFaceWidths(p, pieces) });
  const fronts = boards.filter(b => b.stock === 'front' || b.stock === 'door');
  for (const b of fronts) out.push({ ...note(at((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - 4), mm(b.x1 - b.x0) + ' × ' + mm(b.y1 - b.y0)), small: true });
  const top = Math.max(...resolveShape(p.design).top.map(q => q.y));
  if (fronts.length) {
    const across_ = frontSpans(fronts.map(b => [b.x0, b.x1] as const), 0, p.design.w), up = frontSpans(fronts.map(b => [b.y0, b.y1] as const), 0, top);
    out.push(...chain((v, q) => across(0, v, -1, 0, q), across_.spans), ...chain((v, q) => vertical(0, v, 1, 0, q), up.spans));
  }
  const widths = cornerWidthStops(p, pieces), row = fronts.length ? 1 : 0;
  if (widths.length > 2) out.push(across(0, widths, -1, row));
  out.push(across(0, [0, p.design.w], -1, row + Number(widths.length > 2)), vertical(0, [0, top], 1, fronts.length ? 1 : 0));
  return out;
}

/** Inside: the fronts taken off. Every board's front edge (sides, top, base, partitions, shelves), rails, where each front
 * goes (dashed); the clear width of each section between the boards, the clear heights up each section, the carcass
 * heights on the left. The line of Section A–A through the first section. */
function insideView(p: PlacedPiece, boards: readonly Board[], pieces: readonly PlacedPiece[]): Item[] {
  const d = p.design, out: Item[] = [], carcass = boards.filter(b => b.stock !== 'front' && b.stock !== 'door' && b.stock !== 'back' && !(b.stock === 'plinth' && b.z1 < d.d - 5));
  for (const b of carcass) out.push(b.outline ? { kind: 'line', stroke: 'outline', closed: true, points: b.outline.map(q => at(q.x, q.y)) } : rect(mm(b.x0), mm(b.y0), mm(b.x1), mm(b.y1), 'outline'));
  const { fronts, inside, cornerPullouts } = piecefronts(d, cornerFaceWidths(p, pieces));
  for (const r of inside.filter(q => q.kind === 'rail')) out.push(line(at(r.x0 + 2, r.y0), at(r.x1 - 2, r.y0), 'centre'));
  for (const c of cornerPullouts) {
    out.push(
      rect(mm(c.post.x0), mm(c.post.y0), mm(c.post.x1), mm(c.post.y1), 'outline'),
      line(at(c.post.x, c.y0), at(c.post.x, c.y0 + c.hh), 'centre'),
      rect(mm(c.post.x - 2), mm(c.y0), mm(c.post.x + 2), mm(c.post.y0), 'thin'),
      rect(mm(c.post.x - 2), mm(c.post.y1), mm(c.post.x + 2), mm(c.y0 + c.hh), 'thin'),
    );
    for (const t of c.trays) {
      out.push(
        rect(mm(t.base.x0), mm(t.base.y0), mm(t.base.x1), mm(t.base.y1), 'outline'),
        rect(mm(t.rail.x0), mm(t.rail.y0), mm(t.rail.x1), mm(t.rail.y1), 'thin'),
        rect(mm(c.post.x - 1.8), mm(t.base.y0 - .8), mm(c.post.x + 1.8), mm(t.rail.y1 + .4), 'outline'),
        { kind: 'arrow', at: at((c.door.x0 + c.door.x1) / 2, (t.base.y1 + t.rail.y1) / 2), dir: { x: c.doorSide === 'right' ? 1 : -1, y: 0 } },
      );
    }
  }
  if (isKitchen(d)) for (const f of fronts) out.push(rect(mm(f.x0), mm(f.y0), mm(f.x1), mm(f.y1), 'hidden'), { ...note(at((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2), f.name.replace(/ (door|front)$/, '')), small: true });
  const geometry = createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null })), widths = geometry.widths(), lift = plinthOf(d), iy = lift + PANEL;
  const clearWidths: Item[] = [];
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    const bayCorners = cornerPullouts.filter(c => c.bayIndex === i);
    // Across each section: its clear width between the boards, split where a corner pull-out's parts stand.
    const cornerEdges = bayCorners.flatMap(c => [c.trays[0]!.base.x0, c.post.x, c.trays[0]!.base.x1]);
    clearWidths.push(across(0, [bayL, ...cornerEdges, bayL + sw], -1, 0));
    // Up each section: the clear heights between the boards or corner pull-out trays in it, from the base board to the top.
    const inBay = carcass.filter(b => b.x0 >= bayL - .01 && b.x1 <= bayL + sw + .01 && b.y0 > iy - .01 && b.name !== 'Side' && lies(b));
    const trays = bayCorners.flatMap(c => c.trays.map(t => [t.base.y0, t.base.y1] as const));
    if (inBay.length || trays.length) {
      out.push(...chain((v, q) => vertical(bayL, v, -1, 0, q), clearSpaces([...inBay.map(b => [b.y0, b.y1] as const), ...trays], iy, iy + geometry.ceilingTop(i, 0, sw))));
    }
    bayL += sw + PANEL;
  });
  const top = Math.max(...resolveShape(d).top.map(q => q.y)), cut = PANEL + widths[0]! / 2;
  out.push(...clearWidths, across(0, [0, d.w], -1, 1), ...chain((v, q) => vertical(0, v, 1, 0, q), [[0, lift], [iy, top - PANEL]]), vertical(0, [0, top], 1, 1));
  out.push(line(at(cut, -8), at(cut, top + 8), 'centre'), { kind: 'view-mark', at: at(cut, top + 14), dir: { x: 1, y: 0 }, text: 'A' });
  return out;
}

/** Section A–A: cut upright through the middle of the first section, seen from its right; the back on the left, the
 * front on the right. Boards cut through are hatched, the side beyond is a thin outline; the worktop and the run's plinth
 * where a kitchen unit has them. Along the bottom: back board, shelf setback, carcass front, front; on the left the heights. */
function sectionView(p: PlacedPiece, boards: readonly Board[], pieces: readonly PlacedPiece[]): Item[] {
  const d = p.design, out: Item[] = [], cx = PANEL + createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null })).widths()[0]! / 2;
  const top = Math.max(...resolveShape(d).top.map(q => q.y)), side = boards.find(b => b.name === 'Side');
  if (side) out.push(rect(mm(side.z0), mm(side.y0), mm(side.z1), mm(heightsAt(side, side.x1)[1]), 'thin'));
  const cutThrough = boards.filter(b => b.x0 <= cx + .01 && b.x1 >= cx - .01);
  for (const b of cutThrough) { const [y0, y1] = heightsAt(b, cx); out.push(rect(mm(b.z0), mm(y0), mm(b.z1), mm(y1), 'cut', 'hatch')); }
  const { inside, cornerPullouts } = piecefronts(d, cornerFaceWidths(p, pieces)), sectionCorners = cornerPullouts.filter(c => c.bayIndex === 0);
  for (const r of inside.filter(q => q.kind === 'rail' && q.x0 <= cx && q.x1 >= cx)) {
    const z = (fittingDepth(d.d).z0 + fittingDepth(d.d).z1) / 2;
    out.push(rect(mm(z - 1.2), mm(r.y0 - 1.2), mm(z + 1.2), mm(r.y0 + 1.2), 'outline'));
  }
  for (const c of sectionCorners) {
    out.push(
      rect(mm(c.post.z0), mm(c.post.y0), mm(c.post.z1), mm(c.post.y1), 'outline'),
      line(at(d.d / 2, c.y0), at(d.d / 2, c.y0 + c.hh), 'centre'),
      rect(mm(d.d / 2 - 2), mm(c.y0), mm(d.d / 2 + 2), mm(c.post.y0), 'thin'),
      rect(mm(d.d / 2 - 2), mm(c.post.y1), mm(d.d / 2 + 2), mm(c.y0 + c.hh), 'thin'),
    );
    for (const t of c.trays) {
      out.push(
        rect(mm(t.base.z0), mm(t.base.y0), mm(t.base.z1), mm(t.base.y1), 'cut', 'hatch'),
        rect(mm(t.rail.z0), mm(t.rail.y0), mm(t.rail.z1), mm(t.rail.y1), 'thin'),
      );
    }
  }
  const kitchen = isKitchen(d), unit = kitchen ? kitchenUnit(d.unit) : null, front = Math.max(d.d, ...cutThrough.map(b => b.z1));
  // Depth: the back board, where shelves or swing-out trays sit, the carcass front, the fronts' face.
  const trayDepths = sectionCorners.flatMap(c => [c.trays[0]!.base.z0, c.trays[0]!.base.z1]);
  const depths = [0, BACK_PANEL, ...(kitchen ? trayDepths : [fittingDepth(d.d).z1]), d.d, front];
  if (unit?.worktop) {
    out.push(rect(0, mm(d.h), mm(d.d + WORKTOP.overhang), mm(d.h + worktopThickness(d)), 'cut', 'hatch'));
    depths.push(d.d + WORKTOP.overhang);
  }
  if (unit?.plinth) {
    const z = d.d - KITCHEN_PLINTH_SETBACK;
    out.push(rect(mm(z - 1.6), 0, mm(z), mm(plinthOf(d)), 'cut', 'hatch'));
    depths.push(z);
  }
  // Heights: the carcass build-up and the top of each shelf or swing-out tray cut through, set out from the floor.
  const lift = plinthOf(d), shelves = cutThrough.filter(b => (b.stock === 'carcass' || b.stock === 'shelf') && lies(b)).map(b => heightsAt(b, cx)).filter(([lo, hi]) => lo > lift + PANEL - .05 && hi < top - PANEL + .05);
  const trays = sectionCorners.flatMap(c => c.trays.map(t => [t.base.y0, t.base.y1] as const));
  const highest = unit?.worktop ? d.h + worktopThickness(d) : top;
  out.push(across(0, depths, -1, 0), across(0, [0, front], -1, 1),
    ...chain((v, q) => vertical(0, v, 1, 0, q), [[0, lift], ...clearSpaces([...shelves, ...trays], lift + PANEL, top - PANEL), ...(unit?.worktop ? [[d.h, highest] as const] : [])]),
    vertical(0, [0, highest], 1, 1));
  return out;
}

/** What the figures on a shop sheet mean, written once on the sheet (ISO 129-1: say what a number measures and do not
 * repeat a size that is the same everywhere). Board thicknesses and the joints between fronts are not strings of their own. */
export function unitDetailLegend(p: PlacedPiece, pieces: readonly PlacedPiece[] = [p]): string[] {
  if (installationKind(p.design)) return ['Solid installation component: exact installed dimensions in mm; no storage, hinges or handles.', 'Verify scribe allowance, fastening and finish against the installation specification.'];
  const boards = pieceBoards(p, pieces), d = p.design, top = Math.max(...resolveShape(d).top.map(q => q.y));
  const thick = [...new Set(boards.filter(b => b.stock === 'carcass' || b.stock === 'shelf').map(b => mm(b.cut.thickness)))].sort((a, b) => b - a);
  const fronts = boards.filter(b => b.stock === 'front' || b.stock === 'door');
  const joints = fronts.length ? [...new Set([...frontSpans(fronts.map(b => [b.x0, b.x1] as const), 0, d.w).joints, ...frontSpans(fronts.map(b => [b.y0, b.y1] as const), 0, top).joints])].sort((a, b) => a - b) : [];
  const back = mm(BACK_PANEL), shelf = mm(fittingDepth(d.d).z1 - BACK_PANEL), setback = mm(d.d - fittingDepth(d.d).z1);
  const stated = 'All dimensions in mm · boards ' + (thick.join(' / ') || '—') + ' mm thick, not repeated in the strings';
  const joined = joints.length ? ' · joints between fronts ' + joints.join(' / ') + ' mm, not dimensioned' : '';
  const installation = cornerWidthStops(p, pieces).length > 2
    ? ' · Installation: exposed + covered carcass widths, not front cutting sizes; covered door leaves are fixed return panels, without handles or hinges' : '';
  const depth = isKitchen(d) ? 'back board, shelf depth, carcass depth, then front, worktop and plinth setbacks' : back + ' back board + ' + shelf + ' shelf depth + ' + setback + ' shelf setback';
  return [
    stated + joined + ' · clear = between board faces' + installation,
    'Front: sizes of each front, from the floor up and across · Inside: clear width of each section (below), clear height between boards (in the section), overall at the outer string'
      + ' · Section A–A: clear heights as Inside; depth, back to front: ' + depth,
  ];
}

/** A piece's detail views for making it: Front, Inside and Section A–A, at one scale. */
export function unitDetailViews(p: PlacedPiece, pieces: readonly PlacedPiece[] = [p]): View[] {
  const boards = pieceBoards(p, pieces);
  if (installationKind(p.design)) {
    const b = boards[0]!, w = p.design.w, h = p.design.h, d = p.design.d;
    return [{ title: 'Front', items: [rect(0, mm(b.y0), mm(w), mm(h), 'outline'), across(0, [0, w], -1), vertical(0, [0, h], 1)] },
      { title: 'Section A–A', items: [rect(mm(b.z0), mm(b.y0), mm(b.z1), mm(h), 'cut', 'hatch'),
        across(0, [0, d], -1), note(at(d / 2, h + 12), mm(b.cut.length) + ' × ' + mm(b.cut.width) + ' × ' + mm(b.cut.thickness) + ' cut')] }];
  }
  return [{ title: 'Front', items: frontView(p, boards, pieces) }, { title: 'Inside', items: insideView(p, boards, pieces) }, { title: 'Section A–A', items: sectionView(p, boards, pieces) }];
}
