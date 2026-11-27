import { z } from 'zod';
import { FINISHES, FIXTURE_KEYS, TAPS } from '../../domain/studio/fixtures/fixture-kinds';
import { FURNISHING_FINISHES, FURNISHING_KEYS } from '../../domain/studio/furnishings/furnishing-kinds';

const ids = (list: readonly { readonly id: string }[]) => z.enum(list.map(x => x.id) as [string, ...string[]]);
const finite = z.number().finite();

/** A saved fixture: kinds, finishes and taps come from the registry, so a new entry is accepted with no edit here.
 * Its type, sizes and place are checked with the room (studioProblems), by the same rules the editor uses. */
export const fixtureSchema = z.strictObject({
  id: z.string().trim().min(1),
  wall: z.string().trim().min(1),
  kind: z.enum(FIXTURE_KEYS as unknown as [string, ...string[]]),
  type: z.string().trim().min(1),
  offset: finite,
  width: finite.positive(),
  depth: finite.positive(),
  height: finite.positive(),
  ceramic: ids(FINISHES.ceramic).optional(),
  metal: ids(FINISHES.metal).optional(),
  front: ids(FINISHES.front).optional(),
  tap: ids(TAPS).optional(),
});

/** A saved furnishing (a bed, a rug): kinds and finishes come from the registry. Its type, sizes and place are checked
 * with the room (studioProblems). */
export const furnishingSchema = z.strictObject({
  id: z.string().trim().min(1),
  kind: z.enum(FURNISHING_KEYS as unknown as [string, ...string[]]),
  type: z.string().trim().min(1),
  x: finite,
  z: finite,
  angle: finite,
  width: finite.positive(),
  depth: finite.positive(),
  height: finite.positive(),
  fabric: ids(FURNISHING_FINISHES.fabric).optional(),
  wood: ids(FURNISHING_FINISHES.wood).optional(),
});
