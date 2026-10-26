import { piecefronts } from './fronts';
import { ventilationGrille } from '../kitchen/ventilation';
import { cornerFaceWidths } from './corner-widths';
import { installationKind } from '../kitchen/kitchen-units';
/**
 * The checks a design must pass before its drawings are issued for manufacture, kept apart from the code that draws
 * them: what the drawings show is checked against the model, not against itself. A critical finding means the set
 * must not be used to cut or order anything; the export then fails closed (the sheets say NOT FOR MANUFACTURE and list
 * why). Warnings are for review and do not block. Plain data; lengths in the model's centimetres, messages in mm.
 */
import type { Studio } from '../studio/studio';
import { roomHeight } from '../studio/studio';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { PANEL } from '../wardrobe/catalog.js';
import { mm, type Table } from './drawing';
import { pieceTop, piecesOverlap } from './checks';
import { type DrawingInput, type PlacedPiece, placePieces, wallGeometry } from './room-pieces';
import { pieceBoards } from './unit-detail';
import { cuttingList } from './cutting-list';

export type FindingArea = 'geometry' | 'assembly' | 'drawing' | 'export';
export interface ManufacturingFinding {
  readonly id: string;
  readonly severity: 'critical' | 'warning';
  readonly area: FindingArea;
  /** The pieces it is about, by their marks on the drawings. */
  readonly marks: readonly string[];
  readonly message: string;
  readonly rule: string;
}
export interface ManufacturingValidation {
  /** No critical finding: the set may be issued for manufacture. */
  readonly ready: boolean;
  /** The model revision the set was checked against: drawings and lists made from another revision are stale. */
  readonly revision: string;
  readonly findings: readonly ManufacturingFinding[];
}

/** Less than this is a touch, a joint or a rounding difference, not a clash or a mismatch. Centimetres. */
const TOUCH = .05;
/** Within this, two lengths that must add up do (half a millimetre). */
const EXACT = .05;

