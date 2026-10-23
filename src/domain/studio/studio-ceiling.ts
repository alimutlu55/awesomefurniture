/**
 * Ceilings that come down into the room: the underside of a staircase or its landing, a roof sloping down
 * to a wall, a beam or a boxing. Each belongs to a wall (see StudioCeiling in studio.ts) and is shaped like a
 * wardrobe's top: a profile of heights, with slopes between points and vertical steps where two points
 * share a position. Plain data and pure functions, in scene centimetres.
 */
import { STUDIO_LIMITS as L, nextId, roomHeight, wall, wallFace, wallLine } from './studio';
import type { CeilingPoint, Studio, StudioCeiling, StudioCorner } from './studio';
import { clipBoundary, lowerBoundary, validBoundary } from '../geometry/boundary';
import { ceilingBoundary } from './studio-boundary';
import { sectionTriangles, triangleHeight, validSections } from '../geometry/solid-boundary';
import type { BoundarySection } from '../geometry/boundary';

type P = { x: number; z: number };
const round = (n: number) => Math.round(n * 10) / 10;
const EPS = .01;

/** Where a ceiling is on the floor. `s` runs along its wall from corner `a`, `d` into the room from the
 * wall's face. `along` and `across` are the stretches it covers in each. */
export function ceilingFrame(studio: Studio, c: StudioCeiling) {
  const w = wall(studio, c.wall), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
  const first = c.profile[0], last = c.profile.at(-1);
  if (!w || !line || !face || !first || !last) return null;
  const off = w.thickness / 2;
  const ts = c.sections?.flatMap(s => s.outline.map(p => p.t)), from = ts ? Math.min(...ts) : first.t, to = ts ? Math.max(...ts) : last.t;
  const along = c.run === 'along' ? { from, to } : { from: face.start, to: face.end };
  const across = c.run === 'along' ? { from: 0, to: c.depth } : { from, to };
  /** The floor point at (s, d). */
  const at = (s: number, d: number): P => ({ x: line.a.x + line.ux * s + line.nx * (off + d), z: line.a.z + line.uz * s + line.nz * (off + d) });
  /** A floor point in (s, d). */
  const local = (p: P) => {
    const x = p.x - line.a.x, z = p.z - line.a.z;
    return { s: x * line.ux + z * line.uz, d: x * line.nx + z * line.nz - off };
  };
  return { wall: w, line, face, off, along, across, at, local };
}

/** The underside's height at `t` along its run, or null outside it. At a step, the lower side. */
export function profileAt(profile: readonly CeilingPoint[], t: number): number | null {
  let out: number | null = null;
  for (let k = 0; k < profile.length - 1; k++) {
    const a = profile[k]!, b = profile[k + 1]!;
    if (t < a.t - EPS || t > b.t + EPS) continue;
    const y = b.t - a.t < 1e-6 ? Math.min(a.y, b.y) : a.y + (b.y - a.y) * Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    out = out === null ? y : Math.min(out, y);
  }
  return out;
}

/** The clear height above a floor point: the lowest ceiling over it, or the room's flat ceiling. */
export function ceilingAt(studio: Studio, p: P): number {
  let h = roomHeight(studio);
  for (const c of studio.ceilings ?? []) {
    const f = ceilingFrame(studio, c);
    if (!f) continue;
    const { s, d } = f.local(p);
    if (s < f.along.from - EPS || s > f.along.to + EPS || d < f.across.from - EPS || d > f.across.to + EPS) continue;
    if (c.sections) {
      const t = c.run === 'along' ? s : d, u = c.run === 'along' ? d / c.depth : (s - f.face.start) / (f.face.end - f.face.start);
      for (const triangle of sectionTriangles(c.sections)) {
        const height = triangleHeight(triangle, t, u);
        if (height !== null) h = Math.min(h, height);
      }
      continue;
    }
    const y = profileAt(c.profile, c.run === 'along' ? s : d);
    if (y !== null) h = Math.min(h, y);
  }
  return h;
}

/** How far the room reaches in front of a wall at `s` along it: from its face to the next wall's face.
 * Null when nothing stands opposite (an open side of the room). */
