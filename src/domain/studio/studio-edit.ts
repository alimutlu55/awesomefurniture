/**
 * Studio edits. Each takes a studio and returns the edited copy, or null when the edit does not apply.
 * They do not validate: the caller checks studioProblems() and refuses an invalid result with its
 * reason. Any change to walls or openings makes the studio 'custom'. Centimetres.
 */
import { STUDIO_DEFAULTS, STUDIO_LIMITS as L, corner, cornerDegree, nextId, wall, wallFace, wallLine } from './studio';
import type { OpeningKind, Studio, StudioCorner, StudioOpening, StudioWall } from './studio';
import { openingRange } from './studio-validation';
import { keepCeilings, splitCeilings } from './studio-ceiling';
import { isWallUtility, openingLimits } from './wall-utilities';
import { stretchWallBoundaries } from './studio-boundary';
import { clipBoundary } from '../geometry/boundary';

const custom = (studio: Studio, changes: Partial<Studio>): Studio => {
  if (changes.corners && !changes.walls && studio.walls.some(w => w.outline)) changes = { ...changes, walls: stretchWallBoundaries(studio, changes.corners) };
  const next: Studio = { ...studio, ...changes, template: 'custom' };
  // Ceilings stay where they are in the room when corners move; a room without any keeps no list.
  if (changes.corners && !('ceilings' in changes) && studio.ceilings) return { ...next, ceilings: keepCeilings(studio, changes.corners) };
  return next;
};
const round = (n: number) => Math.round(n * 10) / 10;
const moved = (corners: readonly StudioCorner[], id: string, x: number, z: number) => corners.map(c => c.id === id ? { ...c, x: round(x), z: round(z) } : c);

/** After corners move, doors and windows stay where they were in the room (sliding only as far as
 * needed to stay on a wall that got shorter), instead of moving with the wall's start corner. */
function keepOpenings(before: Studio, corners: readonly StudioCorner[]): StudioOpening[] {
  const after = { ...before, corners };
  return before.openings.map(o => {
    const w = wall(before, o.wall), old = w && wallLine(before, w), now = w && wallLine(after, w);
    if (!old || !now) return o;
    const x = old.a.x + old.ux * o.offset, z = old.a.z + old.uz * o.offset;
    const range = openingRange(now.length, o.width, openingLimits(o.kind).endMargin), along = (x - now.a.x) * now.ux + (z - now.a.z) * now.uz;
    return { ...o, offset: round(range.max < range.min ? along : Math.min(range.max, Math.max(range.min, along))) };
  });
}

/** Moves a corner. Every wall that meets there stretches with it; openings keep their place. */
export function moveCorner(studio: Studio, id: string, x: number, z: number): Studio | null {
  if (!corner(studio, id)) return null;
  const corners = moved(studio.corners, id, x, z);
  return custom(studio, { corners, openings: keepOpenings(studio, corners) });
}

/** Moves a wall towards its room side (positive) or away (negative), keeping its direction. The walls
 * joined to its corners stretch to follow. */
export function moveWall(studio: Studio, id: string, distance: number): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  let corners = studio.corners;
  for (const c of [line.a, line.b]) corners = moved(corners, c.id, c.x + line.nx * distance, c.z + line.nz * distance);
  return custom(studio, { corners, openings: keepOpenings(studio, corners) });
}

/** Sets a wall's length by moving its `b` end along the wall (or its `a` end when `fromEnd`). */
export function setWallLength(studio: Studio, id: string, length: number, fromEnd = false): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  if (fromEnd) {
    const openings = studio.openings.map(o => o.wall === id ? { ...o, offset: round(o.offset + length - line.length) } : o);
    return custom(studio, { corners: moved(studio.corners, line.a.id, line.b.x - line.ux * length, line.b.z - line.uz * length), openings });
  }
  return custom(studio, { corners: moved(studio.corners, line.b.id, line.a.x + line.ux * length, line.a.z + line.uz * length) });
}

/** Sets the length a person measures inside the room (the wall's room face) at its `b` end (or its `a`
 * end when `fromEnd`). Where another wall meets that end, that wall moves, keeping its direction, so a
 * room grows square instead of skewing; a free end just extends. */
