/**
 * Studio: the room the wardrobes stand in. Plain data in scene centimetres: the same x/z floor
 * coordinates as a wardrobe's position (a wardrobe's x/z is its centre; at angle 0 its back is at -z
 * and its front faces +z).
 *
 * A room is corners joined by walls. A wall runs from corner `a` to corner `b`; its room side is the
 * side a wardrobe placed against it faces. Walls run so the room is in front of them: a wall from
 * left to right (-x to +x) has the room at +z. Moving a corner stretches every wall that meets there,
 * so a closed room stays closed while it is edited.
 *
 * Openings (doors, windows, archways) sit on a wall, measured along it from corner `a`.
 * Ceilings that come down into the room (under a staircase, a landing, a sloped roof, a beam or boxing)
 * run along a wall too: see studio-ceiling.ts.
 */
import type { StudioTemplateId } from './studio-templates';
import type { OpeningKind } from './wall-utilities';
export type { OpeningKind, WallUtilityKind, StructuralOpeningKind } from './wall-utilities';

export interface StudioCorner { readonly id: string; readonly x: number; readonly z: number }
export type WallFinish = 'matte' | 'eggshell' | 'satin';

export interface StudioWall {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** Centred on the line from a to b. */
  readonly thickness: number;
  readonly height: number;
  /** Optional for compatibility with rooms saved before wall paint controls. */
  readonly color?: string | undefined;
  readonly finish?: WallFinish | undefined;
}

export interface StudioOpening {
  readonly id: string;
  readonly wall: string;
  readonly kind: OpeningKind;
  /** Distance from the wall's corner `a` to the opening's centre. */
  readonly offset: number;
  readonly width: number;
  readonly height: number;
  /** Height of the opening's bottom above the floor: 0 for doors and archways. */
  readonly sill: number;
}

/** A point of a ceiling's underside: `y` cm above the floor at `t`, measured along its run. */
export interface CeilingPoint { readonly t: number; readonly y: number }

/** A part of the ceiling that comes down into the room, along a wall: the underside of a staircase, a
 * landing, a sloped roof, a beam or a boxing. Its underside follows `profile`, like a wardrobe's top:
 * - `run: 'along'`: the height changes along the wall (`t` from the wall's corner `a`, as an opening's
 *   offset) and stays level for `depth` into the room, as under a staircase that runs beside the wall.
 * - `run: 'across'`: the height changes with the distance from the wall's face (`t` from 0) and stays
 *   level along the whole wall, as under a roof sloping down to the wall. It reaches its last point.
 * Two points at one `t` are a vertical step. Where several cover a spot, the lowest counts. */
export interface StudioCeiling {
  readonly id: string;
  readonly wall: string;
  readonly run: 'along' | 'across';
  readonly depth: number;
  readonly profile: readonly CeilingPoint[];
}

export interface Studio {
  readonly template: StudioTemplateId;
  readonly corners: readonly StudioCorner[];
  readonly walls: readonly StudioWall[];
  readonly openings: readonly StudioOpening[];
  /** Absent in rooms with a flat ceiling, so older projects stay as they were saved. */
  readonly ceilings?: readonly StudioCeiling[] | undefined;
}

/** Limits a person can build within. Centimetres. */
export const STUDIO_LIMITS = Object.freeze({
  minWallLength: 30, maxWallLength: 2000,
  minThickness: 5, maxThickness: 60,
  minHeight: 100, maxHeight: 500,
  /** Opening edges keep this far from the wall's ends, so the frame has room. */
  openingMargin: 5,
  minOpeningWidth: 40,
  /** A ceiling's underside stays this high, and reaches at least this far into the room. */
  minCeilingHeight: 40, minCeilingDepth: 20,
});

/** Defaults for walls and openings people add. */
export const STUDIO_DEFAULTS = Object.freeze({
  thickness: 12, height: 260,
  door: { width: 80, height: 205, sill: 0 },
  window: { width: 120, height: 120, sill: 90 },
  archway: { width: 100, height: 210, sill: 0 },
  water: { width: 24, height: 20, sill: 50 },
  socket: { width: 16, height: 10, sill: 110 },
  duct: { width: 18, height: 18, sill: 215 },
  gas: { width: 12, height: 16, sill: 65 },
  radiator: { width: 80, height: 60, sill: 15 },
  switch: { width: 10, height: 10, sill: 105 },
});

