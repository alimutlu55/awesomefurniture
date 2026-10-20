import type { PlacedPiece } from './room-pieces';
import { type Item, mm, stops } from './drawing';
import { pieceHeights } from './piece-front';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { resolveShape } from '../wardrobe/shape/wardrobe-shape';

/** Three rows, nearest first: unit/zone chains, installation datums, total floor-to-ceiling. */
export function elevationDimensions(pieces: readonly PlacedPiece[], datums: readonly number[], height: number, clear = 0): Item[] {
  const zones = pieces.flatMap(p => {
    if (p.fixture) return pieceHeights(p);
    const d = p.design, geometry = createWardrobeGeometry(() => ({ ...d, sel: 0, item: -1, divider: -1, space: null }));
    return [...pieceHeights(p), ...resolveShape(d).top.map(q => p.y + q.y),
      ...geometry.widths().flatMap((_, i) => geometry.computeLayout(i).flatMap(q => [p.y + q.y0, p.y + q.y1]))];
  });
  const levels = [0, height, ...pieces.flatMap(pieceHeights), ...datums];
  return [stops([...levels, ...zones].map(mm)), stops(levels.map(mm)), [0, mm(height)]].map((values, row) => ({
    kind: 'dims', origin: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, side: 1, clear: mm(clear), row, stops: values,
  }));
}