export function reachAt(studio: Studio, wallId: string, s: number): number | null {
  const w = wall(studio, wallId), line = w && wallLine(studio, w);
  if (!w || !line) return null;
  const off = w.thickness / 2, o = { x: line.a.x + line.ux * s + line.nx * off, z: line.a.z + line.uz * s + line.nz * off };
  let best: number | null = null;
  for (const other of studio.walls) {
    const ol = other === w ? null : wallLine(studio, other);
    if (!ol) continue;
    // Ray o + n·r against the other wall's centre line a + u·q, 0 <= q <= length.
    const det = line.nx * -ol.uz + line.nz * ol.ux;
    if (Math.abs(det) < 1e-6) continue;
    const qx = ol.a.x - o.x, qz = ol.a.z - o.z, r = (qx * -ol.uz + qz * ol.ux) / det, q = (line.nx * qz - line.nz * qx) / det;
    if (r <= 1 || q < -1 || q > ol.length + 1) continue;
    // To its near face: its half thickness, measured along the ray.
    const face = r - other.thickness / 2 / Math.max(.2, Math.abs(line.nx * ol.nx + line.nz * ol.nz));
    if (face > 1 && (best === null || face < best)) best = face;
  }
  return best;
}

/** Ceiling shapes people start from. THIS IS THE ONLY PLACE TO ADD ONE: append an entry. The toolbar's
 * choices, their drawings (drawn from `build`), saving and validation follow. Each builds a ceiling on a
 * wall's inside face from `start` to `end` (along the wall from corner a), in a room `height` tall, with
 * `reach` cm of room in front of the wall. */
export interface CeilingShape {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly build: (span: { start: number; end: number; height: number; reach: number }) => Pick<StudioCeiling, 'run' | 'depth' | 'profile'>;
}
/** A staircase's pitch: the angle its underside rises at. */
const PITCH = Math.tan(37 * Math.PI / 180);
const pts = (list: readonly (readonly [number, number])[]) => list.map(([t, y]) => ({ t: round(t), y: round(y) }));

export const CEILING_SHAPES = [
  {
    id: 'stairs', name: 'Stairs', description: 'The underside of a staircase above, rising along this wall',
    build: ({ start, end, height, reach }) => {
      const low = Math.min(height - 20, 100), run = Math.min(end - start, (height - low) / PITCH), top = low + run * PITCH;
      return { run: 'along', depth: Math.min(reach, 100), profile: pts([[end - run, top], [end, low]]) };
    },
  },
  {
    id: 'landing', name: 'Stairs with landing', description: 'A staircase that turns on a landing above',
    build: ({ start, end, height, reach }) => {
      // A landing 55 cm below the ceiling, then a flight down to 100 cm, as in a typical turning stair.
      const length = end - start, landing = Math.max(L.minCeilingHeight + 60, height - 55), low = Math.min(landing - 10, 100);
      const flight = Math.min(length * .45, (landing - low) / PITCH), deck = Math.min(90, length * .25), lead = Math.max(0, length - flight - deck) * .6;
      const a = start + lead, b = a + deck, c = b + flight;
      return { run: 'along', depth: Math.min(reach, 110), profile: pts([[a, landing], [b, landing], [c, low], [end, low]]) };
    },
  },
  {
    id: 'slope', name: 'Sloped ceiling', description: 'A roof sloping down to this wall',
    build: ({ height, reach }) => {
      const low = Math.max(L.minCeilingHeight + 70, height - 140), depth = Math.max(L.minCeilingDepth, Math.min(reach - 20, (height - low) / Math.tan(40 * Math.PI / 180)));
      return { run: 'across', depth: round(depth), profile: pts([[0, low], [depth, height]]) };
    },
  },
  {
    id: 'box', name: 'Box or beam', description: 'A boxing or a beam lower than the ceiling',
    build: ({ start, end, height, reach }) => {
      const width = Math.min(90, (end - start) / 2), mid = (start + end) / 2;
      return { run: 'along', depth: Math.min(reach, 60), profile: pts([[mid - width / 2, height - 40], [mid + width / 2, height - 40]]) };
    },
  },
] as const satisfies readonly CeilingShape[];
export type CeilingShapeId = typeof CEILING_SHAPES[number]['id'];

