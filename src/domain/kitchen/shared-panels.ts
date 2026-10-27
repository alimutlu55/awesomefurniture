import type { PanelPose } from './end-panels';
import { unitAxes } from './kitchen-runs';

const EPS = 1e-7;
/** Only identical upright stock on the same back line can be one separator. */
export function matchingPanelLine(a: PanelPose, b: PanelPose) {
  const { u, v } = unitAxes(a.angle);
  return Math.abs(a.angle - b.angle) % 360 < EPS && Math.abs((a.y ?? 0) - (b.y ?? 0)) < EPS
    && Math.abs(a.state.h - b.state.h) < EPS && Math.abs(a.state.d - b.state.d) < EPS
    && Math.abs((b.x - a.x) * v.x + (b.z - a.z) * v.z) < EPS
    && JSON.stringify(a.state.shape) === JSON.stringify(b.state.shape)
    && Number.isFinite((b.x - a.x) * u.x + (b.z - a.z) * u.z);
}

/** Two facing end boards share one board, never two intersecting or a doubled 36 mm blank.
 * Small deliberate gaps remain gaps; the layout planner closes an exact double-board joint separately. */
export function sharedEndPanels<T extends PanelPose & { ownerId: number | string; side: number }>(panels: T[]) {
  const out: T[] = [];
  for (const p of panels) {
    const shared = out.find(q => q.ownerId !== p.ownerId && q.side !== p.side && matchingPanelLine(p, q)
      && Math.abs(p.state.w - q.state.w) < EPS
      && Math.abs((p.x - q.x) * unitAxes(p.angle).u.x + (p.z - q.z) * unitAxes(p.angle).u.z) <= p.state.w + EPS
      && JSON.stringify((p.state as { materials?: unknown }).materials) === JSON.stringify((q.state as { materials?: unknown }).materials)
      && (p.state as { fin?: string }).fin === (q.state as { fin?: string }).fin);
    if (!shared) out.push(p);
  }
  return out;
}
