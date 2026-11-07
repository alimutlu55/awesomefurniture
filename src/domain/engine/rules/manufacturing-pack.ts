import type { Board } from '../../drawings/cabinet-boards';
import { type ManufacturingFinding, validateForManufacture } from '../../drawings/manufacturing-validation';
import type { BuildModel, BuiltPiece } from '../build-model';
import { bayAt } from '../physics/contents';
import { type EngineFinding, type Fix, type RulePack, pieceOfMark, showPiece } from './engine-rules';

/**
 * The manufacturing check (domain/drawings/manufacturing-validation.ts) as a rule pack: the same findings the drawings
 * fail closed on, shown while the design is edited instead of only when drawings are issued. A critical finding blocks;
 * any other is a warning. Where the check names a board and the fix is a new partition, the fix splits the bay under it.
 */

/** The fix that splits the bay a board spans, with a partition under its middle. */
function splitUnder(piece: BuiltPiece, b: Board | undefined): Fix[] {
  const bay = b ? bayAt(piece.piece.design, (b.x0 + b.x1) / 2) : -1;
  return bay < 0 ? [] : [{ label: 'Split the bay', action: { kind: 'split-bay', piece: piece.piece.id, bay } }];
}

function fromFinding(model: BuildModel, f: ManufacturingFinding): EngineFinding {
  const where = pieceOfMark(model, f.at?.mark ?? f.marks[0]), built = model.pieces.find(p => p.piece.id === where.piece);
  // Make's board list starts with the piece's cut boards in `pieceBoards` order, the order the check names boards by.
  const board = f.at?.board, boards = built && board !== undefined ? built.make.boards : [];
  const fixes: Fix[] = [];
  if (where.piece !== undefined) {
    if (f.fix === 'Add a partition' && built) fixes.push(...splitUnder(built, boards[board!]));
    fixes.push(showPiece(where.piece));
  }
  return {
    id: 'manufacturing:' + f.id, pack: 'manufacturing', severity: f.severity === 'critical' ? 'blocking' : 'warning',
    title: f.message, why: f.rule + (f.fix && !fixes.some(x => x.action.kind === 'split-bay') ? '. ' + f.fix + '.' : ''),
    ...where, board,
    ...(f.measured !== undefined ? { measured: { value: f.measured, unit: 'mm' as const } } : {}),
    ...(f.limit !== undefined ? { limit: { value: f.limit, unit: 'mm' as const } } : {}),
    fixes,
  };
}

export const manufacturingPack: RulePack = {
  key: 'manufacturing',
  label: 'Manufacturing check',
  evaluate: model => validateForManufacture(model.input).findings.map(f => fromFinding(model, f)),
};
