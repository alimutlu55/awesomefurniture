/**
 * A shape's profile: one simple polygon, counter-clockwise in (x, y) with y up, inside a rectangle of
 * bounds. Walls and ceilings are edited as such a profile seen face on (see surface-profile.ts).
 * Centimetres. Every edit returns a new list and leaves its input alone; null means it does not apply.
 *
 * Edges slide along their outward normal with their neighbours keeping their angles (a mitre), or, where
 * a neighbour is nearly in line, with a new riser so the neighbour stays put. Every limit is a linear
 * bound on the slide distance, so a slide stops exactly where the first rule would break.
 */
export const PROFILE = Object.freeze({
  /** Shortest edge, and the least room a step leaves. */
  minEdge: 5,
  /** Closest a corner may come to an edge it is not part of (no narrow necks). */
  minThickness: 5,
  minArea: 25,
  /** A neighbour closer than this to the slid edge's direction gets a riser instead of a mitre. */
  mitreMinSin: Math.sin(10 * Math.PI / 180),
  /** A corner this close to the line through its neighbours is dropped when a drag ends. */
  collinear: .05,
  /** Neighbouring corners this close merge when a drag ends. */
  merge: .1,
  stepDepth: 15,
  /** A drag moves in whole centimetres; typed values keep a millimetre. */
  dragGrid: 1, typedGrid: .1,
  /** A pinned corner (added by + Point) survives healing until it is moved this far off its edge. */
  pinRelease: .1,
});

export interface Vec { readonly x: number; readonly y: number }
export interface ProfileVertex extends Vec { readonly pinned?: boolean | undefined }
export interface ProfileBounds { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }
export type ProfileProblem = 'too-few-points' | 'out-of-bounds' | 'winding-or-area' | 'short-edge' | 'self-intersection' | 'neck-clearance';
export type BoundingFace = 'minX' | 'maxX' | 'minY' | 'maxY';

const EPS = 1e-7;
const sub = (a: Vec, b: Vec) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
const unit = (v: Vec) => { const len = Math.hypot(v.x, v.y); return { dir: len < EPS ? { x: 1, y: 0 } : { x: v.x / len, y: v.y / len }, len }; };
/** Outward normal of a counter-clockwise polygon's edge running along `u`. */
const outward = (u: Vec) => ({ x: u.y, y: -u.x });
const tidy = (v: number) => Math.round(v * 1e4) / 1e4;
const at = (p: ProfileVertex, x: number, y: number): ProfileVertex => p.pinned ? { x: tidy(x), y: tidy(y), pinned: true } : { x: tidy(x), y: tidy(y) };
const wrap = (i: number, n: number) => ((i % n) + n) % n;

export function signedArea(points: readonly Vec[]): number {
  let sum = 0;
  points.forEach((p, i) => { const q = points[(i + 1) % points.length]!; sum += p.x * q.y - q.x * p.y; });
  return sum / 2;
}
export function ensureCounterClockwise<T extends Vec>(points: readonly T[]): T[] {
  return signedArea(points) < 0 ? [...points].reverse() : [...points];
}
export function profileExtent(points: readonly Vec[]): ProfileBounds {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
export function edgeLength(points: readonly Vec[], i: number): number {
  return dist(points[wrap(i, points.length)]!, points[wrap(i + 1, points.length)]!);
}
export function pointToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a), len2 = dot(ab, ab);
  if (len2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t });
}
function segmentsTouch(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const e = 1e-6, o1 = cross(sub(b, a), sub(c, a)), o2 = cross(sub(b, a), sub(d, a)), o3 = cross(sub(d, c), sub(a, c)), o4 = cross(sub(d, c), sub(b, c));
  if (((o1 > e && o2 < -e) || (o1 < -e && o2 > e)) && ((o3 > e && o4 < -e) || (o3 < -e && o4 > e))) return true;
  return pointToSegment(c, a, b) < e || pointToSegment(d, a, b) < e || pointToSegment(a, c, d) < e || pointToSegment(b, c, d) < e;
}

