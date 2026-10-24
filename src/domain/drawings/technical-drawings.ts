import { DRAWING_PRESETS, type DrawingOptions } from './view-policy';
import { constructionIssues, alignmentIssues } from './drawing-issues';
import { mm, type PieceRow, type Sheet } from './drawing';
import { type DrawingInput, type PlacedPiece, pieceName, placePieces, wallGeometry } from './room-pieces';
import { planClearances } from './plan-clearances';
import { planView } from './plan-view';
import { pieceElevation, wallElevation } from './wall-elevation';
import { designChecks } from './checks';
import { unitDetailViews } from './unit-detail';
import { cuttingList } from './cutting-list';
import { hardwareList } from './hardware-list';
import { applianceDetailSheets } from './appliance-details';
import { applianceReview, applianceSchedule } from './appliance-setout';
import { constructionDetails } from './construction-details';
import { materialSchedule } from './material-schedule';

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
export function technicalDrawings(input: DrawingInput, options: DrawingOptions = {}): Sheet[] {
  const pieces = placePieces(input), studio = input.studio, letters = new Map<string, string>();
  for (const w of studio?.walls ?? []) {
    if (wallGeometry(studio!, w)) {
      letters.set(w.id, String.fromCharCode(65 + letters.size));
    }
  }
  const preset = options.preset ?? 'layout', config = { ...options, preset };
  const plan = planView(studio, pieces, { ...config, upperPlan: false });
  for (const [id, letter] of letters) {
    const g = wallGeometry(studio!, studio!.walls.find(w => w.id === id)!)!, mine = pieces.filter(p => p.wall === id);
    const lo = mine.length ? Math.min(...mine.map(p => p.lo)) : g.face.start, hi = mine.length ? Math.max(...mine.map(p => p.hi)) : g.face.end;
    const t = (lo + hi) / 2 - g.face.start;
    const out = (mine.length ? Math.max(...mine.map(p => p.off + p.design.d)) : 0) + MARK_OUT;
    const at = { x: g.face.from.x + g.line.ux * t + g.line.nx * out, z: g.face.from.z + g.line.uz * t + g.line.nz * out };
    plan.push({ kind: 'view-mark', at: { x: mm(at.x), y: -mm(at.z) }, dir: { x: -g.line.nx, y: g.line.nz }, text: letter });
  }
  const geometryChecks = designChecks(studio, pieces, letters), clearance = planClearances(studio, pieces, options.clearanceProfile);
  const applianceIssues = applianceReview(pieces);
  const issues = [...constructionIssues(geometryChecks, pieces), ...alignmentIssues(studio, pieces), ...clearance.issues, ...applianceIssues];
  const checks = [...new Set([...geometryChecks, ...clearance.checks])], about = (marks: readonly string[]) =>
    checks.filter(c => marks.some(m => c.startsWith(m + ' ') || c.includes(' ' + m + ' ')));
  const purpose = DRAWING_PRESETS.find(p => p.key === preset)!.label;
  const legend = ['Solid: visible furniture · light dashes: overhead · FFL: finished floor = 0',
    preset === 'clearances' ? 'Long dashes: opening envelopes · dimensions in mm · verify the selected review profile'
      : applianceIssues.length ? 'CL = centre line · wall left is its elevation left end · manufacturer cut-outs unconfirmed'
        : 'Exact construction sizes: individual detail sheets'];
  const sheets: Sheet[] = [{ number: 1, title: 'Plan', purpose, legend, issues, views: [{ title: purpose + ' plan', items: plan }],
    pieces: pieces.filter(p => p.y < 120).map(p => row(p, letters)), checks: preset === 'clearances' ? checks : geometryChecks }];
  if (options.upperPlan !== false && pieces.some(p => p.y >= 120)) sheets.push({ number: 2, title: 'Upper furniture plan', purpose,
    legend: ['Upper units only · elevations show exact mounting levels · dimensions in mm'], issues,
    views: [{ title: 'Upper furniture plan', items: planView(studio, pieces, { ...config, upperPlan: true }) }],
    pieces: pieces.filter(p => p.y >= 120).map(p => row(p, letters)), checks: [] });
  for (const [id, letter] of letters) {
    const mine = pieces.filter(p => p.wall === id);
    sheets.push({ number: sheets.length + 1, title: 'Elevation ' + letter, views: [{ title: 'Elevation ' + letter, items: wallElevation(studio!, id, pieces) }],
      legend: ['Reference height chains are identified on the view · FFL = 0 · each cabinet has an exact detail sheet'], issues, purpose,
      pieces: mine.map(p => row(p, letters)), checks: about(mine.map(p => p.mark)) });
  }
  for (const p of pieces.filter(q => q.wall === null)) {
    sheets.push({ number: sheets.length + 1, title: 'Front elevation ' + p.mark, views: [{ title: 'Front elevation ' + p.mark, items: pieceElevation(p, studio) }], pieces: [row(p, letters)], checks: about([p.mark]) });
  }
  // Shop drawings: each cabinet and wardrobe on its own sheet, to make it from.
  for (const p of pieces.filter(q => !q.fixture)) {
    sheets.push({ number: sheets.length + 1, title: p.mark + '  ' + pieceName(p), views: unitDetailViews(p), pieces: [row(p, letters)], checks: about([p.mark]) });
  }
  sheets.push(...applianceDetailSheets(studio, pieces).map((s, i) => ({ ...s, number: sheets.length + i + 1 })));
  const appliances = applianceSchedule(studio, pieces);
  if (appliances) sheets.push({ number: sheets.length + 1, title: 'Appliance schedule', views: [], pieces: [], checks: [], table: appliances });
  const details = constructionDetails(pieces);
  details.forEach((views, k) => sheets.push({ number: sheets.length + 1, title: 'Construction details' + (details.length > 1 ? ' ' + (k + 1) + ' of ' + details.length : ''), views, pieces: [], checks: [] }));
  // Schedules: the cutting list and the hardware list, each running on over as many sheets as it needs.
  for (const [title, pages] of [['Cutting list', cuttingList(pieces)], ['Hardware list', hardwareList(pieces)]] as const) {
    pages.forEach((table, k) => sheets.push({ number: sheets.length + 1, title: title + (pages.length > 1 ? ' ' + (k + 1) + ' of ' + pages.length : ''), views: [], table, pieces: [], checks: [] }));
  }
  if (pieces.length) sheets.push({ number: sheets.length + 1, title: 'Furniture schedule', pieces: [], checks: [], views: [],
    table: { columns: ['Mark', 'Item', 'W × H × D (mm)', 'Location'], rows: pieces.map(p => { const r = row(p, letters); return [r.mark, r.name, r.size, r.where]; }),
      numeric: [], notes: ['K = kitchen item (cabinet, shelf, sink or hob); W = wardrobe. Identifiers remain stable when furniture moves. Heights and undersides are measured from finished floor.'] } });
  materialSchedule(pieces).forEach((table, i, pages) => sheets.push({ number: sheets.length + 1,
    title: 'Material & Hardware Schedule' + (pages.length > 1 ? ' ' + (i + 1) : ''), views: [], table, pieces: [], checks: [] }));
  if (issues.length) sheets.push({ number: sheets.length + 1, title: 'Review issues', pieces: [], checks: [], views: [],
    table: { columns: ['Type', 'Elements', 'Finding', 'Rule / reference'], numeric: [], notes: ['Review recommendations separately from confirmed geometry conflicts.'],
      rows: issues.map(i => [i.kind, i.marks.join(', '), i.message, i.rule ?? 'Geometry review']) } });
  return sheets.map((s, i) => ({ ...s, number: i + 1, purpose, issues }));
}
