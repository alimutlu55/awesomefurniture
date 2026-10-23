import { solidSideTriangles } from './solid-surfaces';

/** A solid made from matching planar contours along its extrusion. Controls are explicit:
 * adding topology never creates extra visible handles. A control edits the whole (t,y)
 * profile across the extrusion; u only anchors its visible handle in 3D. */
export interface SolidPoint { readonly t: number; readonly y: number }
export interface SolidRing { readonly u: number; readonly points: readonly SolidPoint[] }
export interface SolidControl { readonly id: string; readonly point: number; readonly u: number; readonly scope: 'profile' | 'section' }
export interface ProfileSolid {
  readonly loops: readonly (readonly number[])[];
  readonly rings: readonly SolidRing[];
  readonly controls: readonly SolidControl[];
}
export interface SolidLocation { readonly loop: number; readonly edge: number; readonly u: number; readonly fraction: number; readonly through?: boolean }
export const SOLID_EPS = 1e-7;
export const mixPoint = (a: SolidPoint, b: SolidPoint, f: number): SolidPoint => ({ t: a.t + (b.t - a.t) * f, y: a.y + (b.y - a.y) * f });
export const distance2 = (a: SolidPoint, b: SolidPoint) => Math.hypot(a.t - b.t, a.y - b.y);

export function ringAt(shape: ProfileSolid, u: number): readonly SolidPoint[] {
  const i = shape.rings.findIndex(r => r.u >= u - SOLID_EPS);
  if (i <= 0) return shape.rings[0]!.points;
  const a = shape.rings[i - 1]!, b = shape.rings[i]!;
  return a.points.map((p, k) => mixPoint(p, b.points[k]!, (u - a.u) / (b.u - a.u)));
}
export function controlPoint(shape: ProfileSolid, control: SolidControl): SolidPoint {
  return ringAt(shape, control.u)[control.point]!;
}
export function locationPoint(shape: ProfileSolid, location: SolidLocation): SolidPoint {
  const loop = shape.loops[location.loop]!, points = ringAt(shape, location.u);
  const a = points[loop[location.edge]!]!, b = points[loop[(location.edge + 1) % loop.length]!]!;
  return location.through ? a : mixPoint(a, b, location.fraction);
}

/** Insertion preserves the surface. Only the requested control is exposed. */
export function divideSolid(shape: ProfileSolid, at: SolidLocation): ProfileSolid | null {
  const loop = shape.loops[at.loop], a = loop?.[at.edge], b = loop?.[(at.edge + 1) % loop.length];
  if (a === undefined || b === undefined || !Number.isFinite(at.u) || !Number.isFinite(at.fraction)
    || at.u < 0 || at.u > 1 || at.fraction < 0 || at.fraction > 1) return null;
  let rings = shape.rings.map(r => ({ u: r.u, points: [...r.points] })), loops = shape.loops.map(l => [...l]);
  let point = a;
  if (at.fraction > SOLID_EPS && at.fraction < 1 - SOLID_EPS && !at.through) {
    point = rings[0]!.points.length;
    rings = rings.map(r => ({ ...r, points: [...r.points, mixPoint(r.points[a]!, r.points[b]!, at.fraction)] }));
    loops[at.loop]!.splice(at.edge + 1, 0, point);
  } else if (!at.through && at.fraction >= 1 - SOLID_EPS) point = b;
  const targetPoint = ringAt({ ...shape, rings, loops }, at.u)[point]!;
  const existing = shape.controls.find(c => c.point === point || distance2(controlPoint(shape, c), targetPoint) < SOLID_EPS);
  if (existing) {
    // Reuse the same logical corner, including at the rear. Never leave a second dot behind.
    return { ...shape, rings, loops, controls: shape.controls.map(c => c === existing ? { ...c, u: at.u, scope: 'profile' } : c) };
  }
  const id = 'cut' + (1 + Math.max(0, ...shape.controls.map(c => Number(c.id.replace(/^cut/, '')) || 0)));
  return { loops, rings, controls: [...shape.controls, { id, point, u: at.u, scope: 'profile' }] };
}

export function moveSolidControl(shape: ProfileSolid, id: string, t: number, y: number): ProfileSolid | null {
  const control = shape.controls.find(c => c.id === id);
  if (!control || !Number.isFinite(t) || !Number.isFinite(y)) return null;
  // Legacy section controls remain readable, but always reshape both faces together.
  // Absolute coordinates also realign a corner previously pulled out of its profile.
  const next = { ...shape, rings: shape.rings.map(r => ({
    ...r, points: r.points.map((p, k) => k === control.point ? { t, y } : p),
  })) };
  if (shape.loops.some(loop => shape.rings.some((ring, r) => loopArea(loop.map(i => ring.points[i]!))
    * loopArea(loop.map(i => next.rings[r]!.points[i]!)) <= SOLID_EPS))) return null;
  return next;
}
export function mapSolid(shape: ProfileSolid, transform: (p: SolidPoint, index: number) => SolidPoint): ProfileSolid {
  return { ...shape, rings: shape.rings.map(r => ({ ...r, points: r.points.map(transform) })) };
}