/** Why a profile cannot be built, or null when it is fine. Checked on every frame of a drag. */
export function profileProblem(points: readonly ProfileVertex[], bounds: ProfileBounds): ProfileProblem | null {
  const n = points.length, e = 1e-3;
  if (n < 3 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return 'too-few-points';
  if (points.some(p => p.x < bounds.minX - e || p.x > bounds.maxX + e || p.y < bounds.minY - e || p.y > bounds.maxY + e)) return 'out-of-bounds';
  for (let i = 0; i < n; i++) if (edgeLength(points, i) < PROFILE.minEdge - e) return 'short-edge';
  for (let i = 0; i < n; i++) {
    const a = points[i]!, b = points[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsTouch(a, b, points[j]!, points[(j + 1) % n]!)) return 'self-intersection';
    }
    // The corner against every edge that neither starts nor ends next to it.
    for (let j = 0; j < n; j++) {
      if (j === i || wrap(j + 1, n) === i || wrap(i + 1, n) === j || wrap(j + 2, n) === i) continue;
      if (pointToSegment(a, points[j]!, points[(j + 1) % n]!) < PROFILE.minThickness - e) return 'neck-clearance';
    }
  }
  // Last, so crossed edges say so: a simple polygon with too little (or reversed) area.
  return signedArea(points) < PROFILE.minArea ? 'winding-or-area' : null;
}
export const validProfile = (points: readonly ProfileVertex[], bounds: ProfileBounds) => profileProblem(points, bounds) === null;

/** Restricts [min, max] to the d with a·d <= b. */
function clip(range: { min: number; max: number }, a: number, b: number) {
  if (Math.abs(a) < 1e-12) return b < -1e-9 ? { min: 1, max: -1 } : range;
  return a > 0 ? { min: range.min, max: Math.min(range.max, b / a) } : { min: Math.max(range.min, b / a), max: range.max };
}

export interface SlideResult { readonly points: ProfileVertex[]; readonly applied: number; readonly edge: number }
/** How far edge `edge` may slide along its outward normal: [min, max], or null when it cannot move. */
export function slideRange(points: readonly ProfileVertex[], edge: number, bounds: ProfileBounds) {
  const plan = slidePlan(points, edge);
  return plan && plan.range.min <= plan.range.max ? withBounds(plan, bounds) : null;
}
function slidePlan(points: readonly ProfileVertex[], edge: number) {
  const n = points.length;
  if (n < 3) return null;
  const i0 = wrap(edge - 1, n), i1 = wrap(edge, n), i2 = wrap(edge + 1, n), i3 = wrap(edge + 2, n);
  const p0 = points[i0]!, p1 = points[i1]!, p2 = points[i2]!, p3 = points[i3]!;
  const { dir: u, len } = unit(sub(p2, p1));
  if (len < EPS) return null;
  const normal = outward(u), prev = unit(sub(p1, p0)), next = unit(sub(p3, p2));
  const s1 = dot(prev.dir, normal), s2 = dot(next.dir, normal);
  const riser1 = Math.abs(s1) < PROFILE.mitreMinSin, riser2 = Math.abs(s2) < PROFILE.mitreMinSin;
  // Each end moves so that it advances exactly 1 along the normal per unit of slide.
  const m1 = riser1 ? normal : { x: prev.dir.x / s1, y: prev.dir.y / s1 }, m2 = riser2 ? normal : { x: next.dir.x / s2, y: next.dir.y / s2 };
  let range = { min: -Infinity, max: Infinity };
  if (!riser1) range = clip(range, -1 / s1, prev.len - PROFILE.minEdge);
  if (!riser2) range = clip(range, 1 / s2, next.len - PROFILE.minEdge);
  // m2 - m1 is parallel to the edge, so the slid edge's own length is linear in d too.
  range = clip(range, -dot(sub(m2, m1), u), len - PROFILE.minEdge);
  return { i1, i2, p1, p2, m1, m2, riser1, riser2, normal, range };
}
function withBounds(plan: NonNullable<ReturnType<typeof slidePlan>>, bounds: ProfileBounds) {
  let range = plan.range;
  for (const [p, m] of [[plan.p1, plan.m1], [plan.p2, plan.m2]] as const) {
    range = clip(range, -m.x, p.x - bounds.minX); range = clip(range, m.x, bounds.maxX - p.x);
    range = clip(range, -m.y, p.y - bounds.minY); range = clip(range, m.y, bounds.maxY - p.y);
  }
  return range.min <= range.max ? range : null;
}

