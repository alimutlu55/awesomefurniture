import { kitchenUnit } from '../kitchen/kitchen-units';
import { besidePanel, isKitchenUnit, runOf, stackedPose, type Pose } from '../kitchen/kitchen-runs';
import type { CabinetData } from './cabinet-piece';
import type { Room } from './piece-model';

export function placeNearKitchenRun<T extends CabinetData>(room: Room, cabinet: T, anchor: CabinetData, fits: (candidate: T) => boolean): T | null {
  const cabinets = room.cabinets ?? [];
  const y = kitchenUnit(cabinet.state.unit).elevation, spots: Pose[] = [];
  const besideRun = (unit: CabinetData) => {
    const run = runOf(cabinets, unit);
    return [besidePanel(run[run.length - 1]!, cabinet, 1, y), besidePanel(run[0]!, cabinet, -1, y)];
  };
  if (Math.abs((anchor.y || 0) - y) > .5) {
    for (const other of [anchor, ...runOf(cabinets, anchor)]) spots.push(stackedPose(other, cabinet.state.d, y));
    const units = cabinets.filter(c => isKitchenUnit(c) && (y < .5 ? Math.abs(c.y || 0) < .5 : (c.y || 0) >= .5));
    for (const unit of units.reverse()) spots.push(...besideRun(unit));
  } else spots.push(...besideRun(anchor));
  for (const pose of spots) {
    const candidate = { ...cabinet, ...pose };
    if (fits(candidate)) return candidate;
  }
  return null;
}
