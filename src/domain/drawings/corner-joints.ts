import { cornerReturnJoints, type CornerReturnJoint } from '../kitchen/corner-widths';
import type { PlacedPiece } from './room-pieces';
import type { ManufacturingFinding } from './manufacturing-validation';
import { mm } from './drawing';
import { unitAxes } from '../kitchen/kitchen-runs';
import { kitchenFrontThickness } from '../kitchen/installation-parts';

export interface InstalledCorner extends CornerReturnJoint {
  readonly owner: PlacedPiece;
  readonly other: PlacedPiece;
}

/** One connection per pair of cabinets and returning end; independent of contents and input ordering. */
export function installedCorners(pieces: readonly PlacedPiece[]): InstalledCorner[] {
  const poses = pieces.map(p => ({ ...p, state: p.design }));
  return pieces.filter(p => p.id > 0).flatMap(owner =>
    cornerReturnJoints({ ...owner, state: owner.design }, poses).flatMap(j => {
      const other = pieces.find(p => p.id === j.otherId);
      if (!other) return [];
      return [{ ...j, owner, other }];
    })).sort((a, b) => a.owner.id - b.owner.id || a.other.id - b.other.id || a.side - b.side);
}

/** Include explicit strips: a manual narrow/short filler must not suppress the automatic part and
 * silently leave the joint open. Locate by actual front alignment, not a transient negative id. */
function fittedStrip(j: InstalledCorner, pieces: readonly PlacedPiece[]) {
  const b = j.owner, { u, v } = unitAxes(b.angle);
  return pieces.find(p => {
    if (p.design.unit !== 'filler' || p.id === b.id) return false;
    const along = (p.x - b.x) * u.x + (p.z - b.z) * u.z;
    const across = (p.x - b.x) * v.x + (p.z - b.z) * v.z;
    const sameAngle = Math.cos((p.angle - b.angle) * Math.PI / 180) > 1 - 1e-7;
    return sameAngle && Math.abs(along - j.side * (b.design.w + p.design.w) / 2) < 1e-5
      && Math.abs(across - (p.design.d - b.design.d) / 2) < 1e-5;
  });
}

/** Geometry checks, not a hardware approval: a closed corner must contain real stock and close its joint. */
export function cornerJointFindings(pieces: readonly PlacedPiece[]): ManufacturingFinding[] {
  return installedCorners(pieces).flatMap(j => {
    const marks = [j.other.mark, j.owner.mark], id = 'corner:' + marks.join(':') + ':' + j.side;
    const rule = j.blind ? 'Gross corner allowance includes the overlapping front thickness'
      : 'Open corners reserve both full strips and the adjoining front thickness';
    if (j.stripWidth < .1) return [{ id, marks, rule, severity: 'critical', area: 'assembly',
      message: marks.join(' / ') + ': ' + mm(j.requiredGap) + ' mm corner allowance leaves no usable return strip after the '
        + mm(j.frontProjection) + ' mm front thickness.' }];
    const delta = j.bodyGap - j.requiredGap;
    if (Math.abs(delta) <= .05) {
      const strip = fittedStrip(j, pieces);
      const bottom = Math.max(j.owner.y, j.other.y), top = Math.min(j.owner.y + j.owner.design.h, j.other.y + j.other.design.h);
      if (!strip || Math.abs(strip.design.w - j.stripWidth) > .05 || strip.y > bottom + .05
        || strip.y + strip.design.h < top - .05
        || Math.abs(kitchenFrontThickness(strip.design) - kitchenFrontThickness(j.owner.design)) > .05)
        return [{ id: id + ':stock', marks, rule, severity: 'critical', area: 'assembly',
          message: marks.join(' / ') + ': fit one ' + mm(j.stripWidth) + ' mm return strip with matching front stock over the joint height.' }];
      return [];
    }
    return [{ id, marks, rule, severity: 'critical', area: 'assembly',
      message: marks.join(' / ') + ': actual corner spacing ' + mm(j.bodyGap) + ' mm; required ' + mm(j.requiredGap)
        + ' mm from the carcass front. ' + (delta > 0 ? mm(delta) + ' mm remains unfilled.' : mm(-delta) + ' mm is missing.') }];
  });
}
