import type { ProfileSolid, SolidPoint } from './profile-solid';

export interface SurfacePoint extends SolidPoint { readonly u: number }
export type SolidTriangle = readonly [SurfacePoint, SurfacePoint, SurfacePoint];
export const surfacePoint = (p: SolidPoint, u: number): SurfacePoint => ({ t: p.t + (p.s ?? 0), y: p.y, u: u + (p.d ?? 0) });
const surfaces = new WeakMap<ProfileSolid, readonly SolidTriangle[]>();

/** The renderer and physical clearance use the same diagonal for each divided surface. */
export function solidSideTriangles(shape: ProfileSolid): readonly SolidTriangle[] {
  const cached = surfaces.get(shape); if (cached) return cached;
  const triangles: SolidTriangle[] = [];
  for (let r = 1; r < shape.rings.length; r++) {
    const a = shape.rings[r - 1]!, b = shape.rings[r]!;
    for (const loop of shape.loops) for (let k = 0; k < loop.length; k++) {
      const i = loop[k]!, j = loop[(k + 1) % loop.length]!;
      const p = surfacePoint(a.points[i]!, a.u), q = surfacePoint(a.points[j]!, a.u);
      const s = surfacePoint(b.points[i]!, b.u), t = surfacePoint(b.points[j]!, b.u);
      triangles.push([p, q, t], [p, t, s]);
    }
  }
  surfaces.set(shape, triangles); return triangles;
}
