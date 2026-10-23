import { controlPoint, mixPoint, ringAt, SOLID_EPS } from './profile-solid';
import type { ProfileSolid, SolidLocation } from './profile-solid';

/** A cut across the extrusion bends its horizontal outline. Its upper and lower
 * intersections form one control, so pulling inward never lifts or twists one edge. */
export function divideHorizontalSolid(shape: ProfileSolid, at: SolidLocation): ProfileSolid | null {
  const loop = shape.loops[at.loop], point = loop?.[at.edge];
  if (!at.through || point === undefined || !Number.isFinite(at.u) || at.u < 0 || at.u > 1) return null;
  let rings = shape.rings.map(r => ({ u: r.u, points: [...r.points] }));
  const loops = shape.loops.map(l => [...l]), t = ringAt(shape, at.u)[point]!.t;
  const peers = loop!.filter(i => Math.abs(ringAt(shape, at.u)[i]!.t - t) < SOLID_EPS);
  // Insert hidden matching intersections where the opposite edge has no vertex yet.
  for (let k = loop!.length - 1; k >= 0; k--) {
    const a = loop![k]!, b = loop![(k + 1) % loop!.length]!;
    const ps = ringAt(shape, at.u), pa = ps[a]!, pb = ps[b]!;
    if ((pa.t - t) * (pb.t - t) >= -SOLID_EPS) continue;
    const index = rings[0]!.points.length, fraction = (t - pa.t) / (pb.t - pa.t);
    rings = rings.map(r => ({ ...r, points: [...r.points, mixPoint(r.points[a]!, r.points[b]!, fraction)] }));
    loops[at.loop]!.splice(k + 1, 0, index); peers.push(index);
  }
  if (peers.length < 2) return null;
  if (!rings.some(r => Math.abs(r.u - at.u) < SOLID_EPS)) {
    rings.push({ u: at.u, points: [...ringAt({ ...shape, loops, rings }, at.u)] }); rings.sort((a, b) => a.u - b.u);
  }
  const existing = shape.controls.find(c => c.point === point && Math.abs(c.u - at.u) < SOLID_EPS);
  const id = existing?.id ?? 'cut' + (1 + Math.max(0, ...shape.controls.map(c => Number(c.id.replace(/^cut/, '')) || 0)));
  const control = { id, point, u: at.u, scope: 'profile' as const, plane: 'horizontal' as const, peers };
  return { loops, rings, controls: existing ? shape.controls.map(c => c === existing ? control : c) : [...shape.controls, control] };
}

/** s is along the profile, d across the extrusion. Heights remain exactly unchanged. */
export function moveHorizontalSolid(shape: ProfileSolid, id: string, s: number, d: number): ProfileSolid | null {
  const control = shape.controls.find(c => c.id === id);
  if (control?.plane !== 'horizontal' || !control.peers || !Number.isFinite(s) || !Number.isFinite(d)) return null;
  const p = controlPoint(shape, control), ds = s - (p.s ?? 0), dd = d - (p.d ?? 0);
  return { ...shape, rings: shape.rings.map(r => Math.abs(r.u - control.u) > SOLID_EPS ? r : {
    ...r, points: r.points.map((p, k) => control.peers!.includes(k) ? { ...p, s: (p.s ?? 0) + ds, d: (p.d ?? 0) + dd } : p),
  }) };
}
