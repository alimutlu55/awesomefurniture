import { fitting } from '../../wardrobe/fittings';
import { purposeDef } from '../../wardrobe/purposes';
import type { BuildModel, BuiltPiece } from '../build-model';
import { bayAt } from '../physics/contents';
import { type LoadCheck, type LoadCheckKind, SAG_LIMIT } from '../physics/structure';
import { type EngineFinding, type Fix, type RulePack, type Severity, showPiece } from './engine-rules';

/**
 * Engineering: whether the piece carries what is planned for it (physics/structure.ts). A part over its limit is a
 * warning; one at more than NEAR of its limit is advice. Loads are design estimates (storage-load.ts), so these never
 * block manufacture: the blocking rules on spans stay in the manufacturing check.
 */

/** From this share of its limit, a part is reported as near it. */
export const NEAR = .85;

const KIND: Readonly<Record<LoadCheckKind, { what: string; why: string; fix?: string }>> = {
  'shelf-sag': { what: 'bends', why: 'A shelf should not sag more than 1/' + Math.round(1 / SAG_LIMIT) + ' of its span over the years under what is kept on it '
    + '(beam on two supports, the board\'s stiffness and creep, the planned contents).', fix: 'Split the bay' },
  'rail-span': { what: 'spans', why: 'A hanging rail longer than its rated span bows under clothes without a centre support.', fix: 'Split the bay' },
  'lift-load': { what: 'lifts', why: 'A pull-down rail lifts at most its rated load; heavier clothes make it drop or stick.' },
  'runner-load': { what: 'carries', why: 'Drawer runners are rated for a load per pair, the box and front included.' },
  'hinge-load': { what: 'weighs', why: 'Each hinge carries part of a door\'s weight; a door heavier than its hinges are rated for drops out of line.' },
};

const round = (v: number, unit: 'mm' | 'kg') => unit === 'mm' && v < 50 ? Math.round(v * 10) / 10 : Math.round(v);
/** A share of the limit as a whole percentage that never reads 100% when the limit is passed. */
export const percentOf = (utilisation: number) => utilisation > 1 ? Math.max(101, Math.round(utilisation * 100)) : Math.round(utilisation * 100);
/** Kinds whose measure is not the load itself, so the load is said too ("spans 1204 mm with 12 kg"). */
const SAYS_LOAD: ReadonlySet<LoadCheckKind> = new Set(['shelf-sag', 'rail-span']);

function subject(p: BuiltPiece, l: LoadCheck): string {
  if (l.board !== undefined) return p.make.boards[l.board]?.name ?? 'Board';
  const c = p.contents.find(q => q.bay === l.bay && q.item === l.item);
  return c ? (fitting(c.fitting)?.name ?? c.fitting) + ' in bay ' + (c.bay + 1) : 'Fitting';
}

function fixesFor(p: BuiltPiece, l: LoadCheck): Fix[] {
  const fix = KIND[l.kind].fix, b = l.board !== undefined ? p.make.boards[l.board] : undefined;
  const bay = l.bay ?? (b ? bayAt(p.piece.design, (b.x0 + b.x1) / 2) : -1);
  const split: Fix[] = fix && bay >= 0 ? [{ label: fix, action: { kind: 'split-bay', piece: p.piece.id, bay } }] : [];
  return [...split, showPiece(p.piece.id)];
}

function finding(p: BuiltPiece, l: LoadCheck): EngineFinding | null {
  const severity: Severity | null = l.utilisation > 1 ? 'warning' : l.utilisation > NEAR ? 'advice' : null;
  if (!severity) return null;
  const k = KIND[l.kind], what = subject(p, l), unit = l.unit, held = SAYS_LOAD.has(l.kind) ? ' with ' + Math.round(l.kg) + ' kg' : '';
  const contents = p.contents.filter(c => l.board === undefined ? c.bay === l.bay && c.item === l.item
    : c.carried.kind === 'boards' && c.carried.shares.some(s => s.board === l.board));
  const of = [...new Set(contents.map(c => purposeDef(c.purpose)?.label).filter(Boolean))].join(', ');
  return {
    id: 'engineering:' + l.kind + ':' + p.piece.mark + ':' + (l.board ?? l.bay + '.' + l.item), pack: 'engineering', severity,
    title: p.piece.mark + ' ' + what + ' ' + k.what + ' ' + round(l.measured, unit) + ' ' + unit + held + (of ? ' (' + of + ')' : '')
      + ', ' + percentOf(l.utilisation) + '% of its limit',
    why: k.why, piece: p.piece.id, mark: p.piece.mark, board: l.board,
    measured: { value: round(l.measured, unit), unit }, limit: { value: round(l.limit, unit), unit }, fixes: fixesFor(p, l),
  };
}

export const engineeringPack: RulePack = {
  key: 'engineering',
  label: 'Engineering',
  evaluate: (model: BuildModel) => model.pieces.flatMap(p => p.loads.flatMap(l => finding(p, l) ?? [])),
};
