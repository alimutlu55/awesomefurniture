import type { Finding } from '../../make/make-assembly';
import type { BuildModel, BuiltPiece } from '../build-model';
import { type EngineFinding, type RulePack, type Severity, showPiece } from './engine-rules';

/**
 * Make's drilling check (make-assembly.ts `drillingChecks`) as a rule pack: bores that run into each other anywhere
 * inside a board, break out of the far face, meet from both faces or are drilled past the board. Make shows them on
 * the board; the engine shows them with the rest, before anyone opens Make. Drilling that cannot be made blocks: the
 * part would be scrap. A hole inside the board but near its edge is advice.
 */

const WHAT: Readonly<Record<Finding['kind'], { title: string; why: string }>> = {
  clash: { title: 'two holes run into each other', why: 'Bores closer than 2 mm tear the board between them when drilled, wherever they are drilled from.' },
  breakout: { title: 'a blind hole breaks out of the far face', why: 'A blind hole must leave at least 2.5 mm of board behind it.' },
  meet: { title: 'holes from both faces meet inside the board', why: 'Two blind holes drilled from opposite faces must not meet.' },
  edge: { title: 'a hole sits near the edge', why: 'A hole within 3 mm of an edge can split the edge banding or the board.' },
};
/** A hole near an edge but inside the board is advice; anything else cannot be drilled as set out. */
const severityOf = (f: Finding): Severity => f.kind === 'edge' && f.gap >= 0 ? 'advice' : 'blocking';

function findings(p: BuiltPiece): EngineFinding[] {
  return p.make.findings.map((f, k) => {
    const what = WHAT[f.kind], board = p.make.boards[f.board];
    return {
      id: 'drilling:' + p.piece.mark + ':' + f.board + ':' + f.kind + ':' + k, pack: 'drilling', severity: severityOf(f),
      title: p.piece.mark + ' ' + (board?.name ?? 'board') + ': ' + (f.kind === 'edge' && f.gap < 0 ? 'a hole is drilled outside the board' : what.title) + ' (' + f.gap + ' mm)', why: what.why,
      piece: p.piece.id, mark: p.piece.mark, board: f.board, measured: { value: f.gap, unit: 'mm' }, fixes: [showPiece(p.piece.id)],
    };
  });
}

export const drillingPack: RulePack = {
  key: 'drilling',
  label: 'Drilling',
  evaluate: (model: BuildModel) => model.pieces.flatMap(findings),
};
