/**
 * What a board being dragged inside a wardrobe can line up with: a shelf board level with the other shelves
 * (in its bay or the next), its top level with a fitting's edge beside it, or centred in the space it divides;
 * a divider in line with another divider or a fitting's side above or below it, or centred in its space.
 * The candidates go to the shared alignment rule (`resolveAlignment`). Plain data in a bay's centimetres: x
 * from the bay's left side, y from its interior floor; a board's value is its centre, as the design stores it.
 */
import type { AlignTarget } from './alignment';

export interface BayRect { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
export interface BayBoard { readonly index: number; readonly orientation: 'horizontal' | 'vertical'; readonly rect: BayRect }
/** One bay as a board sees it: its clear width and height, its fittings and its boards. */
export interface BayView { readonly width: number; readonly top: number; readonly items: readonly BayRect[]; readonly boards: readonly BayBoard[] }
/** Where the guide for a candidate runs: in `bay`, along the line `at` (an x for a divider, a y for a shelf),
 * reaching across `rect` (what it lines up with) when there is one. */
export interface BoardGuide { readonly bay: number; readonly at: number; readonly rect?: BayRect }
export type BoardTarget = AlignTarget<BoardGuide>;

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - .01 && b0 < a1 - .01;
const touches = (a: number, b: number) => Math.abs(a - b) < .05;
/** Only values a board can stand at inside its bay. */
const inside = (ts: BoardTarget[], lo: number, hi: number) => ts.filter(t => t.v >= lo - .01 && t.v <= hi + .01);
/** What bounds the space a board divides: the fittings and the other boards that run the same way. */
const bounding = (bay: BayView, board: BayBoard) =>
    [...bay.items, ...bay.boards.filter(o => o.index !== board.index && o.orientation === board.orientation).map(o => o.rect)];

/** The values board `index` in bay `bay` can be dragged to, each lining it up with something. */
export function boardAlignTargets(bays: readonly BayView[], bay: number, index: number, thickness: number): BoardTarget[] {
    const own = bays[bay], board = own?.boards.find(b => b.index === index);
    if (!own || !board) return [];
    const half = thickness / 2, r = board.rect, out: BoardTarget[] = [];
    if (board.orientation === 'horizontal') {
        const y = (r.y0 + r.y1) / 2;
        bays.forEach((b, k) => {
            for (const o of b.boards) {
                if (o.orientation !== 'horizontal' || (k === bay && o.index === index)) continue;
                const at = (o.rect.y0 + o.rect.y1) / 2;
                out.push({ v: at, label: 'Level with shelf', kind: 'board', src: { bay: k, at, rect: o.rect } });
            }
            // A fitting beside it (another bay, or across a divider): the shelf's top level with its top or base.
            for (const it of b.items) {
                if (k === bay && overlaps(r.x0, r.x1, it.x0, it.x1)) continue;
                for (const at of [it.y1, it.y0]) out.push({ v: at - half, label: 'Aligned', kind: 'edge', src: { bay: k, at, rect: it } });
            }
        });
        // Centred between what is under it and over it in its own bay (what rests on it or hangs from it moves with it).
        let below = 0, above = own.top;
        for (const s of bounding(own, board)) {
            if (!overlaps(r.x0, r.x1, s.x0, s.x1) || touches(s.y0, r.y1) || touches(s.y1, r.y0)) continue;
            if (s.y1 <= y) below = Math.max(below, s.y1);
            else if (s.y0 >= y) above = Math.min(above, s.y0);
        }
        if (above - below > 3 * thickness) out.push({ v: (below + above) / 2, label: 'Centred', kind: 'center', src: { bay, at: (below + above) / 2 } });
        return inside(out, half, own.top - half);
    }
    const x = (r.x0 + r.x1) / 2;
    for (const o of own.boards) {
        // Another divider above or below it, across a shelf: the two in one line.
        if (o.orientation !== 'vertical' || o.index === index || overlaps(r.y0, r.y1, o.rect.y0, o.rect.y1)) continue;
        const at = (o.rect.x0 + o.rect.x1) / 2;
        out.push({ v: at, label: 'Aligned with divider', kind: 'board', src: { bay, at, rect: o.rect } });
    }
    for (const it of own.items) {
        // A fitting above or below it: a face of the divider in line with its side.
        if (overlaps(r.y0, r.y1, it.y0, it.y1)) continue;
        out.push({ v: it.x0 - half, label: 'Aligned', kind: 'edge', src: { bay, at: it.x0, rect: it } });
        out.push({ v: it.x1 + half, label: 'Aligned', kind: 'edge', src: { bay, at: it.x1, rect: it } });
    }
    let left = 0, right = own.width;
    for (const s of bounding(own, board)) {
        if (!overlaps(r.y0, r.y1, s.y0, s.y1) || touches(s.x0, r.x1) || touches(s.x1, r.x0)) continue;
        if (s.x1 <= x) left = Math.max(left, s.x1);
        else if (s.x0 >= x) right = Math.min(right, s.x0);
    }
    if (right - left > 3 * thickness) out.push({ v: (left + right) / 2, label: 'Centred', kind: 'center', src: { bay, at: (left + right) / 2 } });
    return inside(out, half, own.width - half);
}
