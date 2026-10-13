import { z } from 'zod';
import { DESIGN_SPEC_VERSION, type DesignSpec } from '../../domain/spec/design-spec';
import { STUDIO_TEMPLATES } from '../../domain/studio/studio-templates';
import { CEILING_SHAPES } from '../../domain/studio/studio-ceiling';
import { SHAPE_TEMPLATES } from '../../domain/wardrobe/shape/shape-templates';
import { POSSESSIONS, POSSESSION_KEYS } from '../../domain/wardrobe/possessions';

/**
 * The design spec's shape (domain/spec/design-spec.ts), checked at the edge: by the editor before building,
 * and by a backend before storing, with the same rules. The allowed names come from the registries, so a new
 * room, ceiling shape, wardrobe shape or possession is accepted here without editing this file. The JSON
 * Schema published to agents (`designSpecJsonSchema`) is generated from the same definition, with every
 * field described, so tools and docs never drift from what is accepted.
 */
const names = <T extends { id: string; name: string; description: string }>(list: readonly T[]) => list.map(t => t.id) as [string, ...string[]];
const described = (list: readonly { id: string; name: string; description: string }[]) => list.map(t => `"${t.id}" (${t.description})`).join(', ');
const cm = (what: string) => z.number().finite().describe(what + ', in centimetres');
const wall = z.number().int().min(1).describe('A wall by number: 1 is the back (the wardrobe wall), then 2 right, 3 front, 4 left');

const opening = z.strictObject({
  wall,
  kind: z.enum(['door', 'window', 'archway']),
  width: cm('Width').positive().optional(),
  height: cm('Height').positive().optional(),
  sill: cm("A window's sill height above the floor").min(0).optional(),
  from: cm("From the wall's left end (as you face it from inside) to the opening's left edge; centred when left out").min(0).optional(),
});

const room = z.strictObject({
  template: z.enum(names(STUDIO_TEMPLATES)).describe('A built-in room: ' + described(STUDIO_TEMPLATES)).optional(),
  width: cm('Inside width of a rectangular room (along walls 1 and 3)').positive().optional(),
  depth: cm('Inside depth of a rectangular room (along walls 2 and 4)').positive().optional(),
  height: cm('Wall height, where the flat ceiling is').positive().optional(),
  thickness: cm('Wall thickness').positive().optional(),
  openings: z.array(opening).optional(),
}).describe('The room: a built-in one by name, or a rectangle by width and depth');

const ceiling = z.strictObject({
  wall,
  shape: z.enum(names(CEILING_SHAPES)).describe('What comes down from the ceiling along this wall: ' + described(CEILING_SHAPES)),
  points: z.array(z.tuple([cm('From the wall\'s left end inside (from the wall, for a sloped ceiling)'), cm('Height of the underside above the floor')]))
    .min(2).describe('Its own profile, left to right, instead of the shape\'s; two points at one position make a vertical step').optional(),
  depth: cm('How far it reaches into the room from the wall').positive().optional(),
});

const needs = z.strictObject(Object.fromEntries(POSSESSIONS.map(p => [p.key, z.number().int().min(0).max(p.need.max).describe(p.label).optional()])))
  .describe('What it should hold, by item: ' + POSSESSION_KEYS.join(', '));

const wardrobe = z.strictObject({
  against: wall.describe('The wall it stands against; without it, it stands on the open floor beside the others').optional(),
  fill: z.boolean().describe("Fill the wall's free stretch, as wide as it allows (the default when no width is given)").optional(),
  from: cm("From the wall's left end inside to the wardrobe's left side").min(0).optional(),
  width: cm('Width').optional(),
  height: cm('Height').optional(),
  depth: cm('Depth').optional(),
  shape: z.enum(names(SHAPE_TEMPLATES)).describe('Its top: ' + described(SHAPE_TEMPLATES) + '. Under a ceiling that comes down, it follows the ceiling').optional(),
  for: needs.optional(),
  autoDesign: z.boolean().describe('Plan its fittings with Auto design (on by default when "for" is given)').optional(),
});

export const designSpecSchema = z.strictObject({
  specVersion: z.literal(DESIGN_SPEC_VERSION),
  name: z.string().trim().min(1).max(120).optional(),
  room: room.optional(),
  ceilings: z.array(ceiling).optional(),
  wardrobes: z.array(wardrobe).max(20).optional(),
}).describe('A wardrobe design described by its result: the room, what comes down from its ceiling, and the wardrobes');

/** Checks a spec; throws with every problem, each with its path. */
export function parseDesignSpec(value: unknown): DesignSpec {
  const result = designSpecSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.') || 'spec'}: ${i.message}`).join('\n'));
  return result.data as DesignSpec;
}

/** The spec's JSON Schema, for agents' tool definitions and for a backend's validation. */
export const designSpecJsonSchema = () => z.toJSONSchema(designSpecSchema);
