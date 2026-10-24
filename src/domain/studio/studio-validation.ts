import { STUDIO_LIMITS as L, corner, wallLine } from './studio';
import type { Studio, StudioOpening, StudioWall } from './studio';
import { boundaryProblems } from './surface-boundary';
import { ceilingProblems } from './studio-ceiling';
import { WALL_FINISHES } from './studio-paint';
import { isWallUtility, openingLimits, openingNoun, openingsOverlap } from './wall-utilities';

/** Why a studio is not buildable, worded as what to do about it. Empty when it is fine. */
export function studioProblems(studio: Studio): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of [...studio.corners, ...studio.walls, ...studio.openings, ...studio.ceilings ?? []]) {
    if (ids.has(item.id)) problems.push(`Two parts share the id ${item.id}.`);
    ids.add(item.id);
  }
  for (const w of studio.walls) {
    problems.push(...boundaryProblems(studio, 'wall', w.id));
    if (w.color !== undefined && !/^#[0-9a-f]{6}$/i.test(w.color)) problems.push('Choose a valid wall paint color.');
    if (w.finish !== undefined && !WALL_FINISHES.some(f => f.id === w.finish)) problems.push('Choose a valid wall surface finish.');
    const line = wallLine(studio, w);
    if (!line) { problems.push('A wall is missing one of its corners.'); continue; }
    if (w.a === w.b) problems.push('A wall needs two different corners.');
    if (line.length < L.minWallLength - .01) problems.push(`Walls must be at least ${L.minWallLength} cm long.`);
    if (line.length > L.maxWallLength + .01) problems.push(`Walls can be at most ${L.maxWallLength / 100} m long.`);
    if (w.thickness < L.minThickness - .01 || w.thickness > L.maxThickness + .01) problems.push(`Wall thickness must be ${L.minThickness}–${L.maxThickness} cm.`);
    if (w.height < L.minHeight - .01 || w.height > L.maxHeight + .01) problems.push(`Wall height must be ${L.minHeight}–${L.maxHeight} cm.`);
  }
  problems.push(...crossingProblems(studio));
  for (const o of studio.openings) problems.push(...openingProblems(studio, o));
  for (const c of studio.ceilings ?? []) problems.push(...ceilingProblems(studio, c));
  return [...new Set(problems)];
}

/** Two walls may only touch at a shared corner. */
function crossingProblems(studio: Studio): string[] {
  const out: string[] = [];
  const walls = studio.walls;
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const p = walls[i]!, q = walls[j]!;
    const shared = [p.a, p.b].filter(c => c === q.a || c === q.b);
    if (shared.length > 1) { out.push('Two walls join the same corners. Remove one of them.'); continue; }
    const a = corner(studio, p.a), b = corner(studio, p.b), c = corner(studio, q.a), d = corner(studio, q.b);
    if (!a || !b || !c || !d) continue;
    if (segmentsCross(a, b, c, d, shared.length === 1)) out.push('Walls cannot cross each other. Move the corner back.');
  }
  return out;
}

type P = { x: number; z: number };
const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
const onSegment = (p: P, a: P, b: P) => Math.min(a.x, b.x) - 1e-6 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-6 && Math.min(a.z, b.z) - 1e-6 <= p.z && p.z <= Math.max(a.z, b.z) + 1e-6;

/** Whether segment ab meets segment cd anywhere other than a corner they share. Walls that share a
 * corner may still fold back onto each other; that counts as crossing. */
function segmentsCross(a: P, b: P, c: P, d: P, shareCorner: boolean) {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d), eps = 1e-6;
  if (shareCorner) {
    // Joined walls only conflict when they overlap along the same line.
    const collinear = Math.abs(d1) < eps && Math.abs(d2) < eps;
    if (!collinear) return false;
    const other = (p: P) => !(Math.abs(p.x - a.x) < eps && Math.abs(p.z - a.z) < eps) && !(Math.abs(p.x - b.x) < eps && Math.abs(p.z - b.z) < eps);
    return (other(c) && onSegment(c, a, b)) || (other(d) && onSegment(d, a, b)) || (other(a) && onSegment(a, c, d)) || (other(b) && onSegment(b, c, d));
  }
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
  return (Math.abs(d1) < eps && onSegment(a, c, d)) || (Math.abs(d2) < eps && onSegment(b, c, d)) || (Math.abs(d3) < eps && onSegment(c, a, b)) || (Math.abs(d4) < eps && onSegment(d, a, b));
}

/** How far along the wall an opening may sit, given the wall's length. */
export function openingRange(length: number, width: number, margin: number = L.openingMargin) {
  const half = width / 2 + margin;
  return { min: half, max: length - half };
}

function openingProblems(studio: Studio, o: StudioOpening): string[] {
  const w = studio.walls.find(x => x.id === o.wall) as StudioWall | undefined;
  const line = w && wallLine(studio, w);
  if (!w || !line) return ['An opening is on a wall that no longer exists.'];
  const out: string[] = [], name = openingNoun(o.kind), lim = openingLimits(o.kind);
  if (o.width < lim.minWidth - .01) out.push(`A ${name} must be at least ${lim.minWidth} cm wide.`);
  const range = openingRange(line.length, o.width, lim.endMargin);
  if (range.max < range.min - .01) out.push(`This ${name} is wider than its wall. Make it narrower or the wall longer.`);
  else if (o.offset < range.min - .01 || o.offset > range.max + .01) out.push(`The ${name} must stay on its wall, ${lim.endMargin} cm from each end.`);
  const minH = isWallUtility(o.kind) ? lim.minHeight : 30;
  if (o.sill < -.01 || o.height < minH - .01 || o.sill + o.height > w.height - lim.topMargin + .01) out.push(`The ${name} must fit below the top of its wall.`);
  for (const other of studio.openings) {
    if (other === o || other.wall !== o.wall || other.id > o.id) continue;
    const util = isWallUtility(o.kind) || isWallUtility(other.kind);
    const clash = util ? openingsOverlap(o, other, lim.gap - .01) : Math.abs(other.offset - o.offset) < (other.width + o.width) / 2 + L.openingMargin - .01;
    if (clash) out.push('Openings on one wall cannot overlap. Move one along the wall.');
  }
  return out;
}