export function setInsideLength(studio: Studio, id: string, length: number, fromEnd = false): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
  if (!w || !line || !face) return null;
  const delta = length - face.length, end = fromEnd ? w.a : w.b;
  const next = studio.walls.find(o => o !== w && (o.a === end || o.b === end)), nl = next && wallLine(studio, next);
  // Moving the next wall by d along its room side moves this face's end by d / (u · n) along this wall.
  const dot = nl ? line.ux * nl.nx + line.uz * nl.nz : 0;
  if (!next || Math.abs(dot) < .2) return setWallLength(studio, id, line.length + delta, fromEnd);
  return moveWall(studio, next.id, (fromEnd ? -delta : delta) * dot);
}

export function setWallSize(studio: Studio, id: string, size: Partial<Pick<StudioWall, 'thickness' | 'height'>>): Studio | null {
  if (!wall(studio, id)) return null;
  return custom(studio, { walls: studio.walls.map(w => w.id === id ? { ...w, ...size,
    ...(w.outline && size.height ? { outline: w.outline.map(p => ({ ...p, y: p.y * size.height! / w.height })) } : {}) } : w) });
}

/** Splits a wall in two at a point along it (`at` from corner a; the middle by default), so either
 * part can be moved on its own. Openings go with the part they are on. */
export function splitWall(studio: Studio, id: string, at?: number): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const d = at ?? line.length / 2;
  if (d < L.minWallLength - .01 || line.length - d < L.minWallLength - .01) return null;
  const mid: StudioCorner = { id: nextId('c', studio.corners), x: round(line.a.x + line.ux * d), z: round(line.a.z + line.uz * d) };
  const second: StudioWall = { ...w, id: nextId('w', studio.walls), a: mid.id, b: w.b,
    ...(w.outline ? { outline: clipBoundary(w.outline, d, Infinity).map(p => ({ ...p, t: p.t - d })) } : {}) };
  const first: StudioWall = { ...w, b: mid.id, ...(w.outline ? { outline: clipBoundary(w.outline, -Infinity, d) } : {}) };
  const walls = studio.walls.flatMap(x => x.id === id ? [first, second] : [x]);
  const openings = studio.openings.map(o => o.wall !== id || o.offset < d ? o : { ...o, wall: second.id, offset: round(o.offset - d) });
  return custom(studio, { corners: [...studio.corners, mid], walls, openings, ...(studio.ceilings ? { ceilings: splitCeilings(studio, id, second.id, d) } : {}) });
}

/** Adds a wall from a corner to a new point, continuing the chain the corner belongs to so the room
 * stays on the same side. */
export function extendFromCorner(studio: Studio, id: string, x: number, z: number): Studio | null {
  const from = corner(studio, id), joined = studio.walls.find(w => w.a === id || w.b === id);
  if (!from) return null;
  const end: StudioCorner = { id: nextId('c', studio.corners), x: round(x), z: round(z) };
  const template = joined ?? { thickness: STUDIO_DEFAULTS.thickness, height: STUDIO_DEFAULTS.height };
  const forward = !joined || joined.b === id;
  const added: StudioWall = { id: nextId('w', studio.walls), a: forward ? id : end.id, b: forward ? end.id : id, thickness: template.thickness, height: template.height };
  return custom(studio, { corners: [...studio.corners, end], walls: [...studio.walls, added] });
}

/** Adds a free-standing wall from (x0, z0) to (x1, z1); its room side faces left of that direction. */
export function addWall(studio: Studio, x0: number, z0: number, x1: number, z1: number): Studio {
  const a: StudioCorner = { id: nextId('c', studio.corners), x: round(x0), z: round(z0) };
  const b: StudioCorner = { id: nextId('c', [...studio.corners, a]), x: round(x1), z: round(z1) };
  const w: StudioWall = { id: nextId('w', studio.walls), a: a.id, b: b.id, thickness: STUDIO_DEFAULTS.thickness, height: STUDIO_DEFAULTS.height };
  return custom(studio, { corners: [...studio.corners, a, b], walls: [...studio.walls, w] });
}

/** A new project's room: one free-standing wall, centred on x = 0 at the back, with nothing on it yet. */
export function singleWallStudio(length = 300): Studio {
  return addWall({ template: 'custom', corners: [], walls: [], openings: [] }, -length / 2, 0, length / 2, 0);
}

