/**
 * Ceilings that come down into the room: the underside of a staircase or its landing, a roof sloping down
 * to a wall, a beam or a boxing. Each belongs to a wall (see StudioCeiling in studio.ts) and is shaped like a
 * wardrobe's top: a profile of heights, with slopes between points and vertical steps where two points
 * share a position. Plain data and pure functions, in scene centimetres.
 */
import { ceilingLowerProfile, sectionExtent, sectionLowerProfile, withCeilingProfile, withDepth } from './surface-boundary';
import { surfaceProblems } from './surface-profile';
import { mapBoundary, trimBoundary } from './surface-outline';
import { outerEdgeHeight } from './ceiling-edge';
import { STUDIO_LIMITS as L, nextId, roomHeight, wall, wallFace, wallLine } from './studio';
import type { CeilingPoint, Studio, StudioCeiling, StudioCorner } from './studio';

type P = { x: number; z: number };
const round = (n: number) => Math.round(n * 10) / 10;
const EPS = .01;

/** Where a ceiling is on the floor. `s` runs along its wall from corner `a`, `d` into the room from the
 * wall's face. `along` and `across` are the stretches it covers in each. */
export function ceilingFrame(studio: Studio, c: StudioCeiling) {
  const w = wall(studio, c.wall), line = w && wallLine(studio, w), face = w && wallFace(studio, w);
  const first = c.profile[0], last = c.profile.at(-1);
  if (!w || !line || !face || !first || !last) return null;
  const off = w.thickness / 2, side = sectionExtent(c);
  // Where the other side's outline is narrower, the shape stops there too.
  const along = c.run === 'along' ? { from: first.t, to: last.t } : side ? { from: Math.max(face.start, side.from), to: Math.min(face.end, side.to) } : { from: face.start, to: face.end };
  const across = c.run === 'along' ? (side ? { from: Math.max(0, side.from), to: side.to } : { from: 0, to: c.depth }) : { from: first.t, to: last.t };
  /** The floor point at (s, d). */
  const at = (s: number, d: number): P => ({ x: line.a.x + line.ux * s + line.nx * (off + d), z: line.a.z + line.uz * s + line.nz * (off + d) });
  /** A floor point in (s, d). */
  const local = (p: P) => {
    const x = p.x - line.a.x, z = p.z - line.a.z;
    return { s: x * line.ux + z * line.uz, d: x * line.nx + z * line.nz - off };
  };
  return { studio, wall: w, line, face, off, along, across, at, local };
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
    const y = profileAt(ceilingLowerProfile(c), c.run === 'along' ? s : d), section = sectionLowerProfile(c);
    // Seen from both sides, the solid is what both outlines allow: its underside is the higher of the two.
    const other = section ? profileAt(section, c.run === 'along' ? d : s) : null;
    if (y !== null && (!section || other !== null)) h = Math.min(h, Math.max(y, other ?? -Infinity) + (c.run === 'along' ? (c.edgeRise ?? 0) * d / c.depth : 0));
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
  /** `centre` is where along the wall the person is looking, for shapes narrower than the wall. A shape that is
   * not hung from the ceiling (a pillar) gives its whole `outline`; the profile is then its underside. */
  readonly build: (span: { start: number; end: number; height: number; reach: number; centre?: number | undefined }) => Pick<StudioCeiling, 'run' | 'depth' | 'profile' | 'outline'>;
}
/** A staircase's pitch: the angle its underside rises at. */
const PITCH = Math.tan(37 * Math.PI / 180);
const pts = (list: readonly (readonly [number, number])[]) => list.map(([t, y]) => ({ t: round(t), y: round(y) }));
const within = (low: number, high: number, v: number) => Math.max(low, Math.min(high, v));

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
    build: ({ start, end, height, reach, centre }) => {
      const width = Math.min(90, (end - start) / 2), mid = within(start + width / 2, end - width / 2, centre ?? (start + end) / 2);
      return { run: 'along', depth: Math.min(reach, 60), profile: pts([[mid - width / 2, height - 40], [mid + width / 2, height - 40]]) };
    },
  },
  {
    id: 'pillar', name: 'Pillar', description: 'A column or chimney breast standing against this wall, floor to ceiling',
    build: ({ start, end, height, reach, centre }) => {
      const width = Math.min(40, (end - start) / 2), mid = within(start + width / 2, end - width / 2, centre ?? (start + end) / 2);
      const outline = pts([[mid - width / 2, 0], [mid + width / 2, 0], [mid + width / 2, height], [mid - width / 2, height]]);
      return { run: 'along', depth: Math.max(L.minCeilingDepth, Math.min(reach - 20, 40)), outline, profile: pts([[mid - width / 2, 0], [mid + width / 2, 0]]) };
    },
  },
  {
    id: 'boxing', name: 'Boxing', description: 'A boxed-in wall on the floor, as over a toilet frame or pipes, with a shelf on top',
    build: ({ start, end, reach, centre }) => {
      const width = Math.min(90, end - start), mid = within(start + width / 2, end - width / 2, centre ?? (start + end) / 2);
      const outline = pts([[mid - width / 2, 0], [mid + width / 2, 0], [mid + width / 2, 120], [mid - width / 2, 120]]);
      return { run: 'along', depth: Math.max(L.minCeilingDepth, Math.min(reach - 20, 20)), outline, profile: pts([[mid - width / 2, 0], [mid + width / 2, 0]]) };
    },
  },
  {
    id: 'stepped', name: 'Stepped boxing', description: 'A soffit that steps down, as over pipes or a cistern',
    build: ({ start, end, height, reach, centre }) => {
      const width = Math.min(160, end - start), a = within(start, end - width, (centre ?? (start + end) / 2) - width / 2), b = a + width / 2, c = a + width;
      const outline = pts([[a, height - 50], [b, height - 50], [b, height - 25], [c, height - 25], [c, height], [a, height]]);
      return { run: 'along', depth: Math.min(reach, 45), outline, profile: pts([[a, height - 50], [b, height - 50], [b, height - 25], [c, height - 25]]) };
    },
  },
] as const satisfies readonly CeilingShape[];
export type CeilingShapeId = typeof CEILING_SHAPES[number]['id'];