/** Why a ceiling cannot be built, worded as what to do. Empty when it is fine. */
export function ceilingProblems(studio: Studio, c: StudioCeiling): string[] {
  const f = ceilingFrame(studio, c), out: string[] = [];
  if (!f) return ['A ceiling is on a wall that no longer exists.'];
  const ps = c.profile, top = roomHeight(studio);
  if (c.sections && (!validSections(c.sections) || c.sections.some(s => s.outline.some(p => p.y < L.minCeilingHeight || p.y > top)))) out.push('Keep every ceiling corner inside the room height and free of crossings.');
  if (c.outline && (!validBoundary(c.outline) || c.outline.some(p => p.y < L.minCeilingHeight || p.y > top))) out.push('Keep the ceiling boundary inside the room height and free of crossings.');
  if (ps.length < 2) out.push('A ceiling needs at least two points.');
  for (let k = 0; k < ps.length - 1; k++) {
    if (ps[k + 1]!.t < ps[k]!.t - EPS) out.push('Ceiling points must run in order. Move the point back.');
    if (!c.outline && k < ps.length - 2 && ps[k + 2]!.t - ps[k]!.t < EPS) out.push('Two steps cannot share a position. Move a point along.');
  }
  if (ps.length >= 2 && ps.at(-1)!.t - ps[0]!.t < 5 - EPS) out.push('A ceiling must be at least 5 cm long.');
  if (ps.some(p => p.y < L.minCeilingHeight - EPS)) out.push(`Keep the ceiling at least ${L.minCeilingHeight} cm above the floor.`);
  if (ps.some(p => p.y > top + EPS)) out.push('A ceiling cannot be higher than the room.');
  if (c.run === 'along') {
    if (ps[0]!.t < f.face.start - EPS || ps.at(-1)!.t > f.face.end + EPS) out.push('Keep the ceiling over its wall. Move the point back.');
    if (c.depth < L.minCeilingDepth - EPS || c.depth > L.maxWallLength) out.push(`A ceiling must reach at least ${L.minCeilingDepth} cm into the room.`);
  } else if (ps[0]!.t < -EPS || ps.at(-1)!.t < L.minCeilingDepth - EPS || ps.at(-1)!.t > L.maxWallLength) out.push(`A ceiling must reach at least ${L.minCeilingDepth} cm into the room.`);
  return out;
}

// Edits: each returns the edited studio, or null when it does not apply. The caller validates.
const custom = (studio: Studio, ceilings: readonly StudioCeiling[]): Studio => ({ ...studio, ceilings, template: 'custom' });
function withSections(c: StudioCeiling, sections: readonly BoundarySection[]): StudioCeiling {
  const outline = sections.at(-1)!.outline, profile = lowerBoundary(outline);
  return { ...c, sections, outline, profile, depth: c.run === 'across' ? Math.max(...sections.flatMap(s => s.outline.map(p => p.t))) : c.depth };
}
const swap = (studio: Studio, id: string, change: (c: StudioCeiling) => StudioCeiling | null) => {
  const c = studio.ceilings?.find(x => x.id === id), next = c && change(c);
  return next ? custom(studio, studio.ceilings!.map(x => x.id === id ? next : x)) : null;
};

/** Puts a ceiling shape on a wall, replacing the one it had. Its id is the last ceiling's. */
export function addCeiling(studio: Studio, wallId: string, shapeId: string): Studio | null {
  const shape = (CEILING_SHAPES as readonly CeilingShape[]).find(s => s.id === shapeId), w = wall(studio, wallId), face = w && wallFace(studio, w);
  if (!shape || !face || face.length < 10) return null;
  const reach = reachAt(studio, wallId, (face.start + face.end) / 2) ?? 200;
  const built = shape.build({ start: face.start, end: face.end, height: roomHeight(studio), reach });
  const kept = (studio.ceilings ?? []).filter(c => c.wall !== wallId);
  return custom(studio, [...kept, { id: nextId('k', studio.ceilings ?? []), wall: wallId, ...built }]);
}

