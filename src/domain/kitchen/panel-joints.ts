import { automaticInstallationParts } from './automatic-installation';
import { samePanelBack } from './shared-panels';
import { isFixture, installationKind } from './kitchen-units';
import { unitAxes } from './kitchen-runs';
import type { InstallationPose } from './installation-layout';

const EPS = 1e-6;
/** Align bodies only to actual stock they would intersect, or close an exact doubled-board joint.
 * A deliberate 1 mm clearance beside a single shared board remains a real clearance. */
export function resolvePanelJoints<T extends InstallationPose>(boxes: T[], move: (owner: T, delta: number, blocked: Set<number | string>) => void) {
  for (const p of automaticInstallationParts(boxes)) {
    if (!('sources' in p)) continue;
    const { u } = unitAxes(p.angle), pane = p.x * u.x + p.z * u.z;
    for (const source of p.sources) {
      const owner = boxes.find(b => b.id === source.ownerId)!;
      const edge = owner.x * u.x + owner.z * u.z + source.side * owner.state.w / 2;
      const desired = pane - source.side * p.state.w / 2, delta = desired - edge;
      const originalPlane = source.x * u.x + source.z * u.z;
      const double = Math.abs(Math.abs(originalPlane - pane) - (source.state.w + p.state.w) / 2) < EPS;
      if (Math.abs(delta) <= 1e-8 || !(delta * source.side < -1e-8 || double)) continue;
      const blocked = new Set(p.sources.filter(s => s.ownerId !== owner.id).map(s => s.ownerId));
      move(owner, delta, blocked); return true;
    }
    const owners = new Set(p.sources.map(s => s.ownerId));
    for (const other of boxes) {
      if (owners.has(other.id) || installationKind(other.state) || isFixture(other.state) || !samePanelBack(p, other)
        || Math.min((p.y ?? 0) + p.state.h, (other.y ?? 0) + other.state.h) <= Math.max(p.y ?? 0, other.y ?? 0) + 1e-8) continue;
      const centre = other.x * u.x + other.z * u.z, side = centre >= pane ? 1 : -1, edge = centre - side * other.state.w / 2;
      const projected = side * (edge - pane), delta = pane + side * p.state.w / 2 - edge;
      if (projected >= -p.state.w / 2 - EPS && projected < p.state.w / 2 - 1e-8) { move(other, delta, owners); return true; }
    }
  }
  return false;
}