/** Slides an edge along its outward normal by up to `wanted`, as far as every rule allows. Neighbours keep
 * their angles; a neighbour nearly in line keeps its place and a riser joins it, which is how a step is
 * pulled out of a straight edge. A riser shorter than the shortest edge snaps to none or to that length. */
export function slideEdge(points: readonly ProfileVertex[], edge: number, wanted: number, bounds: ProfileBounds): SlideResult {
  const none = { points: [...points], applied: 0, edge: wrap(edge, points.length) };
  const plan = slidePlan(points, edge), range = plan && withBounds(plan, bounds);
  if (!plan || !range || !Number.isFinite(wanted)) return none;
  let d = Math.max(range.min, Math.min(range.max, wanted));
  if ((plan.riser1 || plan.riser2) && Math.abs(d) < PROFILE.minEdge) {
    const snapped = Math.abs(d) < PROFILE.minEdge / 2 ? 0 : Math.sign(d) * PROFILE.minEdge;
    d = snapped >= range.min - EPS && snapped <= range.max + EPS ? snapped : 0;
  }
  if (Math.abs(d) < EPS) return none;
  const q1 = at(plan.p1, plan.p1.x + plan.m1.x * d, plan.p1.y + plan.m1.y * d), q2 = at(plan.p2, plan.p2.x + plan.m2.x * d, plan.p2.y + plan.m2.y * d);
  const out: ProfileVertex[] = [];
  let active = 0;
  points.forEach((p, i) => {
    if (i === plan.i1) {
      if (plan.riser1) out.push({ x: plan.p1.x, y: plan.p1.y });
      active = out.length; out.push(q1);
    } else if (i === plan.i2) {
      out.push(q2);
      if (plan.riser2) out.push({ x: plan.p2.x, y: plan.p2.y });
    } else out.push(p);
  });
  // A riser before the list's first corner sits at the end of the list; find the slid edge again.
  active = out.indexOf(q1);
  return profileProblem(out, bounds) ? none : { points: out, applied: d, edge: active };
}

function rayToSegment(origin: Vec, dir: Vec, a: Vec, b: Vec): number | null {
  const ab = sub(b, a), det = cross(dir, ab);
  if (Math.abs(det) < EPS) return null;
  const ao = sub(a, origin), t = cross(ao, ab) / det, s = cross(ao, dir) / det;
  return t > EPS && s >= -EPS && s <= 1 + EPS ? t : null;
}
function lineMeet(p: Vec, u: Vec, q: Vec, v: Vec): Vec | null {
  const det = cross(u, v);
  if (Math.abs(det) < EPS) return null;
  const t = cross(sub(q, p), v) / det;
  return { x: p.x + u.x * t, y: p.y + u.y * t };
}

/** Splits an edge into a step at `fraction` along it (the middle by default): the second part moves in by up to
 * 15 cm, or out when there is no room inside. The riser is upright or level, whichever is nearer square to the
 * edge, as in a building: a sloped underside steps down, it is not notched. Returns the moved part's edge. */