/** Moves one point of a ceiling's profile, kept between its neighbours (meeting one makes a step). */
export function moveCeilingPoint(studio: Studio, id: string, index: number, t: number, y: number, section?: number): Studio | null {
  return swap(studio, id, c => {
    if (c.sections) {
      const selected = section ?? c.sections.length - 1;
      if (!c.sections[selected]?.outline[index]) return null;
      const from = c.sections[selected]!.outline[index]!;
      const sections = c.sections.map(s => ({ ...s,
        outline: s.outline.map((p, j) => j === index ? { ...p, t: p.t + t - from.t, y: p.y + y - from.y } : p) }));
      return validSections(sections) ? withSections(c, sections) : null;
    }
    if (c.outline || index >= c.profile.length) {
      const points = ceilingBoundary(studio, c);
      if (!points[index]) return null;
      const outline = points.map((p, k) => k === index ? { ...p, t, y } : p);
      if (!validBoundary(outline)) return null;
      return { ...c, outline, profile: lowerBoundary(outline) };
    }
    const prev = c.profile[index - 1], next = c.profile[index + 1];
    if (!c.profile[index]) return null;
    const at = round(Math.min(next?.t ?? Infinity, Math.max(prev?.t ?? -Infinity, t)));
    const profile = c.profile.map((p, k) => k === index ? { t: at, y: round(y) } : p);
    return { ...c, profile, depth: c.run === 'across' ? profile.at(-1)!.t : c.depth };
  });
}

/** Lift the underside while keeping its attachment to the room's ceiling. */
export function liftCeiling(studio: Studio, id: string, by: number): Studio | null {
  return swap(studio, id, c => {
    if (c.sections) {
      const top = roomHeight(studio);
      const sections = c.sections.map(s => ({ ...s, outline: s.outline.map(p => ({ ...p, y: Math.abs(p.y - top) < 1e-9 ? top : p.y + by })) }));
      return validSections(sections) ? withSections(c, sections) : null;
    }
    if (!c.outline) return { ...c, profile: c.profile.map(p => ({ ...p, y: p.y + by })) };
    const top = roomHeight(studio), outline = c.outline.map(p => ({ ...p, y: Math.abs(p.y - top) < 1e-9 ? top : p.y + by }));
    if (!validBoundary(outline)) return null;
    return { ...c, outline, profile: lowerBoundary(outline) };
  });
}

/** Adds a bend at the chosen position (the midpoint by default), preserving the current underside. */
export function splitCeilingPanel(studio: Studio, id: string, index: number, position?: number): Studio | null {
  return swap(studio, id, c => {
    const a = c.profile[index], b = c.profile[index + 1];
    if (!a || !b || b.t - a.t < 10) return null;
    const t = round(position ?? (a.t + b.t) / 2);
    if (!Number.isFinite(t) || t < a.t + 5 || t > b.t - 5) return null;
    const point = { t, y: round(a.y + (b.y - a.y) * (t - a.t) / (b.t - a.t)) };
    return { ...c, profile: [...c.profile.slice(0, index + 1), point, ...c.profile.slice(index + 1)] };
  });
}

/** How far it reaches into the room. A sloped roof keeps its heights and stretches to the new depth. */
export function setCeilingDepth(studio: Studio, id: string, depth: number): Studio | null {
  return swap(studio, id, c => {
    if (c.run === 'along') return { ...c, depth: round(depth) };
    const from = c.profile[0]!.t, span = c.profile.at(-1)!.t - from;
    if (span < 1e-6) return null;
    if (c.sections) return withSections(c, c.sections.map(s => ({ ...s, outline: s.outline.map(p => ({ ...p, t: from + (p.t - from) * (depth - from) / span })) })));
    if (c.outline) {
      const outline = c.outline.map(p => ({ ...p, t: from + (p.t - from) * (depth - from) / span }));
      return { ...c, depth, outline, profile: lowerBoundary(outline) };
    }
    return { ...c, depth: round(depth), profile: c.profile.map(p => ({ ...p, t: round(from + (p.t - from) * (depth - from) / span) })) };
  });
}

