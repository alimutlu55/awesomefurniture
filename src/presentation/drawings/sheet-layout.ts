import type { Dimensions, Item, P, Sheet, View } from '../../domain/drawings/drawing';

/** An A3 landscape sheet, millimetres on paper (ISO 5457): a 20 mm filing margin on the left, 10 mm elsewhere. */
export const PAPER = { w: 420, h: 297, left: 20, edge: 10 } as const;
/** The title block in the bottom right corner (ISO 7200), and the list of pieces to its left. */
export const TITLE = { w: 170, h: 34 } as const;
/** Dimension strings: the first stands this far off what it measures, each further row this much further out. */
export const DIM = { first: 6, row: 7, text: 2.5, gap: 1.5 } as const;
/** Scales a carpenter's rule reads (1:n), largest drawing first. */
const SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500] as const;
/** Height of one row of the list of pieces. */
export const LIST_ROW = 4.6;
/** Length of an arrow on paper. */
export const ARROW = 6;

/** Turns the drawing's millimetres (y up) into paper millimetres (y down) at 1:`scale`, with its origin at `at`. */
export interface Paper { scale: number; at: P; (p: P): P }
const toPaper = (scale: number, at: P): Paper => Object.assign((p: P) => ({ x: at.x + p.x / scale, y: at.y - p.y / scale }), { scale, at });

/** The quarter turn of a direction in the drawing (anticlockwise for side 1), as a string's offset direction. */
export const normal = (d: Dimensions): P => ({ x: -d.dir.y * d.side, y: d.dir.x * d.side });
/** How far off its measured line a dimension string stands, on paper. */
export const dimOffset = (d: Dimensions, scale: number) => d.clear / scale + DIM.first + d.row * DIM.row;

/** Everything an item reaches on paper at a scale, with the drawing's origin at paper 0,0. */
function reach(item: Item, scale: number): P[] {
  const at = toPaper(scale, { x: 0, y: 0 });
  switch (item.kind) {
    case 'line': return item.points.map(at);
    case 'tag': case 'view-mark': { const c = at(item.at); return [{ x: c.x - 5, y: c.y - 5 }, { x: c.x + 5, y: c.y + 5 }]; }
    case 'arrow': { const c = at(item.at); return [c, { x: c.x + item.dir.x * ARROW, y: c.y - item.dir.y * ARROW }]; }
    case 'note': { const c = at(item.at), w = Math.max(...item.lines.map(l => l.length)) * 1.6; return [{ x: c.x - w / 2, y: c.y - 3 }, { x: c.x + w / 2, y: c.y + 3 * item.lines.length }]; }
    case 'dims': {
      const n = normal(item), off = dimOffset(item, scale) + DIM.text + 2.5, ends = [item.stops[0]!, item.stops[item.stops.length - 1]!];
      return ends.flatMap(s => {
        const p = at({ x: item.origin.x + item.dir.x * s, y: item.origin.y + item.dir.y * s });
        return [p, { x: p.x + n.x * off, y: p.y - n.y * off }];
      });
    }
  }
}

/** Where a sheet's drawing goes: the frame less the title strip, whose height grows with the list of pieces. */
export function drawingArea(sheet: Sheet) {
  const strip = Math.max(TITLE.h, (Math.ceil(sheet.pieces.length / 2) + sheet.checks.length) * LIST_ROW + 10);
  return { x: PAPER.left + 6, y: PAPER.edge + 14, w: PAPER.w - PAPER.left - PAPER.edge - 12, h: PAPER.h - 2 * PAPER.edge - strip - 20, strip };
}

/** A view placed on paper: where its drawing's origin lands, and the box it takes with its dimensions. */
export interface Placed { view: View; paper: Paper; box: { x0: number; x1: number; y0: number; y1: number } }
/** Space between views on one sheet, and under each for its title. */
const GAP = 14, CAPTION = 8;

/** The largest standard scale at which a sheet's views, side by side with their dimension strings and titles, fit its
 * area; the row of views centred there. */
export function layoutSheet(sheet: Sheet): { scale: number; placed: Placed[] } {
  const area = drawingArea(sheet), views = sheet.views;
  const bounds = (view: View, scale: number) => {
    const points = view.items.flatMap(i => reach(i, scale));
    if (!points.length) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)), y0: Math.min(...points.map(p => p.y)), y1: Math.max(...points.map(p => p.y)) };
  };
  const scale = SCALES.find(k => {
    const b = views.map(v => bounds(v, k)), titled = views.length > 1 ? CAPTION : 0;
    return b.reduce((w, q) => w + q.x1 - q.x0, 0) + GAP * (views.length - 1) <= area.w && Math.max(0, ...b.map(q => q.y1 - q.y0)) + titled <= area.h;
  }) ?? SCALES[SCALES.length - 1]!;
  const boxes = views.map(v => bounds(v, scale)), total = boxes.reduce((w, q) => w + q.x1 - q.x0, 0) + GAP * Math.max(0, views.length - 1);
  const height = Math.max(0, ...boxes.map(q => q.y1 - q.y0)) + (views.length > 1 ? CAPTION : 0);
  let x = area.x + (area.w - total) / 2;
  const top = area.y + (area.h - height) / 2;
  const placed = views.map((view, k) => {
    const b = boxes[k]!, at = { x: x - b.x0, y: top + (height - (views.length > 1 ? CAPTION : 0) - (b.y1 - b.y0)) / 2 - b.y0 };
    x += b.x1 - b.x0 + GAP;
    return { view, paper: toPaper(scale, at), box: { x0: b.x0 + at.x, x1: b.x1 + at.x, y0: b.y0 + at.y, y1: b.y1 + at.y } };
  });
  return { scale, placed };
}
