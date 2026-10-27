import type { PanelPose } from './end-panels';
import { installationKind, isFixture } from './kitchen-units';
import { unitAxes } from './kitchen-runs';
import { flatPanel, samePanelBack } from './shared-panels';

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
        panel.y = bottom; panel.x += v.x * delta; panel.z += v.z * delta;
        panel.state = { ...panel.state, h: top - bottom, d: depth, shape: undefined }; changed = true;
      }
      if (!changed) break;
    }
  }
  return boxes;
}
