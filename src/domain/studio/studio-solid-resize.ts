import { mapSolid } from '../geometry/profile-solid';
import { roomHeight, wallExtent, wallLine } from './studio';
import type { Studio } from './studio';

/** Existing wall size/corner tools scale an edited contour with the same wall, without adding controls. */
export function resizeStudioSolids(before: Studio, after: Studio): Studio {
  const walls = after.walls.map(w => {
    if (!w.shape) return w;
    const old = before.walls.find(p => p.id === w.id), a = old && wallLine(before, old), b = wallLine(after, w);
    if (!old || !a || !b || old.shape !== w.shape) return w;
    const from = wallExtent(before, old, a.length), to = wallExtent(after, w, b.length);
    if (from.start === to.start && from.end === to.end && old.height === w.height) return w;
    const span = from.end - from.start;
    return { ...w, shape: mapSolid(w.shape, p => ({
      t: to.start + (p.t - from.start) * (to.end - to.start) / span, y: p.y * w.height / old.height,
    })) };
  });
  const oldTop = roomHeight(before), newTop = roomHeight(after);
  const ceilings = oldTop === newTop ? after.ceilings : after.ceilings?.map(c => !c.shape ? c : {
    ...c, shape: mapSolid(c.shape, p => Math.abs(p.y - oldTop) < 1e-7 ? { ...p, y: newTop } : p),
  });
  return { ...after, walls, ...(ceilings ? { ceilings } : {}) };
}
