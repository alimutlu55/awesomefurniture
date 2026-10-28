import { cornerCabinetWidths, cornerReturnJoints } from '../kitchen/corner-widths';
import { unitAxes } from '../kitchen/kitchen-runs';
import type { PlacedPiece } from './room-pieces';

/** Installation stops from the cabinet's left edge, in model centimetres, shared with the editor rulers. */
export function cornerFaceWidths(p: PlacedPiece, pieces: readonly PlacedPiece[]) {
  const pose = (q: PlacedPiece) => ({ ...q, state: q.design });
  return cornerCabinetWidths(pose(p), pieces.map(pose));
}

export function cornerWidthStops(p: PlacedPiece, pieces: readonly PlacedPiece[]): number[] {
  return [0, ...cornerFaceWidths(p, pieces).map(s => s.to)];
}

/** Installation overview uses the gross joint allowance. The inner butt-joint thickness and strip
 * cutting width are dimensioned on the corner detail. An unclosed joint keeps every actual stop. */
export function installationWidthStops(p: PlacedPiece, pieces: readonly PlacedPiece[]): number[] {
  if (p.design.unit === 'filler') {
    const owners = pieces.filter(q => q.id > 0 && q.id !== p.id && (p.attachedTo === undefined || q.id === p.attachedTo));
    for (const owner of owners) {
      const { u } = unitAxes(owner.angle), side = (p.x - owner.x) * u.x + (p.z - owner.z) * u.z < 0 ? -1 : 1;
      const { v } = unitAxes(owner.angle);
      const along = (p.x - owner.x) * u.x + (p.z - owner.z) * u.z;
      const across = (p.x - owner.x) * v.x + (p.z - owner.z) * v.z;
      if (Math.abs(along - side * (owner.design.w + p.design.w) / 2) > 1e-5
        || Math.abs(across - (p.design.d - owner.design.d) / 2) > 1e-5
        || Math.abs(p.y - owner.y) > 1e-5 || Math.abs(p.angle - owner.angle) > 1e-5) continue;
      const joints = cornerReturnJoints({ ...owner, state: owner.design }, pieces.map(q => ({ ...q, state: q.design })))
        .filter(j => j.side === side && j.blind);
      if (joints.length === 1 && Math.abs(joints[0]!.bodyGap - joints[0]!.requiredGap) < 1e-5
        && Math.abs(joints[0]!.stripWidth - p.design.w) < 1e-5) {
        const t = joints[0]!.frontProjection;
        return side < 0 ? [-t, p.design.w] : [0, p.design.w + t];
      }
    }
  }
  return cornerWidthStops(p, pieces);
}
