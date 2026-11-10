import { type BuildDefect, verifyPiece } from '../../make/make-verify';
import { standUpHeight } from '../../make/stand-up';
import { roomHeight } from '../../studio/studio';
import type { BuildModel, BuiltPiece } from '../build-model';
import { type EngineFinding, type RulePack, showPiece } from './engine-rules';

/**
 * Buildability: whether each piece can be put together exactly as Make sets it out (make/make-verify.ts). Every
 * defect blocks: a board nothing holds, a screw that comes out the far face, a joint that cannot be made in the build
 * order, hardware on no list. These are not estimates like loads; they are closures that either hold or do not, so a
 * piece with one is not issued and cannot be opened in Assembly (assembly-gate.ts). Drilling that cannot be made is
 * the drilling pack's, from the same check.
 *
 * It also says, as advice, when a piece is too tall to be stood up in its room after being built lying down
 * (make/stand-up.ts): the steps then have to be done standing, where it goes.
 */

const mm = (cm: number) => Math.round(cm * 10);

function fromDefect(p: BuiltPiece, d: BuildDefect, k: number): EngineFinding {
  return {
    id: 'buildability:' + p.piece.mark + ':' + d.kind + ':' + (d.board ?? '') + ':' + k, pack: 'buildability', severity: 'blocking',
    title: p.piece.mark + ' ' + d.what, why: d.why, piece: p.piece.id, mark: p.piece.mark, board: d.board,
    ...(d.measured !== undefined ? { measured: { value: d.measured, unit: 'mm' as const } } : {}),
    ...(d.limit !== undefined ? { limit: { value: d.limit, unit: 'mm' as const } } : {}),
    fixes: [showPiece(p.piece.id)],
  };
}

function standUp(model: BuildModel, p: BuiltPiece): EngineFinding[] {
  const studio = model.input.studio, { h, d } = p.piece.design;
  if (!studio || p.piece.hung || p.piece.fixture) return [];
  const wall = p.piece.wall ? studio.walls.find(w => w.id === p.piece.wall) : undefined, ceiling = wall?.height ?? roomHeight(studio), needs = standUpHeight(h, d);
  if (!Number.isFinite(ceiling) || needs <= ceiling) return [];
  return [{
    id: 'buildability:stand-up:' + p.piece.mark, pack: 'buildability', severity: 'advice',
    title: p.piece.mark + ' cannot be stood up in this room once built lying down: it needs ' + mm(needs) + ' mm, the ceiling is ' + mm(ceiling) + ' mm',
    why: 'A piece raised from the floor turns about its bottom edge, so the room must be as high as its diagonal (height and depth). Build it standing where it goes: the steps allow it.',
    piece: p.piece.id, mark: p.piece.mark, measured: { value: mm(needs), unit: 'mm' }, limit: { value: mm(ceiling), unit: 'mm' }, fixes: [showPiece(p.piece.id)],
  }];
}

export const buildabilityPack: RulePack = {
  key: 'buildability',
  label: 'Buildability',
  evaluate: (model: BuildModel) => model.pieces.flatMap(p => [
    // Drilling defects are reported by the drilling pack, from the same findings.
    ...verifyPiece(p.make).filter(d => d.kind !== 'bore').map((d, k) => fromDefect(p, d, k)),
    ...standUp(model, p),
  ]),
};