export function stepEdge(points: readonly ProfileVertex[], edge: number, bounds: ProfileBounds, fraction = .5): SlideResult | null {
  const n = points.length, i = wrap(edge, n), p1 = points[i]!, p2 = points[wrap(i + 1, n)]!, p3 = points[wrap(i + 2, n)]!;
  const { dir: u, len } = unit(sub(p2, p1));
  if (len < 2 * PROFILE.minEdge) return null;
  const f = Math.max(PROFILE.minEdge / len, Math.min(1 - PROFILE.minEdge / len, fraction));
  const mid = { x: p1.x + (p2.x - p1.x) * f, y: p1.y + (p2.y - p1.y) * f }, normal0 = outward(u);
  const out = Math.abs(normal0.y) >= Math.abs(normal0.x) ? { x: 0, y: Math.sign(normal0.y) } : { x: Math.sign(normal0.x), y: 0 }, inward = { x: -out.x, y: -out.y };
  let inside = Infinity;
  points.forEach((a, k) => { if (k !== i) { const hit = rayToSegment(mid, inward, a, points[(k + 1) % n]!); if (hit !== null) inside = Math.min(inside, hit); } });
  const room = (dir: Vec) => Math.min(...[[dir.x, mid.x - bounds.minX, bounds.maxX - mid.x], [dir.y, mid.y - bounds.minY, bounds.maxY - mid.y]]
    .map(([c, low, high]) => c! > EPS ? high! / c! : c! < -EPS ? low! / -c! : Infinity));
  let normal = inward, depth = Math.min(PROFILE.stepDepth, inside - PROFILE.minEdge, .35 * inside);
  if (!(depth >= PROFILE.minEdge)) { normal = out; depth = Math.min(PROFILE.stepDepth, room(out)); }
  if (!(depth >= PROFILE.minEdge)) return null;
  const m1: ProfileVertex = { x: tidy(mid.x), y: tidy(mid.y) }, m2: ProfileVertex = { x: tidy(mid.x + normal.x * depth), y: tidy(mid.y + normal.y * depth) };
  const next = unit(sub(p3, p2)), meet = Math.abs(dot(next.dir, normal)) >= PROFILE.mitreMinSin ? lineMeet(m2, u, p2, next.dir) : null;
  const fits = meet && dist(meet, p3) >= PROFILE.minEdge && meet.x >= bounds.minX && meet.x <= bounds.maxX && meet.y >= bounds.minY && meet.y <= bounds.maxY
    && dot(sub(meet, p2), next.dir) < next.len;
  const shifted: ProfileVertex[] = fits ? [at(p2, meet.x, meet.y)] : [{ x: tidy(p2.x + normal.x * depth), y: tidy(p2.y + normal.y * depth) }, p2];
  const result: ProfileVertex[] = [];
  points.forEach((p, k) => {
    if (k === i) result.push(p, m1, m2);
    else if (k === wrap(i + 1, n)) result.push(...shifted);
    else result.push(p);
  });
  return profileProblem(result, bounds) ? null : { points: result, applied: depth, edge: result.indexOf(m2) };
}

/** Adds a corner on an edge (in the middle by default), pinned so healing keeps it until it is moved. */
export function addPoint(points: readonly ProfileVertex[], edge: number, fraction = .5): { points: ProfileVertex[]; index: number } | null {
  const n = points.length, i = wrap(edge, n), a = points[i]!, b = points[wrap(i + 1, n)]!, len = dist(a, b);
  if (len < 2 * PROFILE.minEdge) return null;
  const f = Math.max(PROFILE.minEdge / len, Math.min(1 - PROFILE.minEdge / len, fraction));
  const p: ProfileVertex = { x: tidy(a.x + (b.x - a.x) * f), y: tidy(a.y + (b.y - a.y) * f), pinned: true };
  return { points: [...points.slice(0, i + 1), p, ...points.slice(i + 1)], index: i + 1 };
}

/** Removes a corner, joining its neighbours with a straight edge. */
export function removePoint(points: readonly ProfileVertex[], index: number, bounds: ProfileBounds): ProfileVertex[] | null {
  if (points.length <= 3) return null;
  const out = points.filter((_, k) => k !== wrap(index, points.length));
  return profileProblem(out, bounds) ? null : out;
}

