import { cornerStripWidth } from './corner-widths';
import { kitchenFrontThickness, localSolid } from './installation-parts';
import { unitAxes } from './kitchen-runs';
import { installationKind, isFixture } from './kitchen-units';
import { plinthOf } from '../wardrobe/carcass';
import type { InstallationPose } from './installation-layout';

type Envelope = Pick<InstallationPose, 'id' | 'x' | 'y' | 'z' | 'angle'> & { state: { w: number; h: number; d: number } };
type Guard = ReturnType<typeof localSolid> & { cornerGuardFor?: string | number; cornerFront?: boolean };
const EPS = 1e-5;
const cabinet = (p: InstallationPose) => p.state.product === 'kitchen' && !installationKind(p.state) && !isFixture(p.state);

/** Whether this unit's depth would hide only part of the other front at their intersection.
 * Ignore distance along this unit's width: a swept move must reserve the joint before it gets there. */
function blindReturn(owner: InstallationPose, other: InstallationPose) {
  const { v } = unitAxes(owner.angle), axes = unitAxes(other.angle);
  const x = other.x + axes.v.x * other.state.d / 2, z = other.z + axes.v.z * other.state.d / 2;
  const origin = (x - owner.x) * v.x + (z - owner.z) * v.z, dir = axes.u.x * v.x + axes.u.z * v.z;
  const a = (-owner.state.d / 2 - origin) / dir, b = (owner.state.d / 2 - origin) / dir;
  const lo = Math.max(-other.state.w / 2, Math.min(a, b)), hi = Math.min(other.state.w / 2, Math.max(a, b));
  return hi - lo > EPS && hi - lo < other.state.w - EPS;
}

/** Prospective return-leg stock at both ends of perpendicular cabinets. These are collision guards,
 * not physical parts: never render, save, cut or charge for them. Each guard tests only the named
 * neighbour's full module front datum, so door reveals cannot consume the corner allowance.
 * Reserving both sides also catches a large pointer jump whose destination has no corner parts. */
export function cornerSweepSolids(poses: readonly Envelope[], targets: readonly Envelope[]): Guard[] {
  return (poses as readonly InstallationPose[]).filter(cabinet).flatMap<Guard>(owner => {
    const axes = unitAxes(owner.angle);
    const guards = (targets as readonly InstallationPose[]).filter(cabinet).flatMap(other => {
      if (owner.id === other.id) return [];
      const oa = unitAxes(other.angle), dir = axes.u.x * oa.v.x + axes.u.z * oa.v.z;
      if (Math.abs(dir) < Math.cos(.5 * Math.PI / 180) - EPS) return [];
      const blind = blindReturn(owner, other), projection = kitchenFrontThickness(other.state) / Math.abs(dir);
      const width = cornerStripWidth(owner.state) + (blind ? -projection : projection);
      if (width <= EPS) return [];
      // An open L reserves the joint square in both directions. Its two guards describe the same
      // empty space; test them against fronts, never against one another.
      const depth = kitchenFrontThickness(owner.state) + (blind ? 0 : cornerStripWidth(other.state));
      return ([-1, 1] as const).map(side => ({
        ...localSolid(owner, { x0: side < 0 ? -width : owner.state.w, x1: side < 0 ? 0 : owner.state.w + width,
          y0: Math.min(plinthOf(owner.state), owner.state.h - .1), y1: owner.state.h,
          z0: owner.state.d, z1: owner.state.d + depth }),
        cornerGuardFor: other.id,
      }));
    });
    return guards.length ? [...guards, { ...localSolid(owner, { x0: 0, x1: owner.state.w,
      y0: Math.min(plinthOf(owner.state), owner.state.h - .1), y1: owner.state.h,
      z0: owner.state.d, z1: owner.state.d + kitchenFrontThickness(owner.state) }), cornerFront: true }] : [];
  });
}
