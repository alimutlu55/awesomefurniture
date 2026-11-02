import { profileExtent, profileProblem, type ProfileVertex } from '../../domain/geometry/profile-polygon';
import type { SurfaceProfile } from '../../domain/studio/surface-profile';

/** Fit the outer corners to the room, keeping custom corners and steps in between. */
export function autoAlignWallProfile(s: SurfaceProfile): ProfileVertex[] | null {
  const box = profileExtent(s.points), near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const topAt = (x: number) => Math.max(...s.points.filter(p => near(p.x, x)).map(p => p.y));
  const heightAt = (x: number, current: number) => {
    // At a shared joint, use the adjoining wall's actual roof rather than its overall height.
    const heights = s.view === 'front' ? (s.adjoining ?? []).flatMap(w => {
      const joint = w.points.filter(p => near(p.x, x));
      return joint.length ? [Math.max(...joint.map(p => p.y))] : [];
    }) : [];
    return heights.length ? heights.reduce((a, b) => Math.abs(a - current) <= Math.abs(b - current) ? a : b) : s.context.top;
  };
  const leftTop = topAt(box.minX), rightTop = topAt(box.maxX);
  const leftHeight = heightAt(s.context.from, leftTop), rightHeight = heightAt(s.context.to, rightTop);
  const points = s.points.map(p => {
    const left = near(p.x, box.minX), right = near(p.x, box.maxX);
    return { ...p, x: left ? s.context.from : right ? s.context.to : p.x,
      y: near(p.y, box.minY) ? s.bounds.minY
        : left && near(p.y, leftTop) ? leftHeight : right && near(p.y, rightTop) ? rightHeight : p.y };
  });
  if (profileProblem(points, s.bounds) || points.every((p, i) => near(p.x, s.points[i]!.x) && near(p.y, s.points[i]!.y))) return null;
  return points;
}