/** Moves one corner. Null when the shape would break a rule there. */
export function movePoint(points: readonly ProfileVertex[], index: number, to: Vec, bounds: ProfileBounds): ProfileVertex[] | null {
  const i = wrap(index, points.length), p = points[i];
  if (!p || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return null;
  const out = points.map((q, k) => k === i ? at(q, to.x, to.y) : q);
  return profileProblem(out, bounds) ? null : out;
}

/** When a drag ends: corners moved off their edge lose their pin, corners that met merge (`merged` names one
 * snapped onto its neighbour), and unpinned corners in a straight line go. */
export function healProfile(points: readonly ProfileVertex[], merged?: number): ProfileVertex[] {
  let list: ProfileVertex[] = points.map((p, i) => {
    if (!p.pinned) return p;
    const prev = points[wrap(i - 1, points.length)]!, next = points[wrap(i + 1, points.length)]!, chord = dist(prev, next);
    return chord > PROFILE.merge && Math.abs(cross(sub(p, prev), sub(next, prev))) / chord > PROFILE.pinRelease ? { x: p.x, y: p.y } : p;
  });
  if (merged !== undefined && list.length > 3) {
    const i = wrap(merged, list.length);
    const close = [wrap(i - 1, list.length), wrap(i + 1, list.length)].find(k => dist(list[k]!, list[i]!) < PROFILE.minEdge);
    if (close !== undefined) list = list.filter((_, k) => k !== i);
  }
  for (let changed = true; changed && list.length > 3;) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      if (dist(list[i]!, list[(i + 1) % list.length]!) <= PROFILE.merge) { list.splice((i + 1) % list.length, 1); changed = true; break; }
    }
  }
  for (let changed = true; changed && list.length > 3;) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!, prev = list[wrap(i - 1, list.length)]!, next = list[(i + 1) % list.length]!, chord = dist(prev, next);
      if (p.pinned || chord <= PROFILE.merge || dot(sub(p, prev), sub(next, p)) <= 0) continue;
      if (Math.abs(cross(sub(p, prev), sub(next, prev))) / chord <= PROFILE.collinear) { list.splice(i, 1); changed = true; break; }
    }
  }
  return list;
}

/** Makes an edge `length` long by sliding the edge after it (or, if that one runs nearly the same way, the
 * edge before it), so every angle stays as it was. */
export function setEdgeLength(points: readonly ProfileVertex[], edge: number, length: number, bounds: ProfileBounds): ProfileVertex[] | null {
  const n = points.length, i = wrap(edge, n), change = length - edgeLength(points, i);
  if (!Number.isFinite(length) || length < PROFILE.minEdge) return null;
  if (Math.abs(change) < 1e-6) return [...points];
  const u = unit(sub(points[wrap(i + 1, n)]!, points[i]!)).dir;
  for (const [other, sign] of [[i + 1, 1], [i - 1, -1]] as const) {
    const a = points[wrap(other, n)]!, b = points[wrap(other + 1, n)]!, s = dot(u, outward(unit(sub(b, a)).dir)) * sign;
    if (Math.abs(s) < PROFILE.mitreMinSin) continue;
    const d = change * s, slid = slideEdge(points, other, d, bounds);
    if (Math.abs(slid.applied - d) < 1e-6) return slid.points;
  }
  return null;
}

/** Turns an edge to `degrees` from level, about its first corner; its second corner slides along the next edge,
 * so that edge keeps its direction. */
