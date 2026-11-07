import type { Finding } from '../../make/make-assembly';
import type { BuildModel, BuiltPiece } from '../build-model';
import { type EngineFinding, type RulePack, type Severity, showPiece } from './engine-rules';

/**
 * Make's drilling check (make-assembly.ts `drillingChecks`) as a rule pack: holes that run into each other, break out of
 * the far face, meet inside a board or sit too near an edge. Make shows them on the board; the engine shows them with
 * the rest, before anyone opens Make. They warn rather than block, as the drawings treat them.
 */

const WHAT: Readonly<Record<Finding['kind'], { severity: Severity; title: string; why: string }>> = {
  clash: { severity: 'warning', title: 'two holes run into each other', why: 'Holes closer than 2 mm tear the board between them when drilled.' },
  breakout: { severity: 'warning', title: 'a blind hole breaks out of the far face', why: 'A blind hole must leave at least 2.5 mm of board behind it.' },
  meet: { severity: 'warning', title: 'holes from both faces meet inside the board', why: 'Two blind holes drilled from opposite faces must not meet.' },
  edge: { severity: 'advice', title: 'a hole sits near the edge', why: 'A hole within 3 mm of an edge can split the edge banding or the board.' },
};

function findings(p: BuiltPiece): EngineFinding[] {
  return p.make.findings.map((f, k) => {
    const what = WHAT[f.kind], board = p.make.boards[f.board];
    return {
      id: 'drilling:' + p.piece.mark + ':' + f.board + ':' + f.kind + ':' + k, pack: 'drilling', severity: what.severity,
      title: p.piece.mark + ' ' + (board?.name ?? 'board') + ': ' + what.title + ' (' + f.gap + ' mm)', why: what.why,
      piece: p.piece.id, mark: p.piece.mark, board: f.board, measured: { value: f.gap, unit: 'mm' }, fixes: [showPiece(p.piece.id)],
    };
  });
}

export const drillingPack: RulePack = {
  key: 'drilling',
  label: 'Drilling',
  evaluate: (model: BuildModel) => model.pieces.flatMap(findings),
};
