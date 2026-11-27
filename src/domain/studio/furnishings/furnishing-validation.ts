/**
 * Why a furnishing cannot be where it is, worded as what to do about it. The same rules hold for adding, dragging,
 * turning, typing a size and every wall edit: a bed never stands in a wall, a pillar, a toilet or another bed. A rug
 * lies under things, so only the walls stop it. Wardrobes are checked by the commands, which know them. Centimetres.
 */
import type { Studio, StudioFurnishing } from '../studio';
import { createCabinetGeometry } from '../../geometry/cabinet-geometry.js';
import { FURNISHING_FINISHES, furnishingKind, furnishingType } from './furnishing-kinds';
import { furnishingSolid, isFlat } from './furnishing-place';
import type { Obstacle } from '../studio-obstacles';

const EPS = .01;
export const furnishingNoun = (f: Pick<StudioFurnishing, 'kind'>) => furnishingKind(f.kind)?.name.toLowerCase() ?? 'furnishing';

/** What is wrong with one furnishing on its own. */
export function furnishingProblems(f: StudioFurnishing): string[] {
  const kind = furnishingKind(f.kind), type = furnishingType(f.kind, f.type);
  if (!kind || !type) return ['Choose a piece of furniture from the catalogue.'];
  const name = furnishingNoun(f), out: string[] = [];
  for (const key of ['width', 'depth', 'height'] as const) {
    const [min, max] = type.limits[key], v = f[key];
    if (!Number.isFinite(v) || v < min - EPS || v > max + EPS) out.push(`The ${name}'s ${kind.labels[key].toLowerCase()} must be ${min}–${max} cm.`);
  }
  if (![f.x, f.z, f.angle].every(Number.isFinite)) out.push(`Place the ${name} on the floor again.`);
  for (const group of ['fabric', 'wood'] as const) {
    const id = f[group];
    if (id !== undefined && (!(kind.finishes as readonly string[]).includes(group) || !FURNISHING_FINISHES[group].some(x => x.id === id))) out.push(`Choose a ${name} finish from the list.`);
  }
  return out;
}

/** Furnishings that run into a wall, a shape standing on the floor, a fixture or each other: each clash once. */
export function furnishingClashes(studio: Studio, walls: readonly Obstacle[], shapes: readonly Obstacle[], fixtures: readonly Obstacle[]): string[] {
  const list = studio.furnishings ?? [];
  // Shrunk a little: a bed standing flush against a wall touches it, which is fine.
  const shrink = (o: Obstacle): Obstacle => ({ ...o, y: o.y + .05, state: { w: o.state.w - .2, d: o.state.d - .2, h: Math.max(.05, o.state.h - .1) } });
  const geometry = createCabinetGeometry(() => []), out: string[] = [];
  const standing = list.filter(f => !isFlat(f)).map(f => ({ f, solid: shrink(furnishingSolid(f)) }));
  for (const f of list) {
    const me = shrink(furnishingSolid(f)), name = furnishingNoun(f);
    if (walls.some(o => geometry.cabinetOverlaps(me, o))) { out.push(`The ${name} runs into a wall. Move it into the room.`); continue; }
    if (isFlat(f)) continue;
    if (shapes.some(o => geometry.cabinetOverlaps(me, o))) out.push(`The ${name} runs into a pillar or boxing. Move it.`);
    else if (fixtures.some(o => geometry.cabinetOverlaps(me, o))) out.push(`The ${name} runs into a toilet or basin. Move it.`);
    const other = standing.find(o => o.f.id < f.id && geometry.cabinetOverlaps(me, o.solid));
    if (other) out.push(`The ${name} and the ${furnishingNoun(other.f)} overlap. Move one of them.`);
  }
  return out;
}
