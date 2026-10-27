import type { PanelPose } from './end-panels';
import { unitAxes } from './kitchen-runs';

const EPS = 1e-5;
const along = (a: PanelPose, b: PanelPose) => {
  const { u } = unitAxes(a.angle); return (b.x - a.x) * u.x + (b.z - a.z) * u.z;
};
export function samePanelBack(a: PanelPose, b: PanelPose) {
  const { v } = unitAxes(a.angle);
  return Math.abs(Math.sin((a.angle - b.angle) * Math.PI / 180)) < EPS && Math.cos((a.angle - b.angle) * Math.PI / 180) > 0
    && Math.abs((b.x - a.x) * v.x + (b.z - a.z) * v.z - (b.state.d - a.state.d) / 2) < EPS;
}
export const flatPanel = (p: PanelPose) => !p.state.shape || p.state.shape.top.every(q => Math.abs(q.y - p.state.h) < EPS)
  && (!p.state.shape.back || p.state.shape.back.every(y => Math.abs(y - p.state.h) < EPS));
const decor = (p: PanelPose) => (p.state as { materials?: { carcassDecorId?: string }; fin?: string }).materials?.carcassDecorId
  ?? (p.state as { fin?: string }).fin;
export const compatiblePanelStock = (a: PanelPose, b: PanelPose) => Math.abs(a.state.w - b.state.w) < EPS && decor(a) === decor(b);
/** Manual panes on the same side profile can be joined without changing their physical construction. */
export function matchingPanelLine(a: PanelPose, b: PanelPose) {
  return samePanelBack(a, b) && Math.abs((a.y ?? 0) - (b.y ?? 0)) < EPS && Math.abs(a.state.h - b.state.h) < EPS
    && Math.abs(a.state.d - b.state.d) < EPS && JSON.stringify(a.state.shape) === JSON.stringify(b.state.shape);
}
type End = PanelPose & { ownerId: number | string; side: number };
/** One continuous shared upright covers the complete assembly side, including stacked and shallower units.
 * The dominant cabinet supplies the shared stock/finish; each cabinet keeps its own finish settings.
 * The thicker configured stock governs a shared joint; stepped/sloped profiles remain separate. */
export function sharedEndPanels<T extends End>(panels: T[]) {
  const groups: T[][] = [];
  const joins = (a: T, b: T) => a.ownerId !== b.ownerId && samePanelBack(a, b)
    && flatPanel(a) && flatPanel(b) && Math.max(a.y ?? 0, b.y ?? 0) <= Math.min((a.y ?? 0) + a.state.h, (b.y ?? 0) + b.state.h) + EPS
    && (a.side === b.side ? Math.abs(along(a, b) - a.side * (b.state.w - a.state.w) / 2) < EPS
      : Math.abs(along(a, b)) <= (a.state.w + b.state.w) / 2 + EPS);
  for (const p of panels) {
    const touching = groups.filter(group => group.some(q => joins(p, q))), merged = [p, ...touching.flat()];
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups.map(group => {
    // A floor/tall board is the stable datum for the stacked side; input ordering never chooses the plane.
    const configured = (p: T) => Number(p.state.endPanelThickness !== undefined);
    const ranked = [...group].sort((a, b) => configured(b) - configured(a) || b.state.w - a.state.w
      || Number((a.y ?? 0) > .5) - Number((b.y ?? 0) > .5)
      || b.state.h * b.state.d - a.state.h * a.state.d || Number(a.ownerId) - Number(b.ownerId));
    const first = ranked[0]!, y = Math.min(...group.map(p => p.y ?? 0)), h = Math.max(...group.map(p => (p.y ?? 0) + p.state.h)) - y;
    const depth = Math.max(...group.map(p => p.state.d)), { u, v } = unitAxes(first.angle), delta = (depth - first.state.d) / 2;
    const outer = group.every(p => p.side === first.side) ? first.side * Math.max(...group.map(p => first.side * along(first, p))) : 0;
    return { ...first, x: first.x + v.x * delta + u.x * outer, z: first.z + v.z * delta + u.z * outer, y,
      state: { ...first.state, h, d: depth, ...(group.length > 1 ? { shape: undefined } : {}) },
      owners: group.map(p => ({ id: p.ownerId, side: p.side })), sources: group };
  });
}
