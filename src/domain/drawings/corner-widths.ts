import { cornerCabinetWidths } from '../kitchen/corner-widths';
import type { PlacedPiece } from './room-pieces';

/** Installation stops from the cabinet's left edge, in model centimetres, shared with the editor rulers. */
export function cornerFaceWidths(p: PlacedPiece, pieces: readonly PlacedPiece[]) {
  const pose = (q: PlacedPiece) => ({ ...q, state: q.design });
  return cornerCabinetWidths(pose(p), pieces.map(pose));
}

export function cornerWidthStops(p: PlacedPiece, pieces: readonly PlacedPiece[]): number[] {
  return [0, ...cornerFaceWidths(p, pieces).map(s => s.to)];
}
