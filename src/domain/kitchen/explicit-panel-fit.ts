import type { PanelPose } from './end-panels';
import { installationKind, isFixture } from './kitchen-units';
import { unitAxes } from './kitchen-runs';
import { flatPanel, samePanelBack } from './shared-panels';

function overlapsExpanded(panel: PanelPose, cx: number, cz: number, bottom: number, top: number, depth: number, item: PanelPose) {
  const iy0 = item.y ?? 0, iy1 = iy0 + item.state.h;
  if (Math.min(top, iy1) - Math.max(bottom, iy0) <= 1e-5) return false;
  const pa = unitAxes(panel.angle), ia = unitAxes(item.angle);
  for (const axis of [pa.u, pa.v, ia.u, ia.v]) {
    const rp = (Math.abs(pa.u.x * axis.x + pa.u.z * axis.z) * panel.state.w + Math.abs(pa.v.x * axis.x + pa.v.z * axis.z) * depth) / 2;
    const ri = (Math.abs(ia.u.x * axis.x + ia.u.z * axis.z) * item.state.w + Math.abs(ia.v.x * axis.x + ia.v.z * axis.z) * item.state.d) / 2;
    if (Math.abs((item.x - cx) * axis.x + (item.z - cz) * axis.z) >= rp + ri - 1e-5) return false;
  }
  return true;
}

/** An explicitly added separator stays an actual scene item. Adjacent flat cabinet sides extend that
 * same board to the complete connected assembly, rather than adding an overlapping automatic board. */
export function expandedEndPanels<T extends PanelPose>(input: readonly T[]): T[] {
  const boxes = input.map(p => installationKind(p.state) === 'end-panel' ? structuredClone(p) : p);
  for (const panel of boxes.filter(p => installationKind(p.state) === 'end-panel' && flatPanel(p))) {
    for (let pass = 0; pass < boxes.length; pass++) {
      let changed = false;
      for (const other of boxes) {
        if (installationKind(other.state) || isFixture(other.state) || !flatPanel(other) || !samePanelBack(panel, other)) continue;
        const { u, v } = unitAxes(panel.angle), along = (other.x - panel.x) * u.x + (other.z - panel.z) * u.z;
        if (Math.abs(Math.abs(along) - (other.state.w + panel.state.w) / 2) > 1e-5
          || Math.max(panel.y ?? 0, other.y ?? 0) > Math.min((panel.y ?? 0) + panel.state.h, (other.y ?? 0) + other.state.h) + 1e-5) continue;
        const bottom = Math.min(panel.y ?? 0, other.y ?? 0), top = Math.max((panel.y ?? 0) + panel.state.h, (other.y ?? 0) + other.state.h);
        const depth = Math.max(panel.state.d, other.state.d), delta = (depth - panel.state.d) / 2;
        if (Math.abs(bottom - (panel.y ?? 0)) < 1e-8 && Math.abs(top - bottom - panel.state.h) < 1e-8 && delta < 1e-8) continue;
        const cx = panel.x + v.x * delta, cz = panel.z + v.z * delta;
        if (boxes.some(item => item.id !== panel.id && !isFixture(item.state) && overlapsExpanded(panel, cx, cz, bottom, top, depth, item))) continue;
        panel.y = bottom; panel.x = cx; panel.z = cz;
        panel.state = { ...panel.state, h: top - bottom, d: depth, shape: undefined }; changed = true;
      }
      if (!changed) break;
    }
  }
  return boxes;
}