/** Why a ceiling cannot be built, worded as what to do. Empty when it is fine. */
export function ceilingProblems(studio: Studio, c: StudioCeiling): string[] {
  const f = ceilingFrame(studio, c), out = surfaceProblems(studio, { kind: 'ceiling', id: c.id });
  if (!f) return ['A ceiling is on a wall that no longer exists.'];
  const ps = c.profile, top = roomHeight(studio);
  if (!Number.isFinite(c.depth) || ps.some(p => !Number.isFinite(p.t) || !Number.isFinite(p.y))) return ['Enter a finite ceiling dimension.'];
  // A drawn shape (a pillar, a stepped boxing) may stand on the floor; its outline has its own rules.
  if (c.outline) {
    if (c.edgeRise !== undefined && (!Number.isFinite(c.edgeRise) || c.run !== 'along')) out.push('Choose a valid outer edge lift.');
    if (c.run === 'along' && (c.depth < L.minCeilingDepth - EPS || c.depth > L.maxWallLength)) out.push(`A shape must reach at least ${L.minCeilingDepth} cm into the room.`);
    return out;
  }
  if (c.edgeRise !== undefined && (!Number.isFinite(c.edgeRise) || c.run !== 'along')) out.push('Choose a valid outer edge lift.');
  if (ps.some(p => p.y + Math.min(0, c.edgeRise ?? 0) < L.minCeilingHeight - EPS)) out.push('Keep the outer edge at least 40 cm above the floor.');
  if (c.edgeRise && outerEdgeHeight(c) > top + EPS) out.push('The outer edge has reached the room ceiling.');
  if (ps.length < 2) out.push('A ceiling needs at least two points.');
  for (let k = 0; k < ps.length - 1; k++) {
    if (ps[k + 1]!.t < ps[k]!.t - 1e-8) out.push('Ceiling points must run in order. Move the point back.');
    const a = ps[k]!, b = ps[k + 1]!, next = ps[k + 2];
    if (Math.hypot(b.t - a.t, b.y - a.y) < 1e-6) out.push('These points meet. Move them apart or remove one.');
    if (next && Math.abs(next.t - a.t) < 1e-6 && (b.y - a.y) * (next.y - b.y) <= 0)
      out.push('This edge folds back on itself. Move the point back.');
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
const swap = (studio: Studio, id: string, change: (c: StudioCeiling) => StudioCeiling | null) => {
  const c = studio.ceilings?.find(x => x.id === id), next = c && change(c);
  return next ? custom(studio, studio.ceilings!.map(x => x.id === id ? next : x)) : null;
};

/** Puts a shape on a wall, beside any it has already, centred where the person looks (`centre` along the wall)
 * when it is narrower than the wall. Its id is the last ceiling's. */
export function addCeiling(studio: Studio, wallId: string, shapeId: string, centre?: number): Studio | null {
  const built = buildShape(studio, wallId, shapeId, centre);
  return built && custom(studio, [...studio.ceilings ?? [], { id: nextId('k', studio.ceilings ?? []), wall: wallId, ...built }]);
}
/** Starts a ceiling over from another shape, on the same wall and where it was. */
export function replaceCeiling(studio: Studio, id: string, shapeId: string): Studio | null {
  const c = studio.ceilings?.find(x => x.id === id), built = c && buildShape(studio, c.wall, shapeId, c.run === 'along' ? (c.profile[0]!.t + c.profile.at(-1)!.t) / 2 : undefined);
  return built ? swap(studio, id, old => { const { outline: _o, section: _s, boundaryControls: _b, edgeRise: _e, ...rest } = old; return { ...rest, ...built }; }) : null;
}
function buildShape(studio: Studio, wallId: string, shapeId: string, centre?: number) {
  const shape = (CEILING_SHAPES as readonly CeilingShape[]).find(s => s.id === shapeId), w = wall(studio, wallId), face = w && wallFace(studio, w);
  if (!shape || !face || face.length < 10) return null;
  const reach = reachAt(studio, wallId, (face.start + face.end) / 2) ?? 200;
  return shape.build({ start: face.start, end: face.end, height: roomHeight(studio), reach, centre });
}

/** Moves one point of a ceiling's profile, kept between its neighbours (meeting one makes a step). */
export function moveCeilingPoint(studio: Studio, id: string, index: number, t: number, y: number): Studio | null {
  return swap(studio, id, c => {
    const prev = c.profile[index - 1], next = c.profile[index + 1];
    if (!c.profile[index]) return null;
    const at = round(Math.min(next?.t ?? Infinity, Math.max(prev?.t ?? -Infinity, t)));
    const profile = c.profile.map((p, k) => k === index ? { t: at, y: round(y) } : p);
    return { ...withCeilingProfile(c, profile), depth: c.run === 'across' ? profile.at(-1)!.t : c.depth };
  });
}

/** Move a vertical step as one edge along its run. Shift-drag can still angle a single corner. */
export function reshapeCeilingPoint(studio: Studio, id: string, index: number, t: number, y: number): Studio | null {
  const c = studio.ceilings?.find(c => c.id === id), p = c?.profile[index];
  if (!c || !p) return null;
  let first = index, last = index;
  while (first > 0 && Math.abs(c.profile[first - 1]!.t - p.t) < 1e-6) first--;
  while (last + 1 < c.profile.length && Math.abs(c.profile[last + 1]!.t - p.t) < 1e-6) last++;
  if (first === last) return moveCeilingPoint(studio, id, index, t, y);
  const at = Math.min(c.profile[last + 1]?.t ?? Infinity, Math.max(c.profile[first - 1]?.t ?? -Infinity, t));
  return swap(studio, id, c => {
    const profile = c.profile.map((point, k) => ({ ...point, ...(k >= first && k <= last ? { t: at } : {}), ...(k === index ? { y } : {}) }));
    return { ...withCeilingProfile(c, profile), depth: c.run === 'across' ? profile.at(-1)!.t : c.depth };
  });
}

/** Adds a bend anywhere inside an edge, including vertical edges, without changing its surface. */
export function splitCeilingPanel(studio: Studio, id: string, index: number, position?: number, fraction?: number): Studio | null {
  return swap(studio, id, c => {
    const a = c.profile[index], b = c.profile[index + 1];
    if (!a || !b) return null;
    const u = fraction ?? (position === undefined ? .5 : b.t === a.t ? NaN : (position - a.t) / (b.t - a.t));
    if (!Number.isFinite(u) || u <= 1e-8 || u >= 1 - 1e-8 || Math.hypot(b.t - a.t, b.y - a.y) < 1e-6) return null;
    const point = { t: a.t + (b.t - a.t) * u, y: a.y + (b.y - a.y) * u };
    return { ...c, profile: [...c.profile.slice(0, index + 1), point, ...c.profile.slice(index + 1)] };
  });
}

/** How far it reaches into the room. A sloped roof keeps its heights and stretches to the new depth. */
export function setCeilingDepth(studio: Studio, id: string, depth: number): Studio | null {
  return swap(studio, id, c => {
    if (c.run === 'along') return withDepth(c, depth);
    const from = c.profile[0]!.t, span = c.profile.at(-1)!.t - from;
    if (span < 1e-6) return null;
    return { ...mapBoundary(c, p => ({ ...p, t: round(from + (p.t - from) * (depth - from) / span) }), roomHeight(studio)), depth: round(depth) };
  });
}

/** Turns a ceiling round: a staircase rises the other way along the wall. */
export function flipCeiling(studio: Studio, id: string): Studio | null {
  return swap(studio, id, c => {
    if (c.run !== 'along') return null;
    const sum = c.profile[0]!.t + c.profile.at(-1)!.t;
    return mapBoundary(c, p => ({ ...p, t: round(sum - p.t) }), roomHeight(studio), true);
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
  // A shape that the wall's new length leaves with nothing over its face is dropped, not kept empty.
  return before.ceilings.flatMap(c => {
    const w = wall(before, c.wall), old = w && wallLine(before, w), now = w && wallLine(after, w), face = w && wallFace(after, w);
    if (c.run !== 'along' || !old || !now || !face) return c;
    const project = (p: CeilingPoint) => {
      const x = old.a.x + old.ux * p.t, z = old.a.z + old.uz * p.t;
      return { ...p, t: (x - now.a.x) * now.ux + (z - now.a.z) * now.uz };
    };
    if (c.outline) {
      const kept = trimBoundary(mapBoundary(c, project, roomHeight(after)), face.start, face.end, 0, roomHeight(after));
      return kept.profile.length >= 2 ? [kept] : [];
    }
    const placed = c.profile.map(project);
    const clipped = clipProfile(placed, face.start, face.end);
    return [{ ...c, profile: clipped.length >= 2 ? clipped : placed }];
  });
}
/** Trim the surface at a wall boundary, interpolating slopes rather than crushing corners into spikes. */
function clipProfile(profile: readonly CeilingPoint[], from: number, to: number): CeilingPoint[] {
  const out: CeilingPoint[] = [];
  const add = (p: CeilingPoint) => {
    const last = out.at(-1);
    if (!last || Math.hypot(last.t - p.t, last.y - p.y) > 1e-8) out.push(p);
  };
  for (let k = 0; k < profile.length - 1; k++) {
    const a = profile[k]!, b = profile[k + 1]!;
    if (b.t < from || a.t > to) continue;
    if (Math.abs(b.t - a.t) < 1e-8) { add(a); add(b); continue; }
    for (const t of [Math.max(from, a.t), Math.min(to, b.t)])
      add(t === a.t ? a : t === b.t ? b : { t, y: a.y + (b.y - a.y) * (t - a.t) / (b.t - a.t) });
  }
  return out;
}

/** Splitting a wall preserves the entire ceiling: each clipped part belongs to its supporting wall. */
export function splitCeilings(studio: Studio, wallId: string, second: string, d: number): StudioCeiling[] | undefined {
  if (!studio.ceilings) return undefined;
  const used = [...studio.ceilings];
  return studio.ceilings.flatMap(c => {
    if (c.wall !== wallId) return [c];
    // A shape with nothing left over its wall has no part to keep.
    if (!c.profile.length) return [];
    if (c.run === 'along' && c.outline) {
      const parts: StudioCeiling[] = [];
      if (c.profile[0]!.t < d) parts.push(trimBoundary(c, -Infinity, d, 0, roomHeight(studio)));
      if (c.profile.at(-1)!.t > d) {
        const copy = { ...trimBoundary(c, d, Infinity, d, roomHeight(studio)), id: parts.length ? nextId('k', used) : c.id, wall: second };
        used.push(copy); parts.push(copy);
      }
      return parts;
    }
    if (c.run === 'across') {
      const copy = { ...c, id: nextId('k', used), wall: second };
      used.push(copy);
      return [c, copy];
    }
    const left = clipProfile(c.profile, -Infinity, d), right = clipProfile(c.profile, d, Infinity);
    const parts: StudioCeiling[] = [];
    if (left.length >= 2 && left.at(-1)!.t > left[0]!.t) parts.push({ ...c, profile: left });
    if (right.length >= 2 && right.at(-1)!.t > right[0]!.t) {
      const copy = { ...c, id: parts.length ? nextId('k', used) : c.id, wall: second, profile: right.map(p => ({ ...p, t: p.t - d })) };
      used.push(copy);
      parts.push(copy);
    }
    return parts;
  });
}
