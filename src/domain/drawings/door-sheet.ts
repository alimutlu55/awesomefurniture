import { flatHoles, type FlatHole } from '../make/make-assembly';
import { bandedEdges, makePiece, type MakePart } from '../make/make-parts';
import { HINGE_SOURCE } from '../wardrobe/hinges';
import { type Item, type P, type Sheet, line, mm, note, rect } from './drawing';
import type { DrawingInput, PlacedPiece } from './room-pieces';

/** A hole drawn as a circle: a closed polygon, `d` across, round its centre. Drawing millimetres. */
function circle(at: P, d: number, stroke: 'outline' | 'hidden'): Item {
  return { kind: 'line', stroke, closed: true, points: Array.from({ length: 16 }, (_, k) => ({ x: at.x + d / 2 * Math.cos(k * Math.PI / 8), y: at.y + d / 2 * Math.sin(k * Math.PI / 8) })) };
}
const dims = (origin: P, dir: P, stops: readonly number[], side: 1 | -1, row = 0): Item =>
  ({ kind: 'dims', origin, dir, side, clear: 0, row, stops: [...new Set(stops.map(s => Math.round(s * 10) / 10))].sort((a, b) => a - b) });

/** Where a door's holes are on its drawing, seen from the front: x across the width from the left edge, y up the length
 * from the bottom edge, in millimetres (Make's flat board: across `v`, along `u`). */
export const doorHolePoint = (h: Pick<FlatHole, 'u' | 'v'>): P => ({ x: h.v, y: h.u });

/** One door as the joiner drills it: its outline with the banded edges drawn heavy, the hinge cups (on the back, dashed)
 * with their distance from the hinge edge and from the ends, the handle holes, and the grain. */
function doorView(part: MakePart, holes: readonly FlatHole[]): Item[] {
  const W = mm(part.cut.width), H = mm(part.cut.length), banded = bandedEdges(part.edges);
  const items: Item[] = [rect(0, 0, W, H, 'thin')];
  // Banded edges heavy: the long edges first (left, right), then the short ones (bottom, top).
  if (banded.long > 0) items.push(line({ x: 0, y: 0 }, { x: 0, y: H }, 'cut'));
  if (banded.long > 1) items.push(line({ x: W, y: 0 }, { x: W, y: H }, 'cut'));
  if (banded.short > 0) items.push(line({ x: 0, y: 0 }, { x: W, y: 0 }, 'cut'));
  if (banded.short > 1) items.push(line({ x: 0, y: H }, { x: W, y: H }, 'cut'));
  const cups = holes.filter(h => h.kind === 'cup'), handles = holes.filter(h => h.kind === 'handle');
  for (const h of cups) items.push(circle(doorHolePoint(h), h.d, 'hidden'));
  for (const h of handles) items.push(circle(doorHolePoint(h), h.d, h.face === '+' ? 'outline' : 'hidden'));
  if (cups.length) {
    // Cups from the hinge edge and up from the bottom end; the hinge edge is the side the cups are nearer.
    const left = cups[0]!.v < W / 2, edge = left ? 0 : W;
    items.push(dims({ x: 0, y: 0 }, { x: 0, y: 1 }, [0, ...cups.map(h => h.u), H], left ? 1 : -1, 1));
    items.push(dims({ x: edge, y: H }, { x: 1, y: 0 }, [edge, cups[0]!.v], 1));
  }
  if (handles.length) {
    const free = handles[0]!.v < W / 2 ? 0 : W;
    items.push(dims({ x: W, y: 0 }, { x: 0, y: 1 }, [0, ...handles.map(h => h.u), H], free === 0 ? 1 : -1, 2));
    items.push(dims({ x: free, y: handles[0]!.u }, { x: 1, y: 0 }, [free, handles[0]!.v], -1));
  }
  // Grain along the length.
  items.push({ kind: 'arrow', at: { x: W / 2, y: H * .4 }, dir: { x: 0, y: 1 } }, note({ x: W / 2 + 20, y: H * .4 }, 'Grain', 'start'));
  items.push(dims({ x: 0, y: 0 }, { x: 1, y: 0 }, [0, W], -1, 1), dims({ x: 0, y: 0 }, { x: 0, y: 1 }, [0, H], 1, 2));
  return items;
}

/**
 * Door sheets: one for each kind of door leaf in the job (a Make part: the same size, banding, decor and drilling), drawn
 * from the front with its hinge cups, handle holes, banded edges and grain, from Make's own holes so the two agree.
 */
export function doorSheets(input: DrawingInput, pieces: readonly PlacedPiece[]): Sheet[] {
  const sheets: Sheet[] = [];
  for (const p of pieces.filter(q => !q.fixture && q.id > 0)) {
    const made = makePiece(input, p.id);
    if (!made) continue;
    for (const part of made.parts.filter(x => x.stock === 'door')) {
      const id = part.ids[0]!, board = made.boards[id]!, holes = flatHoles(board, made.holes.filter(h => h.board === id));
      const qty = part.boards.length, size = mm(part.cut.width) + ' × ' + mm(part.cut.length) + ' × ' + mm(part.cut.thickness);
      sheets.push({ number: 0, title: p.mark + ' Door ' + part.n, views: [{ title: 'Door ' + part.n + ' · seen from the front · ' + qty + ' off', items: doorView(part, holes) }],
        legend: ['Door ' + size + ' mm · ' + qty + ' off · banded ' + part.edges + ' (heavy edges) · cups dashed: drilled in the back',
          'Hinge plates on the carcass at the cup heights, on the 37 mm line · hinge and handle positions follow ' + HINGE_SOURCE],
        pieces: [], checks: [] });
    }
  }
  return sheets;
}
