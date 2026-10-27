import { cabinetBoards } from '../drawings/cabinet-boards';
import { cornerCabinetWidths } from './corner-widths';
import { installationSolid, localSolid } from './installation-parts';
import { installationKind } from './kitchen-units';
import type { InstallationPose } from './installation-layout';

/** Reserved footprints plus actual stock outside them. Finished fronts constrain installation parts
 * even where the front is beyond its carcass. Plain geometry-only clients need no fitting data. */
type Envelope = { state: { w: number; h: number; d: number } };
export function installationCollisionSolids<T extends Envelope>(poses: readonly T[], context: readonly Envelope[] = poses) {
  return poses.flatMap<T | (ReturnType<typeof installationSolid> & { frontStock?: boolean; installationStock?: boolean })>(p => {
    const unit = p as unknown as InstallationPose;
    if (installationKind(unit.state)) return [p, { ...installationSolid(unit), installationStock: true }];
    if (!unit.state.secs || unit.state.product !== 'kitchen') return [p];
    const faces = cabinetBoards(unit.state, cornerCabinetWidths(unit, context as unknown as InstallationPose[]))
      .filter(b => b.z0 >= unit.state.d - 1e-7).map(b => ({ ...localSolid(unit, b), frontStock: true }));
    return [p, ...faces];
  });
}
/** Front extensions apply to installation contact, leaving normal carcass/fixture rules intact. */
export function installationPair(a: { state: { unit?: unknown }; frontStock?: boolean; installationStock?: boolean }, b: { state: { unit?: unknown }; frontStock?: boolean; installationStock?: boolean }) {
  return (!a.frontStock || b.installationStock || !!installationKind(b.state as InstallationPose['state']))
    && (!b.frontStock || a.installationStock || !!installationKind(a.state as InstallationPose['state']));
}