/** The model revision: a short, stable fingerprint of everything the drawings are made from (FNV-1a, 32 bits). */
export function modelRevision(input: DrawingInput): string {
  const text = JSON.stringify([input.studio ?? null, [...input.pieces].sort((a, b) => a.id - b.id)
    .map(p => [p.id, p.x, p.y, p.z, p.angle, p.design])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const finite = (...values: number[]) => values.every(v => Number.isFinite(v));

/** Pieces in the same place, taller than their room, or with a size that is not a real length. */
function geometryFindings(studio: Studio | undefined, pieces: readonly PlacedPiece[]): ManufacturingFinding[] {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    const { w, h, d } = p.design;
    if (!finite(w, h, d, p.x, p.y, p.z, p.angle) || w <= 0 || h <= 0 || d <= 0)
      out.push({ id: 'size:' + p.mark, severity: 'critical', area: 'geometry', marks: [p.mark], message: p.mark + ' has no valid size or position', rule: 'Every size is a positive length' });
  }
  pieces.forEach((a, k) => pieces.slice(k + 1).forEach(b => {
    if (piecesOverlap(a, b)) out.push({ id: 'clash:' + a.mark + ':' + b.mark, severity: 'critical', area: 'geometry', marks: [a.mark, b.mark],
      message: a.mark + ' and ' + b.mark + ' are in the same place', rule: 'No two pieces may intersect; touching is allowed' });
  }));
  for (const p of pieces) {
    const w = p.wall ? studio?.walls.find(x => x.id === p.wall) : undefined, limit = w?.height ?? (studio ? roomHeight(studio) : Infinity);
    const over = pieceTop(p) - limit;
    if (over > TOUCH) out.push({ id: 'tall:' + p.mark, severity: 'critical', area: 'geometry', marks: [p.mark],
      message: p.mark + ' is ' + mm(over) + ' mm taller than the room', rule: 'A piece fits under the ceiling' });
    const g = w && studio && wallGeometry(studio, w);
    if (g) {
      const past = Math.max(g.face.start - p.lo, p.hi - g.face.end);
      if (past > .5) out.push({ id: 'past:' + p.mark, severity: 'warning', area: 'geometry', marks: [p.mark],
        message: p.mark + ' runs ' + mm(past) + ' mm past the end of its wall', rule: 'Confirm an open end or a return' });
    }
  }
  return out;
}

/** Every board a real board inside its piece; a wardrobe's bays and boards adding up to its width; fittings that fit. */
function assemblyFindings(pieces: readonly PlacedPiece[]): ManufacturingFinding[] {
  const out: ManufacturingFinding[] = [];
  for (const p of pieces) {
    if (p.fixture) continue;
    const boards = pieceBoards(p, pieces), { w, h } = p.design;
    boards.forEach((b, i) => {
      const { length, width, thickness } = b.cut;
      if (!finite(length, width, thickness, b.x0, b.x1, b.y0, b.y1) || length < .1 || width < .1 || thickness < .1)
        out.push({ id: 'board:' + p.mark + ':' + i, severity: 'critical', area: 'assembly', marks: [p.mark],
          message: p.mark + ' ' + b.name + ' has no real cutting size', rule: 'Every board has a length, width and thickness' });
      else if (b.x0 < -TOUCH || b.x1 > w + TOUCH || b.y0 < -TOUCH || b.y1 > h + TOUCH)
        out.push({ id: 'outside:' + p.mark + ':' + i, severity: 'critical', area: 'assembly', marks: [p.mark],
          message: p.mark + ' ' + b.name + ' reaches outside the piece (' + mm(w) + ' × ' + mm(h) + ' mm)', rule: 'Boards stay inside their assembly' });
    });
    if (piecefronts(p.design).invalidFridgeSplit) out.push({ id: 'fridge-split:' + p.mark, severity: 'critical', area: 'assembly', marks: [p.mark],
      message: p.mark + ': the specified fridge door split is outside its front', rule: 'Door subdivisions stay inside their actual opening' });
    if ((p.design.ventilationWidth || p.design.ventilationHeight) && !ventilationGrille(p.design))
      out.push({ id: 'vent:' + p.mark, severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ': ventilation grille needs a valid width and height inside its plinth', rule: 'Grille outer envelope fits the modeled plinth' });
    if (p.design.cornerStrip) {
      const widths = cornerFaceWidths(p, pieces), strips = widths.filter(s => s.strip);
      if (!strips.length || strips.some(s => Math.abs(s.to - s.from - p.design.cornerStrip!) > EXACT))
        out.push({ id: 'strip:' + p.mark, severity: 'critical', area: 'assembly', marks: [p.mark],
          message: p.mark + ': the specified corner strip cannot be reserved beside a perpendicular return', rule: 'Installation allowances fit their actual geometry' });
    }
    if (installationKind(p.design)) continue;
    const rules = createWardrobeGeometry(() => ({ sel: 0, item: -1, divider: -1, space: null, ...p.design })), widths = rules.widths();
    const total = widths.reduce((s, x) => s + x, 0) + (widths.length + 1) * PANEL;
    if (Math.abs(total - w) > EXACT)
      out.push({ id: 'bays:' + p.mark, severity: 'critical', area: 'assembly', marks: [p.mark],
        message: p.mark + ': bays and boards add up to ' + mm(total) + ' mm, not its ' + mm(w) + ' mm width', rule: 'Inside widths plus board thicknesses equal the outer width' });
    widths.forEach((_, i) => {
      if (!rules.sectionLayoutValid(i) || rules.overflow(i) > EXACT)
        out.push({ id: 'fit:' + p.mark + ':' + i, severity: 'critical', area: 'assembly', marks: [p.mark],
          message: p.mark + ' section ' + (i + 1) + ': fittings overlap, or reach above its top', rule: 'Fittings fit their section without intersecting' });
    });
  }
  return out;
}

/** The cutting list counts every board of every piece, once, under its mark: part by part, so a kitchen run's own
 * worktop and plinth (listed under the mark of a run of one unit) are not taken for the unit's boards. */
export function listFindings(pieces: readonly PlacedPiece[], list: readonly Table[]): ManufacturingFinding[] {
  const out: ManufacturingFinding[] = [], listed = new Map<string, number>(), key = (mark: string, part: string) => mark + '\u0000' + part;
  for (const row of list.flatMap(t => t.rows)) listed.set(key(row[0]!, row[1]!), (listed.get(key(row[0]!, row[1]!)) ?? 0) + Number(row[2]));
  for (const p of pieces) {
    if (p.fixture === 'sink' || p.fixture === 'hob') continue;
    const model = new Map<string, number>();
    for (const b of pieceBoards(p, pieces)) model.set(b.name, (model.get(b.name) ?? 0) + 1);
    for (const [part, boards] of model) {
      const count = listed.get(key(p.mark, part)) ?? 0;
      if (count !== boards) out.push({ id: 'list:' + p.mark + ':' + part, severity: 'critical', area: 'export', marks: [p.mark],
        message: 'The cutting list has ' + count + ' × ' + part + ' for ' + p.mark + '; the model has ' + boards, rule: 'Cutting list and model agree' });
    }
  }
  const marks = pieces.map(p => p.mark), twice = marks.filter((m, i) => marks.indexOf(m) !== i);
  for (const m of new Set(twice)) out.push({ id: 'mark:' + m, severity: 'critical', area: 'export', marks: [m],
    message: 'Two pieces share the mark ' + m, rule: 'Every piece has its own mark' });
  return out;
}

/**
 * Checks a design for manufacture: geometry (no clashes, under the ceiling, real sizes), assembly (real boards inside
 * each piece, bays adding up to the width, fittings that fit) and the cutting list against the model. `drawing` adds
 * findings only the paper can show (annotations that could not be placed). Deterministic: the same model gives the
 * same findings in the same order.
 */
export function validateForManufacture(input: DrawingInput, drawing: readonly ManufacturingFinding[] = []): ManufacturingValidation {
  const pieces = placePieces(input);
  const findings = [...geometryFindings(input.studio, pieces), ...assemblyFindings(pieces), ...listFindings(pieces, cuttingList(pieces)), ...drawing];
  return { ready: !findings.some(f => f.severity === 'critical'), revision: modelRevision(input), findings };
}
