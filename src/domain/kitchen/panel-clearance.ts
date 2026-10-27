import { endPanelThickness, type PanelPose } from './end-panels';
import { installationKind } from './kitchen-units';

/** Installed stock remaining at the final shared joint. Explicit panes are already ray-test targets. */
export function sidePanelClearance(box: PanelPose, other: PanelPose | undefined, side: -1 | 1) {
  if (other && (installationKind(other.state) || Math.abs(Math.sin((other.angle - box.angle) * Math.PI / 180)) > 1e-7
    || Math.cos((other.angle - box.angle) * Math.PI / 180) < 0)) return 0;
  return Math.max(box.state.endPanelSides?.includes(side) ? endPanelThickness(box.state) : 0,
    other?.state.endPanelSides?.includes(side === 1 ? -1 : 1) ? endPanelThickness(other.state) : 0);
}
