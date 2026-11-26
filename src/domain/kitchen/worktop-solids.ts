import { kitchenSpans, type UnitPose } from './kitchen-runs';

/** The worktop over each run of base units, as a solid: the slab the renderer draws, its thickness above the carcasses
 * and its overhang in front. Nothing else may stand inside it (a wall unit lowered onto the carcasses stops on the
 * worktop's top, not inside it). Worktops of two runs meet at a corner joint, so they never block each other. */
export function worktopSolids(poses: readonly UnitPose[]) {
  return kitchenSpans(poses).filter(s => s.kind === 'worktop').map(s => ({
    id: 'worktop:' + s.units.join('+'), x: s.x, y: s.y, z: s.z, angle: s.angle, worktop: true as const,
    state: { w: s.length, h: s.height, d: s.depth },
  }));
}
