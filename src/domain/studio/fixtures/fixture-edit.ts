/**
 * Fixture edits. Each takes a studio and returns the edited copy, or null when the edit does not apply. They do not
 * validate: the caller checks studioProblems() and refuses an invalid result with its reason. Centimetres.
 */
import { nextId, wall, wallFace } from '../studio';
import type { Studio, StudioCorner, StudioFixture } from '../studio';
import { fixtureKind, fixtureType } from './fixture-kinds';
import { Fixture } from '../../pieces/fixture-piece';
import { changePieceLook, roundPiece as round } from '../../pieces/piece';
import type { WallChange } from '../../pieces/piece-model';

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
  return swap(studio, id, f => new Fixture(f).withSize(size));
}

export function setFixtureType(studio: Studio, id: string, type: string): Studio | null {
  return swap(studio, id, f => new Fixture(f).withType(type));
}

/** Sets a finish or a basin's tap. Absent finish values use the registry's default. */
export function setFixtureLook(studio: Studio, id: string, look: Partial<Pick<StudioFixture, 'ceramic' | 'metal' | 'front' | 'tap'>>): Studio | null {
  return swap(studio, id, f => changePieceLook<StudioFixture>(f, look));
}

export function setFixtureFinish(studio: Studio, id: string, group: string, choice: string): Studio | null {
  return swap(studio, id, f => new Fixture(f).withFinish(group, choice));
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
    const placement = new Fixture(f).followRoom(before, after);
    return placement ? { ...f, offset: placement.offset } : f;
  });
}

export function followFixtures(before: Studio, after: Studio, split?: WallChange): StudioFixture[] | undefined {
  return before.fixtures?.flatMap(f => {
    const placement = new Fixture(f).followRoom(before, after, split);
    return placement ? [{ ...f, wall: placement.wall, offset: placement.offset }] : [];
  });
}

/** How far its side is from the inside end of its wall on the `left` (corner a) or `right`, as a tape reads it. */
export function fixtureFromEnd(studio: Studio, f: StudioFixture, side: 'left' | 'right'): number | null {
  const w = wall(studio, f.wall), face = w && wallFace(studio, w);
  if (!face) return null;
  return side === 'left' ? f.offset - f.width / 2 - face.start : face.end - f.offset - f.width / 2;
}
