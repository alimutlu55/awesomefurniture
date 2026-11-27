/**
 * Why a furnishing cannot be where it is, worded as what to do about it. The same rules hold for adding, dragging,
 * turning, typing a size and every wall edit: a bed never stands in a wall, a pillar, a doorway, a toilet or another bed.
 * A rug lies under things, so only the walls stop it. Wardrobes are checked by the commands, which know them. Centimetres.
 */
import type { Studio, StudioFurnishing } from '../studio';
import { FURNISHING_FINISHES, furnishingKind, furnishingType } from './furnishing-kinds';
import { furnishingPiece, studioBodies } from '../../pieces/pieces';

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

/** Furnishings that run into a wall, a shape standing on the floor, a doorway, a fixture or each other: the rule every
 * piece shares (domain/pieces/piece.ts), here with the room's own pieces. */
export function furnishingClashes(studio: Studio): string[] {
  const room = { studio, bodies: studioBodies(studio) };
  return (studio.furnishings ?? []).flatMap(f => furnishingPiece(f).clashes(room));
}