/** Joins two corners into one, so walls that ended at `from` now end at `into`: dropping a free wall end
 * on another closes the room there. Walls left with both ends on one corner are removed. */
export function mergeCorners(studio: Studio, from: string, into: string): Studio | null {
  if (from === into || !corner(studio, from) || !corner(studio, into)) return null;
  const walls = studio.walls.map(w => ({ ...w, a: w.a === from ? into : w.a, b: w.b === from ? into : w.b })).filter(w => w.a !== w.b);
  const kept = new Set(walls.map(w => w.id));
  const ceilings = studio.ceilings?.filter(c => kept.has(c.wall));
  return custom(studio, { corners: studio.corners.filter(c => c.id !== from), walls, openings: studio.openings.filter(o => kept.has(o.wall)), ...(ceilings ? { ceilings } : {}) });
}

/** Rooms people add walls to: where one more wall goes. From a free wall end it turns a right angle
 * into the room (or runs straight on when that is blocked), so a wall becomes a corner and a corner a
 * U. In a closed room it is a free-standing wall across the middle of the longest wall. Each try is
 * checked with `fits`; null when none fits. `prefer` is a wall to start from (the selected one). */
export function suggestWall(studio: Studio, fits: (next: Studio) => boolean, prefer?: string, length = 150): { studio: Studio; wall: string } | null {
  const free = studio.corners.filter(c => cornerDegree(studio, c.id) === 1);
  const owner = (c: StudioCorner) => studio.walls.find(w => w.a === c.id || w.b === c.id)!;
  free.sort((p, q) => Number(owner(q).id === prefer) - Number(owner(p).id === prefer));
  for (const c of free) {
    const w = owner(c), line = wallLine(studio, w);
    if (!line) continue;
    // Outward along the wall from this end, and the room side of the wall.
    const out = w.b === c.id ? { x: line.ux, z: line.uz } : { x: -line.ux, z: -line.uz };
    for (const d of [{ x: line.nx, z: line.nz }, out]) {
      const next = extendFromCorner(studio, c.id, c.x + d.x * length, c.z + d.z * length);
      if (next && fits(next)) return { studio: next, wall: next.walls.at(-1)!.id };
    }
  }
  // A closed room: free-standing, parallel to a wall (longest first), a little way into the room.
  const lines = studio.walls.map(w => wallLine(studio, w)).filter(x => x !== null).sort((p, q) => q.length - p.length);
  for (const line of lines) {
    const half = Math.min(length, line.length - 2 * L.minWallLength) / 2, mid = { x: (line.a.x + line.b.x) / 2, z: (line.a.z + line.b.z) / 2 };
    if (half * 2 < L.minWallLength) continue;
    for (const depth of [120, 90, 160, 60, 200]) {
      const cx = mid.x + line.nx * depth, cz = mid.z + line.nz * depth;
      const next = addWall(studio, cx - line.ux * half, cz - line.uz * half, cx + line.ux * half, cz + line.uz * half);
      if (fits(next)) return { studio: next, wall: next.walls.at(-1)!.id };
    }
  }
  return null;
}

/** Removes a wall with its openings, and any corner it leaves unattached. */
export function removeWall(studio: Studio, id: string): Studio | null {
  if (!wall(studio, id)) return null;
  const walls = studio.walls.filter(w => w.id !== id);
  const next = { ...studio, walls };
  const ceilings = studio.ceilings?.filter(c => c.wall !== id);
  return custom(studio, { walls, corners: studio.corners.filter(c => cornerDegree(next, c.id) > 0), openings: studio.openings.filter(o => o.wall !== id), ...(ceilings ? { ceilings } : {}) });
}

/** Adds a door, window, archway or wall utility to a wall: in the middle if it is free, else in the widest gap.
 * Null when the wall has no room for it. */
