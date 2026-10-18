import { mm, type PieceRow, type Sheet } from './drawing';
import { type DrawingInput, type PlacedPiece, pieceName, placePieces, wallGeometry } from './room-pieces';
import { planView } from './plan-view';
import { pieceElevation, wallElevation } from './wall-elevation';

/** How far in front of the furniture an elevation's mark stands on the plan. Centimetres. */
const MARK_OUT = 45;

/** A piece's row in a sheet's list: mark, what it is, width × height × depth, and where it stands. */
function row(p: PlacedPiece, letters: ReadonlyMap<string, string>): PieceRow {
  const height = p.fixture === 'sink' || p.fixture === 'hob' ? ', on the worktop' : p.y > .5 ? ', underside ' + mm(p.y) : '';
  const where = (p.wall ? 'Wall ' + letters.get(p.wall) : 'Free-standing') + height;
  return { mark: p.mark, name: pieceName(p), size: mm(p.design.w) + ' × ' + mm(p.design.h) + ' × ' + mm(p.design.d), where };
}

/**
 * The technical drawings of a design, for a carpenter to build and fit from: the plan of the room with every piece
 * marked and dimensioned to the walls, then an elevation of each wall that has furniture against it (A, B, C…, marked
 * on the plan where it is seen from), then a front elevation of each piece standing free. Millimetres throughout.
 */
export function technicalDrawings(input: DrawingInput): Sheet[] {
  const pieces = placePieces(input), studio = input.studio, letters = new Map<string, string>();
  for (const w of studio?.walls ?? []) if (pieces.some(p => p.wall === w.id)) letters.set(w.id, String.fromCharCode(65 + letters.size));
  const plan = planView(studio, pieces);
  for (const [id, letter] of letters) {
    const g = wallGeometry(studio!, studio!.walls.find(w => w.id === id)!)!, mine = pieces.filter(p => p.wall === id);
    const lo = Math.min(...mine.map(p => p.lo)), hi = Math.max(...mine.map(p => p.hi)), t = (lo + hi) / 2 - g.face.start;
    const out = Math.max(...mine.map(p => p.off + p.design.d)) + MARK_OUT;
    const at = { x: g.face.from.x + g.line.ux * t + g.line.nx * out, z: g.face.from.z + g.line.uz * t + g.line.nz * out };
    plan.push({ kind: 'view-mark', at: { x: mm(at.x), y: -mm(at.z) }, dir: { x: -g.line.nx, y: g.line.nz }, text: letter });
  }
  const sheets: Sheet[] = [{ number: 1, title: 'Plan', items: plan, pieces: pieces.map(p => row(p, letters)) }];
  for (const [id, letter] of letters) {
    sheets.push({ number: sheets.length + 1, title: 'Elevation ' + letter, items: wallElevation(studio!, id, pieces),
      pieces: pieces.filter(p => p.wall === id).map(p => row(p, letters)) });
  }
  for (const p of pieces.filter(q => q.wall === null)) {
    sheets.push({ number: sheets.length + 1, title: 'Front elevation ' + p.mark, items: pieceElevation(p), pieces: [row(p, letters)] });
  }
  return sheets;
}
