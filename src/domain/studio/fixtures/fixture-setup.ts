/**
 * How a fixture is fitted, as one choice: its type and the boxing behind it ("wall-hung, in a half-height boxing").
 * The boxing is a part of the room (a floor-standing shape on the wall, edited like any other), so choosing a setup
 * builds, raises, lowers or removes it, and the fixture stands against whatever is there. A boxing that another
 * fixture stands against too is shared construction: it is never removed for one of them. Centimetres.
 */
import { nextId, roomHeight, wall, wallFace } from '../studio';
import type { Studio, StudioCeiling, StudioFixture } from '../studio';
import { ceilingAt, ceilingFrame } from '../studio-ceiling';
import { BOXING, fixtureKind } from './fixture-kinds';
import type { Boxing, FixtureSetup } from './fixture-kinds';
import { boxingBehind } from './fixture-place';
import { setFixtureType } from './fixture-edit';

const round = (n: number) => Math.round(n * 10) / 10;
type Part = Pick<StudioCeiling, 'outline' | 'profile'>;
/** A shape that stands on the floor (a boxing, a pillar), not one hung from the ceiling. */
export const standsOnFloor = (c: Part) => !!c.outline && Math.min(...c.outline.map(p => p.y)) < 1;
const topOf = (c: Part) => Math.max(...(c.outline ?? c.profile).map(p => p.y));
/** Along the wall, where a shape starts and ends. */
const spanOf = (c: Part) => { const ts = (c.outline ?? c.profile).map(p => p.t); return { from: Math.min(...ts), to: Math.max(...ts) }; };

/** How high a full-height boxing goes over [from, to] along a wall: up to the lowest ceiling over it, not counting
 * shapes that stand on the floor (`except` the boxing itself). */
function ceilingOver(studio: Studio, wallId: string, from: number, to: number, except?: string) {
  const hung = { ...studio, ceilings: (studio.ceilings ?? []).filter(c => c.id !== except && !standsOnFloor(c)) };
  const w = wall(studio, wallId);
  if (!w) return roomHeight(studio);
  const probe: StudioCeiling = { id: '-', wall: wallId, run: 'along', depth: BOXING.depth, profile: [{ t: from, y: 0 }, { t: to, y: 0 }] };
  const frame = ceilingFrame(studio, probe);
  if (!frame) return roomHeight(studio);
  return Math.min(...[from + 1, (from + to) / 2, to - 1].map(s => ceilingAt(hung, frame.at(s, BOXING.depth / 2))));
}

/** Fixtures standing against a shape. */
export const standingAgainst = (studio: Studio, shapeId: string) => (studio.fixtures ?? []).filter(f => boxingBehind(studio, f)?.id === shapeId);

/** The setup a fixture is in now, read from its type and what stands behind it, so it always says what the room is. */
export function currentSetup(studio: Studio, f: StudioFixture): FixtureSetup | undefined {
  const setups = fixtureKind(f.kind)?.setups?.filter(s => s.type === f.type) ?? [];
  if (setups.length <= 1) return setups[0];
  const host = boxingBehind(studio, f), grounded = host && standsOnFloor(host);
  const kind: Boxing = !grounded ? 'none' : topOf(host) >= ceilingOver(studio, f.wall, spanOf(host).from, spanOf(host).to, host.id) - 1 ? 'full'
    : topOf(host) < (BOXING.low + BOXING.half) / 2 ? 'low' : 'half';
  return setups.find(s => s.boxing === kind) ?? setups.find(s => (s.boxing === 'none') === (kind === 'none')) ?? setups[0];
}

/** The same shape with its top at `height`: points at its old top move there, any above it come down to it. */
function withTop(c: StudioCeiling, height: number): StudioCeiling {
  const top = topOf(c), y = (p: { y: number }) => Math.abs(p.y - top) < 1e-6 ? height : Math.min(p.y, height);
  return { ...c, outline: c.outline!.map(p => ({ ...p, y: round(y(p)) })), ...(c.section ? { section: c.section.map(p => ({ ...p, y: round(y(p)) })) } : {}) };
}

