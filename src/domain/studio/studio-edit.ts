/**
 * Studio edits. Each takes a studio and returns the edited copy, or null when the edit does not apply.
 * They do not validate: the caller checks studioProblems() and refuses an invalid result with its
 * reason. Any change to walls or openings makes the studio 'custom'. Centimetres.
 */
import { STUDIO_DEFAULTS, STUDIO_LIMITS as L, corner, cornerDegree, nextId, wall, wallLine } from './studio';
import type { OpeningKind, Studio, StudioCorner, StudioOpening, StudioWall } from './studio';
import { openingRange } from './studio-validation';

const custom = (studio: Studio, changes: Partial<Studio>): Studio => ({ ...studio, ...changes, template: 'custom' });
const round = (n: number) => Math.round(n * 10) / 10;
const moved = (corners: readonly StudioCorner[], id: string, x: number, z: number) => corners.map(c => c.id === id ? { ...c, x: round(x), z: round(z) } : c);

/** Moves a corner. Every wall that meets there stretches with it. */
export function moveCorner(studio: Studio, id: string, x: number, z: number): Studio | null {
  if (!corner(studio, id)) return null;
  return custom(studio, { corners: moved(studio.corners, id, x, z) });
}

/** Moves a wall towards its room side (positive) or away (negative), keeping its direction. The walls
 * joined to its corners stretch to follow. */
export function moveWall(studio: Studio, id: string, distance: number): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  let corners = studio.corners;
  for (const c of [line.a, line.b]) corners = moved(corners, c.id, c.x + line.nx * distance, c.z + line.nz * distance);
  return custom(studio, { corners });
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

export function setWallSize(studio: Studio, id: string, size: Partial<Pick<StudioWall, 'thickness' | 'height'>>): Studio | null {
  if (!wall(studio, id)) return null;
  return custom(studio, { walls: studio.walls.map(w => w.id === id ? { ...w, ...size } : w) });
}

/** Splits a wall in two at a point along it (`at` from corner a; the middle by default), so either
 * part can be moved on its own. Openings go with the part they are on. */
export function splitWall(studio: Studio, id: string, at?: number): Studio | null {
  const w = wall(studio, id), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const d = at ?? line.length / 2;
  if (d < L.minWallLength - .01 || line.length - d < L.minWallLength - .01) return null;
  const mid: StudioCorner = { id: nextId('c', studio.corners), x: round(line.a.x + line.ux * d), z: round(line.a.z + line.uz * d) };
  const second: StudioWall = { ...w, id: nextId('w', studio.walls), a: mid.id, b: w.b };
  const walls = studio.walls.flatMap(x => x.id === id ? [{ ...x, b: mid.id }, second] : [x]);
  const openings = studio.openings.map(o => o.wall !== id || o.offset < d ? o : { ...o, wall: second.id, offset: round(o.offset - d) });
  return custom(studio, { corners: [...studio.corners, mid], walls, openings });
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

/** Removes a wall with its openings, and any corner it leaves unattached. */
export function removeWall(studio: Studio, id: string): Studio | null {
  if (!wall(studio, id)) return null;
  const walls = studio.walls.filter(w => w.id !== id);
  const next = { ...studio, walls };
  return custom(studio, { walls, corners: studio.corners.filter(c => cornerDegree(next, c.id) > 0), openings: studio.openings.filter(o => o.wall !== id) });
}

/** Adds a door, window or archway to a wall: in the middle if it is free, else in the widest gap.
 * Null when the wall has no room for it. */
export function addOpening(studio: Studio, wallId: string, kind: OpeningKind): Studio | null {
  const w = wall(studio, wallId), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const size = STUDIO_DEFAULTS[kind], range = openingRange(line.length, size.width);
  if (range.max < range.min || size.sill + size.height > w.height - 2) return null;
  const taken = studio.openings.filter(o => o.wall === wallId).map(o => [o.offset - o.width / 2 - L.openingMargin, o.offset + o.width / 2 + L.openingMargin] as const).sort((p, q) => p[0] - q[0]);
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
  const range = openingRange(line.length, o.width);
  return custom(studio, { openings: studio.openings.map(x => x.id === id ? { ...x, offset: round(Math.min(range.max, Math.max(range.min, offset))) } : x) });
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
