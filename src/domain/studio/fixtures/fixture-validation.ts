/**
 * Why a fixture cannot be where it is, worded as what to do about it. The same rules hold for adding, dragging,
 * typing a size and every wall edit: a toilet never stands in a doorway, under a window sill, in a wall or in
 * another fixture. Centimetres.
 */
import { wall, wallFace } from '../studio';
import type { Studio, StudioFixture } from '../studio';
import { createCabinetGeometry } from '../../geometry/cabinet-geometry.js';
import { FINISHES, TAPS, fixtureKind, fixtureType } from './fixture-kinds';
import type { FinishGroup } from './fixture-kinds';
import { fixturePlace } from './fixture-place';
import { isWallUtility } from '../wall-utilities';
import type { Obstacle } from '../studio-obstacles';

const EPS = .01;
const noun = (f: StudioFixture) => fixtureKind(f.kind)?.name.toLowerCase() ?? 'fixture';
const range = (label: string, [min, max]: readonly [number, number], v: number, name: string) =>
  !Number.isFinite(v) || v < min - EPS || v > max + EPS ? [`The ${name}'s ${label} must be ${min}–${max} cm.`] : [];

/** What is wrong with one fixture on its own wall. */
export function fixtureProblems(studio: Studio, f: StudioFixture): string[] {
  const kind = fixtureKind(f.kind), type = fixtureType(f.kind, f.type);
  if (!kind || !type) return ['Choose a fixture from the catalogue.'];
  const name = noun(f), w = wall(studio, f.wall), face = w && wallFace(studio, w);
  if (!w || !face) return [`A ${name} is on a wall that no longer exists.`];
  const out = [
    ...range('width', type.limits.width, f.width, name),
    ...range('depth', type.limits.depth, f.depth, name),
    ...range(kind.height.label.toLowerCase(), type.limits.height, f.height, name),
  ];
  for (const group of ['ceramic', 'metal', 'front'] as const satisfies readonly FinishGroup[]) {
    const id = f[group];
    if (id !== undefined && (!kind.finishes.includes(group) || !FINISHES[group].some(x => x.id === id))) out.push(`Choose a ${name} finish from the list.`);
  }
  if (f.tap !== undefined && (!kind.tap || !TAPS.some(t => t.id === f.tap))) out.push(`Choose where the ${name}'s tap goes from the list.`);
  if (!Number.isFinite(f.offset) || f.offset - f.width / 2 < face.start - EPS || f.offset + f.width / 2 > face.end + EPS) {
    out.push(`Keep the ${name} on its wall. Move it along the wall or make it narrower.`);
  }
  const { bottom, top } = type.extent(f), from = f.offset - f.width / 2, to = f.offset + f.width / 2;
  for (const o of studio.openings.filter(o => o.wall === f.wall && !isWallUtility(o.kind))) {
    const across = Math.min(to, o.offset + o.width / 2) - Math.max(from, o.offset - o.width / 2) > EPS;
    if (!across || top <= o.sill + EPS || bottom >= o.sill + o.height - EPS) continue;
    out.push(o.sill < 1 ? `A ${name} cannot stand in a ${o.kind === 'door' ? 'doorway' : 'archway'}. Move it along the wall.`
      : `The ${name} would cover the window. Move it along the wall or lower it.`);
  }
  return out;
}

/** Fixtures that run into a wall, a shape on the floor or another fixture: each clash once, worded for its fixture. */
export function fixtureClashes(studio: Studio, walls: readonly Obstacle[], shapes: readonly Obstacle[]): string[] {
  const placed = (studio.fixtures ?? []).flatMap(f => { const p = fixturePlace(studio, f); return p ? [{ f, solid: p.solid }] : []; });
  // Shrunk a little: a fixture standing flush against a wall or a boxing touches it, which is fine.
  const shrink = (o: Obstacle): Obstacle => ({ ...o, y: o.y + .05, state: { w: o.state.w - .1, d: o.state.d - .1, h: o.state.h - .1 } });
  const geometry = createCabinetGeometry(() => []);
  const out: string[] = [];
  placed.forEach(({ f, solid }, i) => {
    const me = shrink(solid);
    if (walls.some(o => geometry.cabinetOverlaps(me, o))) out.push(`The ${noun(f)} runs into a wall. Move it along its wall.`);
    else if (shapes.some(o => geometry.cabinetOverlaps(me, o))) out.push(`The ${noun(f)} runs into a pillar or boxing. Move it along its wall.`);
    // Two fixtures never share floor, whatever their heights: a basin hung over a toilet is not usable.
    const plan = (o: Obstacle): Obstacle => ({ ...o, y: 0, state: { ...o.state, h: 1 } });
    const other = placed.slice(0, i).find(p => geometry.cabinetOverlaps(plan(me), plan(shrink(p.solid))));
    if (other) out.push(`The ${noun(f)} and the ${noun(other.f)} overlap. Move one of them along the wall.`);
  });
  return out;
}
