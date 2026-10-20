import { mm, type PieceRow, type Sheet } from './drawing';
import { type DrawingInput, type PlacedPiece, pieceName, placePieces, wallGeometry } from './room-pieces';
import { planClearances } from './plan-clearances';
import { planView } from './plan-view';
import { pieceElevation, wallElevation } from './wall-elevation';
import { designChecks } from './checks';
import { unitDetailViews } from './unit-detail';
import { cuttingList } from './cutting-list';
import { hardwareList } from './hardware-list';
import { constructionDetails } from './construction-details';

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
 * marked and dimensioned to the walls, then an elevation of every room wall (A, B, C…, marked
 * on the plan where it is seen from), then a front elevation of each piece standing free. Millimetres throughout.
 */
export function technicalDrawings(input: DrawingInput): Sheet[] {
  const pieces = placePieces(input), studio = input.studio, letters = new Map<string, string>();
  for (const w of studio?.walls ?? []) {
    if (wallGeometry(studio!, w)) {
      letters.set(w.id, String.fromCharCode(65 + letters.size));
    }
  }
  const plan = planView(studio, pieces);
  for (const [id, letter] of letters) {
    const g = wallGeometry(studio!, studio!.walls.find(w => w.id === id)!)!, mine = pieces.filter(p => p.wall === id);
    const lo = mine.length ? Math.min(...mine.map(p => p.lo)) : g.face.start, hi = mine.length ? Math.max(...mine.map(p => p.hi)) : g.face.end;
    const t = (lo + hi) / 2 - g.face.start;
    const out = (mine.length ? Math.max(...mine.map(p => p.off + p.design.d)) : 0) + MARK_OUT;
    const at = { x: g.face.from.x + g.line.ux * t + g.line.nx * out, z: g.face.from.z + g.line.uz * t + g.line.nz * out };
    plan.push({ kind: 'view-mark', at: { x: mm(at.x), y: -mm(at.z) }, dir: { x: -g.line.nx, y: g.line.nz }, text: letter });
  }
  const checks = [...designChecks(studio, pieces, letters), ...planClearances(studio, pieces).checks], about = (marks: readonly string[]) =>
    checks.filter(c => marks.some(m => c.startsWith(m + ' ') || c.includes(' ' + m + ' ')));
  const sheets: Sheet[] = [{ number: 1, title: 'Plan', views: [{ title: 'Plan', items: plan }], pieces: pieces.map(p => row(p, letters)), checks }];
  for (const [id, letter] of letters) {
    const mine = pieces.filter(p => p.wall === id);
    sheets.push({ number: sheets.length + 1, title: 'Elevation ' + letter, views: [{ title: 'Elevation ' + letter, items: wallElevation(studio!, id, pieces) }],
      pieces: mine.map(p => row(p, letters)), checks: about(mine.map(p => p.mark)) });
  }
  for (const p of pieces.filter(q => q.wall === null)) {
    sheets.push({ number: sheets.length + 1, title: 'Front elevation ' + p.mark, views: [{ title: 'Front elevation ' + p.mark, items: pieceElevation(p, studio) }], pieces: [row(p, letters)], checks: about([p.mark]) });
  }
  // Shop drawings: each cabinet and wardrobe on its own sheet, to make it from.
  for (const p of pieces.filter(q => !q.fixture)) {
    sheets.push({ number: sheets.length + 1, title: p.mark + '  ' + pieceName(p), views: unitDetailViews(p), pieces: [row(p, letters)], checks: about([p.mark]) });
  }
  const details = constructionDetails(pieces);
  details.forEach((views, k) => sheets.push({ number: sheets.length + 1, title: 'Construction details' + (details.length > 1 ? ' ' + (k + 1) + ' of ' + details.length : ''), views, pieces: [], checks: [] }));
  // Schedules: the cutting list and the hardware list, each running on over as many sheets as it needs.
  for (const [title, pages] of [['Cutting list', cuttingList(pieces)], ['Hardware list', hardwareList(pieces)]] as const) {
    pages.forEach((table, k) => sheets.push({ number: sheets.length + 1, title: title + (pages.length > 1 ? ' ' + (k + 1) + ' of ' + pages.length : ''), views: [], table, pieces: [], checks: [] }));
  }
  return sheets;
}