/** Turns a ceiling round: a staircase rises the other way along the wall. */
export function flipCeiling(studio: Studio, id: string): Studio | null {
  return swap(studio, id, c => {
    if (c.run !== 'along') return null;
    const sum = c.profile[0]!.t + c.profile.at(-1)!.t;
    if (c.sections) return withSections(c, c.sections.map(s => ({ ...s, outline: [...s.outline].reverse().map(p => ({ ...p, t: sum - p.t })) })));
    if (c.outline) {
      const outline = [...c.outline].reverse().map(p => ({ ...p, t: sum - p.t }));
      return { ...c, outline, profile: lowerBoundary(outline) };
    }
    return { ...c, profile: [...c.profile].reverse().map(p => ({ ...p, t: round(sum - p.t) })) };
  });
}

export function removeCeiling(studio: Studio, id: string): Studio | null {
  if (!studio.ceilings?.some(c => c.id === id)) return null;
  return custom(studio, studio.ceilings.filter(c => c.id !== id));
}

/** After corners move, ceilings stay where they were in the room: each point keeps its place along its
 * wall's new line, kept over the wall's inside face. */
export function keepCeilings(before: Studio, corners: readonly StudioCorner[]): StudioCeiling[] | undefined {
  if (!before.ceilings) return undefined;
  const after = { ...before, corners };
  return before.ceilings.map(c => {
    const w = wall(before, c.wall), old = w && wallLine(before, w), now = w && wallLine(after, w), face = w && wallFace(after, w);
    if (c.run !== 'along' || !old || !now || !face) return c;
    if (c.sections) return withSections(c, c.sections.map(s => ({ ...s, outline: s.outline.map(p => {
      const x = old.a.x + old.ux * p.t, z = old.a.z + old.uz * p.t;
      return { ...p, t: Math.min(face.end, Math.max(face.start, (x - now.a.x) * now.ux + (z - now.a.z) * now.uz)) };
    }) })));
    if (c.outline) {
      const outline = c.outline.map(p => {
        const x = old.a.x + old.ux * p.t, z = old.a.z + old.uz * p.t;
        return { ...p, t: Math.min(face.end, Math.max(face.start, (x - now.a.x) * now.ux + (z - now.a.z) * now.uz)) };
      });
      return { ...c, outline, profile: lowerBoundary(outline) };
    }
    const placed = c.profile.map(p => {
      const x = old.a.x + old.ux * p.t, z = old.a.z + old.uz * p.t;
      return { ...p, t: round(Math.min(face.end, Math.max(face.start, (x - now.a.x) * now.ux + (z - now.a.z) * now.uz))) };
    });
    return { ...c, profile: tidy(placed) };
  });
}
/** Drops the middle of three points that share a position: what is left is one step. */
const tidy = (ps: readonly CeilingPoint[]) => ps.filter((p, k) => !(k > 0 && k < ps.length - 1 && Math.abs(ps[k - 1]!.t - p.t) < EPS && Math.abs(ps[k + 1]!.t - p.t) < EPS));

/** Ceilings after a wall is split at `d` along it: each goes with the part its middle is over. */
export function splitCeilings(studio: Studio, wallId: string, second: string, d: number): StudioCeiling[] | undefined {
  return studio.ceilings?.map(c => {
    if (c.wall !== wallId || c.run !== 'along') return c;
    const mid = (c.profile[0]!.t + c.profile.at(-1)!.t) / 2;
    if (c.sections) return withSections({ ...c, wall: mid < d ? wallId : second }, c.sections.map(s => ({ ...s,
      outline: mid < d ? clipBoundary(s.outline, -Infinity, d) : clipBoundary(s.outline, d, Infinity).map(p => ({ ...p, t: p.t - d })) })));
    if (c.outline) {
      const outline = mid < d ? clipBoundary(c.outline, -Infinity, d) : clipBoundary(c.outline, d, Infinity).map(p => ({ ...p, t: p.t - d }));
      return { ...c, wall: mid < d ? wallId : second, outline, profile: lowerBoundary(outline) };
    }
    return mid < d ? { ...c, profile: tidy(c.profile.map(p => ({ ...p, t: Math.min(p.t, d) }))) } : { ...c, wall: second, profile: tidy(c.profile.map(p => ({ ...p, t: round(Math.max(0, p.t - d)) }))) };
  });
}
