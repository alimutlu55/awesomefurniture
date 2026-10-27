import { expandedEndPanels } from './explicit-panel-fit';
import { sharedEndPanels } from './shared-panels';
import { automaticEndPanels, endPanelDesign, type PanelPose } from './end-panels';
import { cornerReturnSides, cornerStripWidth } from './corner-widths';
import { besidePose, unitAxes } from './kitchen-runs';
import { installationKind } from './kitchen-units';

/** The return-side strip is additive: unlike the blind unit's allocated strip, it must never reduce
 * a cargo module's nominal width. Explicitly placed strips/panes suppress derived duplicates. */
export function automaticInstallationParts<S extends PanelPose['state']>(boxes: readonly PanelPose<S>[]) {
  boxes = expandedEndPanels(boxes);
  const strips = boxes.flatMap(box => cornerReturnSides(box, boxes).flatMap(side => {
    if (Number(box.id) < 0 || !Number.isFinite(Number(box.id))) return [];
    const { u, v } = unitAxes(box.angle);
    const existing = boxes.some(p => {
      if (!installationKind(p.state) || p.id === box.id) return false;
      const along = (p.x - box.x) * u.x + (p.z - box.z) * u.z;
      const sameAngle = Math.abs(Math.sin((p.angle - box.angle) * Math.PI / 180)) < 1e-7;
      return sameAngle && Math.abs((p.x - box.x) * v.x + (p.z - box.z) * v.z - (p.state.d - box.state.d) / 2) < 1e-7
        && Math.abs(along - side * (box.state.w + p.state.w) / 2) < 1e-7
        && Math.abs((p.y ?? 0) - (box.y ?? 0)) < 1e-7;
    });
    if (existing) return [];
    const width = cornerStripWidth(box.state), state = { ...endPanelDesign(box.state, side, width), unit: 'filler' as const };
    return [{ id: -Number(box.id) * 4 - (side > 0 ? 3 : 2), ownerId: box.id, side, name: 'Corner installation strip',
      ...besidePose(box, width, state.d, side), state }];
  }));
  return [...sharedEndPanels(automaticEndPanels(boxes)), ...strips];
}