/** The room's ceiling height: the top of its lowest wall, where the flat ceiling sits. */
export const roomHeight = (studio: Studio) => studio.walls.length ? Math.min(...studio.walls.map(w => w.height)) : STUDIO_DEFAULTS.height;

export const corner = (studio: Studio, id: string) => studio.corners.find(c => c.id === id);
export const wall = (studio: Studio, id: string) => studio.walls.find(w => w.id === id);

/** The wall's line and direction. Null if a corner is missing. */
export function wallLine(studio: Studio, w: StudioWall) {
  const a = corner(studio, w.a), b = corner(studio, w.b);
  if (!a || !b) return null;
  const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
  const ux = length ? dx / length : 1, uz = length ? dz / length : 0;
  // The room side: the direction a wardrobe against this wall faces (rotated from the wall's run).
  return { a, b, length, ux, uz, nx: -uz, nz: ux, angle: Math.atan2(-dz, dx) * 180 / Math.PI + 0 };
}

/** How many walls meet at a corner. */
export const cornerDegree = (studio: Studio, id: string) => studio.walls.filter(w => w.a === id || w.b === id).length;

/** Where the wall's solid starts and ends along its line, measured from corner `a`. A wall that meets
 * another at a corner reaches half its thickness past it, so the two fill the corner between them. */
export function wallExtent(studio: Studio, w: StudioWall, length: number) {
  return { start: cornerDegree(studio, w.a) > 1 ? -w.thickness / 2 : 0, end: length + (cornerDegree(studio, w.b) > 1 ? w.thickness / 2 : 0) };
}

/** A wall as a solid box, in the form the collision rules use: centre, angle (degrees, like a
 * wardrobe's), length along the wall, thickness across it, height. */
export function wallBox(studio: Studio, w: StudioWall) {
  const line = wallLine(studio, w);
  if (!line) return null;
  const { start, end } = wallExtent(studio, w, line.length), mid = (start + end) / 2;
  return { id: 'wall:' + w.id, x: line.a.x + line.ux * mid, z: line.a.z + line.uz * mid, y: 0, angle: line.angle, length: end - start, thickness: w.thickness, height: w.height };
}

/** The wall's room-side face on the floor: the length a tape measure reads inside the room. It runs from
 * where it meets the face of the wall joined at corner `a` to where it meets the one at `b`; at a free
 * end it stops at the corner. `start` and `end` are measured along the wall from corner `a`. */
export function wallFace(studio: Studio, w: StudioWall) {
  const line = wallLine(studio, w);
  if (!line) return null;
  const off = w.thickness / 2, x0 = line.a.x + line.nx * off, z0 = line.a.z + line.nz * off;
  /** Where this face crosses the face of the other wall at a corner, along this wall; `fallback` if none. */
  const meet = (id: string, fallback: number) => {
    const other = studio.walls.find(o => o !== w && (o.a === id || o.b === id)), ol = other && wallLine(studio, other);
    if (!other || !ol) return fallback;
    const det = line.ux * -ol.uz + line.uz * ol.ux;
    if (Math.abs(det) < 1e-6) return fallback;
    const qx = ol.a.x + ol.nx * other.thickness / 2 - x0, qz = ol.a.z + ol.nz * other.thickness / 2 - z0;
    return (qx * -ol.uz + qz * ol.ux) / det;
  };
  const start = meet(w.a, 0), end = meet(w.b, line.length), at = (t: number) => ({ x: x0 + line.ux * t, z: z0 + line.uz * t });
  return { start, end, length: end - start, from: at(start), to: at(end) };
}

/** The next free id with a prefix: c1, c2... */
export function nextId(prefix: string, used: readonly { id: string }[]) {
  const n = used.reduce((m, { id }) => id.startsWith(prefix) ? Math.max(m, Number(id.slice(prefix.length)) || 0) : m, 0);
  return prefix + (n + 1);
}

/** Room bounds on the floor (wall thickness included), or null for an empty studio. */
export function studioBounds(studio: Studio) {
  const xs: number[] = [], zs: number[] = [];
  for (const w of studio.walls) {
    const line = wallLine(studio, w);
    if (!line) continue;
    const half = w.thickness / 2;
    for (const p of [line.a, line.b]) { xs.push(p.x - half, p.x + half); zs.push(p.z - half, p.z + half); }
  }
  if (!xs.length) return null;
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), height: Math.max(...studio.walls.map(w => w.height)) };
}
