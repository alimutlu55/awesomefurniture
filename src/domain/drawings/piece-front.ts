import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { interiorFloorOf, plinthOf } from '../wardrobe/carcass';
import { resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { cabinetDoorAreas } from '../wardrobe/door-layout';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { kitchenFrontRect } from '../kitchen/kitchen-fronts';
import { isKitchen } from '../furniture/furniture';
import { type Item, type P, line, mm, note, rect } from './drawing';
import { type PlacedPiece, pieceName } from './room-pieces';

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

/** What a piece's front is divided into, from its left face and its bottom, centimetres: its doors across the whole front
 * (a wardrobe with doors), each fitting's own front (a kitchen unit), or, open, its fittings, shelves and partitions. */
function fronts(design: EditorDesign) {
  // The rules read a design being edited; nothing is selected in a drawing.
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), widths = geometry.widths(), out: { x0: number; x1: number; y0: number; y1: number }[] = [];
  if (!isKitchen(design) && design.doors !== 'none') return cabinetDoorAreas(design, widths);
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    for (const [j, pos] of geometry.computeLayout(i).entries()) {
      const it = design.secs[i]![j]!, cx = bayL + pos.off + pos.w / 2;
      out.push(isKitchen(design)
        ? kitchenFrontRect(design.unit, cx, pos.y0, pos.w, it.h, { bottom: interiorFloorOf(design), top: design.h - PANEL }, { left: PANEL, right: design.w - PANEL })
        : { x0: bayL + pos.off, x1: bayL + pos.off + pos.w, y0: pos.y0, y1: pos.y1 });
    }
    if (!isKitchen(design)) {
      for (const d of geometry.sectionDividers(i)) {
        const r = geometry.visibleRect(d);
        out.push({ x0: bayL + r.x0, x1: bayL + r.x1, y0: geometry.interiorFloor() + r.y0, y1: geometry.interiorFloor() + r.y1 });
      }
      if (i < widths.length - 1) out.push({ x0: bayL + sw, x1: bayL + sw + PANEL, y0: interiorFloorOf(design), y1: topAt(design, bayL + sw + PANEL / 2) - PANEL });
    }
    bayL += sw + PANEL;
  });
  return out;
}

/** A piece seen from the front, its left face `left` along the elevation and its bottom at its own height: the outline
 * (following a sloped or stepped top), the plinth, what its front is divided into, and its mark. A sink or hob is its
 * centre line on the worktop; a shelf its board. Millimetres. */
export function pieceFront(p: PlacedPiece, left: number): Item[] {
  const d = p.design, at = (x: number, y: number): P => ({ x: mm(left + x), y: mm(p.y + y) }), mid = d.w / 2;
  if (p.fixture === 'sink' || p.fixture === 'hob') {
    return [line(at(mid, -12), at(mid, 16), 'centre'), note(at(mid, 20), pieceName(p))];
  }
  if (p.fixture === 'shelf') return [rect(mm(left), mm(p.y), mm(left + d.w), mm(p.y + d.h), 'outline'), { kind: 'tag', at: at(mid, d.h + 12), text: p.mark }];
  const top = resolveShape(d).top, out: Item[] = [];
  out.push({ kind: 'line', stroke: 'outline', closed: true, points: [at(0, 0), at(d.w, 0), ...top.slice().reverse().map(q => at(q.x, q.y))] });
  const plinth = plinthOf(d);
  if (plinth > 0) out.push(line(at(0, plinth), at(d.w, plinth), 'thin'));
  for (const f of fronts(d)) {
    const y1 = Math.min(f.y1, topAt(d, Math.min(d.w, Math.max(0, (f.x0 + f.x1) / 2))));
    out.push(rect(mm(left + f.x0), mm(p.y + f.y0), mm(left + f.x1), mm(p.y + y1), 'thin'));
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