export function setEdgeAngle(points: readonly ProfileVertex[], edge: number, degrees: number, bounds: ProfileBounds): ProfileVertex[] | null {
  const n = points.length, i = wrap(edge, n), a = points[i]!, b = points[wrap(i + 1, n)]!, c = points[wrap(i + 2, n)]!;
  if (!Number.isFinite(degrees) || degrees <= .5 || degrees >= 89.5) return null;
  const r = degrees * Math.PI / 180, dir = { x: Math.cos(r) * (Math.sign(b.x - a.x) || 1), y: Math.sin(r) * (Math.sign(b.y - a.y) || 1) };
  const meet = lineMeet(a, dir, c, unit(sub(b, c)).dir);
  if (!meet || dot(sub(meet, a), dir) <= 0) return null;
  const out = points.map((p, k) => k === wrap(i + 1, n) ? at(p, meet.x, meet.y) : p);
  return profileProblem(out, bounds) ? null : out;
}
export const edgeAngle = (points: readonly Vec[], edge: number) => {
  const a = points[wrap(edge, points.length)]!, b = points[wrap(edge + 1, points.length)]!;
  return Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
};

/** Moves one side of the shape to `value`. A flat side slides with its neighbours keeping their angles; a
 * pointed end (a gable's peak) stretches the shape in that direction instead. */
export function setExtent(points: readonly ProfileVertex[], face: BoundingFace, value: number, bounds: ProfileBounds): ProfileVertex[] | null {
  const box = profileExtent(points), horizontal = face === 'minX' || face === 'maxX', current = box[face];
  const outwards = face === 'maxX' || face === 'maxY' ? value - current : current - value;
  if (!Number.isFinite(value)) return null;
  if (Math.abs(outwards) < 1e-6) return [...points];
  const coord = (p: Vec) => horizontal ? p.x : p.y, on = (p: Vec) => Math.abs(coord(p) - current) <= .05;
  const edges = points.map((p, i) => on(p) && on(points[(i + 1) % points.length]!) ? i : -1).filter(i => i >= 0);
  let out: ProfileVertex[] | null;
  if (edges.length === 1) {
    const slid = slideEdge(points, edges[0]!, outwards, bounds);
    out = Math.abs(slid.applied - outwards) < 1e-6 ? slid.points : null;
  } else if (edges.length > 1) {
    out = points.map(p => on(p) ? at(p, horizontal ? value : p.x, horizontal ? p.y : value) : p);
  } else {
    const anchor = face === 'minX' ? box.maxX : face === 'maxX' ? box.minX : face === 'minY' ? box.maxY : box.minY, span = Math.abs(current - anchor);
    const scale = Math.abs(value - anchor) / span;
    out = span < PROFILE.minEdge || Math.sign(value - anchor) !== Math.sign(current - anchor) ? null
      : points.map(p => at(p, horizontal ? anchor + (p.x - anchor) * scale : p.x, horizontal ? p.y : anchor + (p.y - anchor) * scale));
  }
  return out && !profileProblem(out, bounds) ? out : null;
}

/** Moves the whole shape, as far as its bounds allow. */
export function translateProfile(points: readonly ProfileVertex[], dx: number, dy: number, bounds: ProfileBounds): ProfileVertex[] {
  const box = profileExtent(points);
  const x = Math.max(bounds.minX - box.minX, Math.min(bounds.maxX - box.maxX, dx)), y = Math.max(bounds.minY - box.minY, Math.min(bounds.maxY - box.maxY, dy));
  return points.map(p => at(p, p.x + x, p.y + y));
}

/** Mirrors the shape left to right inside its own extent, still counter-clockwise. */
export function flipProfile(points: readonly ProfileVertex[]): ProfileVertex[] {
  const box = profileExtent(points);
  return points.map(p => at(p, box.minX + box.maxX - p.x, p.y)).reverse();
}

/** The corner a list index refers to after healing, matched by position. */
export function findPoint(points: readonly Vec[], p: Vec): number {
  let best = -1, bestDistance = Infinity;
  points.forEach((q, i) => { const d = dist(p, q); if (d < bestDistance) { best = i; bestDistance = d; } });
  return bestDistance < PROFILE.minEdge ? best : -1;
}