const cross = (a: SolidPoint, b: SolidPoint, c: SolidPoint) => (b.t - a.t) * (c.y - a.y) - (b.y - a.y) * (c.t - a.t);
export const loopArea = (ps: readonly SolidPoint[]) => ps.reduce((sum, a, i) => {
  const b = ps[(i + 1) % ps.length]!; return sum + a.t * b.y - b.t * a.y;
}, 0) / 2;
function intersect(a: SolidPoint, b: SolidPoint, c: SolidPoint, d: SolidPoint) {
  const on = (a: SolidPoint, b: SolidPoint, p: SolidPoint) => Math.abs(cross(a, b, p)) < SOLID_EPS
    && p.t >= Math.min(a.t, b.t) - SOLID_EPS && p.t <= Math.max(a.t, b.t) + SOLID_EPS
    && p.y >= Math.min(a.y, b.y) - SOLID_EPS && p.y <= Math.max(a.y, b.y) + SOLID_EPS;
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
    || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
/** The same validation protects mouse previews, touch, exact entry and saved documents. */
export function solidProblems(shape: ProfileSolid, limits: { minT: number; maxT: number; minY: number; maxY: number }): string[] {
  const count = shape.rings[0]?.points.length ?? 0;
  if (shape.rings.length < 2 || count < 3 || !shape.loops.length) return ['A shape needs a closed boundary.'];
  if (Math.abs(shape.rings[0]!.u) > SOLID_EPS || Math.abs(shape.rings.at(-1)!.u - 1) > SOLID_EPS
    || shape.rings.some((r, i) => !Number.isFinite(r.u) || i > 0 && r.u - shape.rings[i - 1]!.u < SOLID_EPS || r.points.length !== count))
    return ['Shape divisions must stay in order.'];
  const indices = shape.loops.flat();
  if (indices.length !== count || new Set(indices).size !== count || shape.loops.some(l => l.length < 3)
    || indices.some(i => !Number.isInteger(i) || i < 0 || i >= count)) return ['A shape boundary has an invalid point.'];
  for (const r of shape.rings) for (const p of r.points) {
    if (!Number.isFinite(p.t) || !Number.isFinite(p.y) || p.t < limits.minT - SOLID_EPS || p.t > limits.maxT + SOLID_EPS
      || p.y < limits.minY - SOLID_EPS || p.y > limits.maxY + SOLID_EPS) return ['Keep the shape within its wall and the room height.'];
  }
  const samples = [...shape.rings.map(r => r.points), ...shape.rings.slice(1).map((r, i) => ringAt(shape, (r.u + shape.rings[i]!.u) / 2))];
  for (const points of samples) {
    const loops = shape.loops.map(l => l.map(i => points[i]!));
    const contours: SolidPoint[][] = [];
    for (const raw of loops) {
      // A sloped underside can meet its fixed roof. Keep the roof anchor hidden so lowering
      // that existing profile control retains the original vertical end face.
      for (let i = 0; i < raw.length; i++) if (distance2(raw[i]!, raw[(i + 1) % raw.length]!) < SOLID_EPS
        && Math.abs(raw[i]!.y - limits.maxY) > SOLID_EPS) return ['Two shape points cannot overlap.'];
      const ps = raw.filter((p, i) => distance2(p, raw[(i + raw.length - 1) % raw.length]!) >= SOLID_EPS);
      contours.push(ps);
      if (Math.abs(loopArea(ps)) < SOLID_EPS) return ['Keep a nonzero area inside the shape.'];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i]!, b = ps[(i + 1) % ps.length]!;
        if (distance2(a, b) < SOLID_EPS) return ['Two shape points cannot overlap.'];
        for (let j = i + 2; j < ps.length; j++) {
          if ((j + 1) % ps.length === i) continue;
          if (intersect(a, b, ps[j]!, ps[(j + 1) % ps.length]!)) return ['Shape edges cannot cross.'];
        }
      }
    }
    const inside = (p: SolidPoint, ps: readonly SolidPoint[]) => ps.reduce((hit, a, i) => {
      const b = ps[(i + 1) % ps.length]!;
      return (a.y > p.y) !== (b.y > p.y) && p.t < (b.t - a.t) * (p.y - a.y) / (b.y - a.y) + a.t ? !hit : hit;
    }, false);
    for (let i = 1; i < contours.length; i++) {
      if (!inside(contours[i]![0]!, contours[0]!)) return ['Keep openings inside the wall.'];
      for (let j = 0; j < i; j++) {
        const a = contours[i]!, b = contours[j]!;
        if (a.some((p, k) => b.some((q, n) => intersect(p, a[(k + 1) % a.length]!, q, b[(n + 1) % b.length]!))))
          return ['Shape boundaries cannot overlap.'];
        if (j > 0 && (inside(a[0]!, b) || inside(b[0]!, a))) return ['Shape openings cannot overlap.'];
      }
    }
  }
  if (new Set(shape.controls.map(c => c.id)).size !== shape.controls.length || shape.controls.some(c =>
    !Number.isInteger(c.point) || c.point < 0 || c.point >= count || !Number.isFinite(c.u) || c.u < 0 || c.u > 1
    || c.scope === 'section' && !shape.rings.some(r => Math.abs(r.u - c.u) < SOLID_EPS))) return ['A shape control has no matching point.'];
  return [];
}

/** Lowest physical boundary at this point in a slice; null means it is outside. */
export function solidHeightAt(shape: ProfileSolid, t: number, u: number): number | null {
  if (u < -SOLID_EPS || u > 1 + SOLID_EPS) return null;
  let lowest: number | null = null;
  for (const [a, b, c] of solidSideTriangles(shape)) {
    const det = (b.t - a.t) * (c.u - a.u) - (c.t - a.t) * (b.u - a.u);
    if (Math.abs(det) < SOLID_EPS) continue;
    const s = ((t - a.t) * (c.u - a.u) - (c.t - a.t) * (u - a.u)) / det;
    const r = ((b.t - a.t) * (u - a.u) - (t - a.t) * (b.u - a.u)) / det;
    if (s < -SOLID_EPS || r < -SOLID_EPS || s + r > 1 + SOLID_EPS) continue;
    const y = a.y + s * (b.y - a.y) + r * (c.y - a.y);
    lowest = lowest === null ? y : Math.min(lowest, y);
  }
  return lowest;
}