export function addOpening(studio: Studio, wallId: string, kind: OpeningKind): Studio | null {
  const w = wall(studio, wallId), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const raw = STUDIO_DEFAULTS[kind], lim = openingLimits(kind);
  const sill = isWallUtility(kind) ? Math.max(0, Math.min(raw.sill, w.height - raw.height - lim.topMargin)) : raw.sill;
  const size = { width: raw.width, height: raw.height, sill }, range = openingRange(line.length, size.width, lim.endMargin);
  if (range.max < range.min || size.sill + size.height > w.height - lim.topMargin) return null;
  const margin = isWallUtility(kind) ? lim.gap : L.openingMargin;
  const taken = studio.openings
    .filter(o => o.wall === wallId && (!isWallUtility(kind) && !isWallUtility(o.kind) || Math.min(o.sill + o.height, size.sill + size.height) - Math.max(o.sill, size.sill) > -margin))
    .map(o => [o.offset - o.width / 2 - margin, o.offset + o.width / 2 + margin] as const)
    .sort((p, q) => p[0] - q[0]);
  const free = (c: number) => taken.every(([s, e]) => c + size.width / 2 <= s + .01 || c - size.width / 2 >= e - .01);
  const candidates = [line.length / 2, ...taken.flatMap(([s, e]) => [s - size.width / 2, e + size.width / 2])]
    .filter(c => c >= range.min - .01 && c <= range.max + .01 && free(c))
    .sort((p, q) => Math.abs(p - line.length / 2) - Math.abs(q - line.length / 2));
  if (!candidates.length) return null;
  const opening: StudioOpening = { id: nextId('o', studio.openings), wall: wallId, kind, offset: round(candidates[0]!), ...size };
  return custom(studio, { openings: [...studio.openings, opening] });
}

/** Moves an opening along its wall, kept on the wall. */
export function moveOpening(studio: Studio, id: string, offset: number): Studio | null {
  const o = studio.openings.find(x => x.id === id), w = o && wall(studio, o.wall), line = w && wallLine(studio, w);
  if (!o || !line) return null;
  const range = openingRange(line.length, o.width, openingLimits(o.kind).endMargin);
  return custom(studio, { openings: studio.openings.map(x => x.id === id ? { ...x, offset: round(Math.min(range.max, Math.max(range.min, offset))) } : x) });
}

/** Moves an opening or wall utility in 2D on its wall plane (both `offset` along the wall and `sill` above the floor). */
export function moveOpening2D(studio: Studio, id: string, offset: number, sill?: number): Studio | null {
  const o = studio.openings.find(x => x.id === id), w = o && wall(studio, o.wall), line = w && wallLine(studio, w);
  if (!o || !w || !line) return null;
  const lim = openingLimits(o.kind), range = openingRange(line.length, o.width, lim.endMargin);
  const nextOffset = round(Math.min(range.max, Math.max(range.min, offset)));
  const canMoveY = sill !== undefined && (o.kind === 'window' || isWallUtility(o.kind));
  const maxSill = Math.max(0, w.height - o.height - lim.topMargin);
  const nextSill = canMoveY ? round(Math.min(maxSill, Math.max(0, sill))) : o.sill;
  return custom(studio, { openings: studio.openings.map(x => x.id === id ? { ...x, offset: nextOffset, sill: nextSill } : x) });
}

export function setOpeningSize(studio: Studio, id: string, size: Partial<Pick<StudioOpening, 'width' | 'height' | 'sill'>>): Studio | null {
  if (!studio.openings.some(o => o.id === id)) return null;
  return custom(studio, { openings: studio.openings.map(o => o.id === id ? { ...o, ...size } : o) });
}

export function removeOpening(studio: Studio, id: string): Studio | null {
  if (!studio.openings.some(o => o.id === id)) return null;
  return custom(studio, { openings: studio.openings.filter(o => o.id !== id) });
}

/** Moves the whole room. Placing a built-in studio uses this; it stays a built-in. */
export function translateStudio(studio: Studio, dx: number, dz: number): Studio {
  return { ...studio, corners: studio.corners.map(c => ({ ...c, x: round(c.x + dx), z: round(c.z + dz) })) };
}

/** Confirms (or clears) a room door's handing without changing its position or size. */
export function setDoorOperation(studio: Studio, id: string, change: Pick<StudioOpening, 'hinge' | 'swing'>): Studio | null {
  if (!studio.openings.some(o => o.id === id && o.kind === 'door')) return null;
  return custom(studio, { openings: studio.openings.map(o => o.id === id ? { ...o, ...change } : o) });
}
