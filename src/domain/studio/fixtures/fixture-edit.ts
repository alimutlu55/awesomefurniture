/**
 * Fixture edits. Each takes a studio and returns the edited copy, or null when the edit does not apply. They do not
 * validate: the caller checks studioProblems() and refuses an invalid result with its reason. Centimetres.
 */
import { nextId, wall, wallFace, wallLine } from '../studio';
import type { Studio, StudioCorner, StudioFixture } from '../studio';
import { fixtureKind, fixtureType } from './fixture-kinds';

const round = (n: number) => Math.round(n * 10) / 10;
const withFixtures = (studio: Studio, fixtures: readonly StudioFixture[]): Studio => {
  if (fixtures.length) return { ...studio, fixtures };
  const { fixtures: _none, ...rest } = studio;
  return rest;
};
const swap = (studio: Studio, id: string, change: (f: StudioFixture) => StudioFixture | null) => {
  const f = studio.fixtures?.find(x => x.id === id), next = f && change(f);
  return next ? withFixtures(studio, studio.fixtures!.map(x => x.id === id ? next : x)) : null;
};

/** The type a kind starts with: its first setup's, else its first type. */
export function startType(kind: string) {
  const k = fixtureKind(kind);
  return k && (k.setups?.find(s => s.id === k.start)?.type ?? k.types[0]!.id);
}

/** Adds a fixture of `kind` to a wall, its middle `offset` along it, at its type's usual size. Its id is the last fixture's. */
export function addFixture(studio: Studio, wallId: string, kind: string, offset: number, type = startType(kind)): Studio | null {
  const t = type && fixtureType(kind, type);
  if (!t || !wall(studio, wallId)) return null;
  const fixture: StudioFixture = { id: nextId('f', studio.fixtures ?? []), wall: wallId, kind, type: t.id, offset: round(offset), ...t.size };
  return withFixtures(studio, [...studio.fixtures ?? [], fixture]);
}

/** A copy beside it on the same wall, `offset` along it. Its id is the last fixture's. */
export function duplicateFixture(studio: Studio, id: string, offset: number): Studio | null {
  const f = studio.fixtures?.find(x => x.id === id);
  return f ? withFixtures(studio, [...studio.fixtures!, { ...f, id: nextId('f', studio.fixtures!), offset: round(offset) }]) : null;
}

/** Slides a fixture along its wall, its middle `offset` from the wall's corner a. */
export const moveFixture = (studio: Studio, id: string, offset: number) => swap(studio, id, f => ({ ...f, offset: round(offset) }));

/** Sets its width, depth or height. Width grows from its middle. */
export function setFixtureSize(studio: Studio, id: string, size: Partial<Pick<StudioFixture, 'width' | 'depth' | 'height'>>): Studio | null {
  return swap(studio, id, f => ({ ...f, ...Object.fromEntries(Object.entries(size).map(([k, v]) => [k, round(v)])) }));
}

/** Changes its type. Its width and height are kept where the new type allows them; its depth is the new type's,
 * since that is what tells the types apart (a toilet with its cistern on show stands further out). */
export function setFixtureType(studio: Studio, id: string, type: string): Studio | null {
  return swap(studio, id, f => {
    const t = fixtureType(f.kind, type);
    if (!t) return null;
    if (t.id === f.type) return f;
    const keep = (key: 'width' | 'height') => t.limits[key][0] <= f[key] && f[key] <= t.limits[key][1] ? f[key] : t.size[key];
    return { ...f, type: t.id, width: keep('width'), depth: t.size.depth, height: keep('height') };
  });
}

/** Sets a finish (ceramic, metal or cabinet front) or where a basin's tap is. The first finish of a group is stored as absent. */
export function setFixtureLook(studio: Studio, id: string, look: Partial<Pick<StudioFixture, 'ceramic' | 'metal' | 'front' | 'tap'>>): Studio | null {
  return swap(studio, id, f => {
    const next: Record<string, unknown> = { ...f, ...look };
    for (const [k, v] of Object.entries(look)) if (v === undefined) delete next[k];
    return next as unknown as StudioFixture;
  });
}

export function removeFixture(studio: Studio, id: string): Studio | null {
  return studio.fixtures?.some(f => f.id === id) ? withFixtures(studio, studio.fixtures.filter(f => f.id !== id)) : null;
}

/** After corners move, fixtures stay where they were in the room, sliding only as far as needed to stay on a wall
 * that got shorter. */
export function keepFixtures(before: Studio, corners: readonly StudioCorner[]): StudioFixture[] | undefined {
  if (!before.fixtures) return undefined;
  const after = { ...before, corners };
  return before.fixtures.map(f => {
    const w = wall(before, f.wall), old = w && wallLine(before, w), now = w && wallLine(after, w), face = w && wallFace(after, w);
    if (!old || !now || !face) return f;
    const x = old.a.x + old.ux * f.offset, z = old.a.z + old.uz * f.offset, along = (x - now.a.x) * now.ux + (z - now.a.z) * now.uz;
    const min = face.start + f.width / 2, max = face.end - f.width / 2;
    return { ...f, offset: round(max < min ? along : Math.min(max, Math.max(min, along))) };
  });
}

/** Splitting a wall at `d` along it: fixtures go with the part their middle is on. */
export function splitFixtures(studio: Studio, wallId: string, second: string, d: number): StudioFixture[] | undefined {
  return studio.fixtures?.map(f => f.wall !== wallId || f.offset < d ? f : { ...f, wall: second, offset: round(f.offset - d) });
}

/** Fixtures left once walls are gone: those on a removed wall go with it. */
export const fixturesOnWalls = (studio: Studio, walls: ReadonlySet<string>) => studio.fixtures?.filter(f => walls.has(f.wall));

/** How far its side is from the inside end of its wall on the `left` (corner a) or `right`, as a tape reads it. */
export function fixtureFromEnd(studio: Studio, f: StudioFixture, side: 'left' | 'right'): number | null {
  const w = wall(studio, f.wall), face = w && wallFace(studio, w);
  if (!face) return null;
  return side === 'left' ? f.offset - f.width / 2 - face.start : face.end - f.offset - f.width / 2;
}