/** Where a new boxing for `f` runs along its wall: about 90 cm centred on it, never into a door, another shape or
 * the fixture beside it, and right up to a wall end it would otherwise leave a sliver short of. Null without room. */
function boxingSpan(studio: Studio, f: StudioFixture) {
  const w = wall(studio, f.wall), face = w && wallFace(studio, w);
  if (!face) return null;
  const half = Math.max(BOXING.width, f.width + 20) / 2;
  let from = Math.max(face.start, f.offset - half), to = Math.min(face.end, f.offset + half);
  const stops = [
    ...studio.openings.filter(o => o.wall === f.wall && o.sill < 1).map(o => ({ from: o.offset - o.width / 2 - 7, to: o.offset + o.width / 2 + 7 })),
    ...(studio.ceilings ?? []).filter(c => c.wall === f.wall && standsOnFloor(c)).map(spanOf),
    ...(studio.fixtures ?? []).filter(x => x.wall === f.wall && x.id !== f.id).map(x => ({ from: x.offset - x.width / 2, to: x.offset + x.width / 2 })),
  ];
  for (const s of stops) {
    if (s.to <= f.offset - f.width / 2 + 1e-6) from = Math.max(from, s.to);
    else if (s.from >= f.offset + f.width / 2 - 1e-6) to = Math.min(to, s.from);
  }
  if (from - face.start < BOXING.closeGap && !stops.some(s => s.to > face.start && s.from < from)) from = face.start;
  if (face.end - to < BOXING.closeGap && !stops.some(s => s.from < face.end && s.to > to)) to = face.end;
  return to - from >= Math.max(BOXING.minWidth, f.width) - 1e-6 ? { from: round(from), to: round(to) } : null;
}

/** Puts the boxing `want` behind a fixture: none, low, half or full height. Returns the room, and a note when a shared
 * boxing was kept; null when there is no room for one. */
export function withBoxing(studio: Studio, id: string, want: Boxing): { studio: Studio; note?: string } | null {
  const f = studio.fixtures?.find(x => x.id === id);
  if (!f) return null;
  const host = boxingBehind(studio, f), grounded = host && standsOnFloor(host) ? host : undefined;
  if (want === 'none') {
    if (!grounded) return { studio };
    const others = standingAgainst(studio, grounded.id).filter(x => x.id !== f.id);
    if (others.length) return { studio, note: `The boxing stays: the ${fixtureKind(others[0]!.kind)?.name.toLowerCase() ?? 'fixture'} stands against it too.` };
    return { studio: { ...studio, template: 'custom', ceilings: studio.ceilings!.filter(c => c.id !== grounded.id) } };
  }
  const span = grounded ? spanOf(grounded) : boxingSpan(studio, f);
  if (!span) return null;
  const height = round(want === 'full' ? ceilingOver(studio, f.wall, span.from, span.to, grounded?.id) : BOXING[want]);
  if (grounded) return { studio: { ...studio, template: 'custom', ceilings: studio.ceilings!.map(c => c === grounded ? withTop(c, height) : c) } };
  const boxing: StudioCeiling = { id: nextId('k', studio.ceilings ?? []), wall: f.wall, run: 'along', depth: BOXING.depth,
    outline: [{ t: span.from, y: 0 }, { t: span.to, y: 0 }, { t: span.to, y: height }, { t: span.from, y: height }],
    profile: [{ t: span.from, y: 0 }, { t: span.to, y: 0 }] };
  return { studio: { ...studio, template: 'custom', ceilings: [...studio.ceilings ?? [], boxing] } };
}

/** Fits a fixture the way a setup says: its type, then the boxing behind it. Null when the setup is not its kind's. */
export function applySetup(studio: Studio, id: string, setupId: string): { studio: Studio; note?: string } | null {
  const f = studio.fixtures?.find(x => x.id === id), setup = f && fixtureKind(f.kind)?.setups?.find(s => s.id === setupId);
  const typed = setup && setFixtureType(studio, id, setup.type);
  return typed && setup ? withBoxing(typed, id, setup.boxing) : null;
}
