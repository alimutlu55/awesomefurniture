import { z } from 'zod';
import { FRONT_OVERLAYS, FRONT_REVEALS_MM, FRONT_STYLES, type DesignFronts } from '../../domain/wardrobe/front-styles';
import { HINGES } from '../../domain/wardrobe/hinges';

/**
 * A cabinet's fronts, as saved in a project and written in a design spec. The allowed values come from the front
 * registry (domain/wardrobe/front-styles.ts); how they combine (a style's overlays, leaf keys within the bays) is
 * `frontsProblems`, which both codecs run with the cabinet in hand.
 */
const oneOf = (what: string, keys: readonly (string | number)[]) =>
  ({ error: (issue: { input?: unknown }) => `Unknown ${what} ${JSON.stringify(issue.input)}: use ${keys.join(', ')}.` });

const leaf = z.strictObject({
  leaves: z.number().int().min(1).describe('How many leaves this opening is split into').optional(),
  hinge: z.enum(['left', 'right']).describe('The side the leaf hinges on').optional(),
  hingeKind: z.enum(HINGES.map(h => h.key) as [string, ...string[]], oneOf('hinge', HINGES.map(h => h.key)))
    .describe('The hinge it hangs on: ' + HINGES.map(h => `"${h.key}" (${h.name}: ${h.use.toLowerCase()})`).join(', ')).optional(),
  decor: z.string().describe('Its own front decor id (a glass or mirror leaf among wood ones); left out, the cabinet\'s front decor').optional(),
});

export const frontsSchema = z.strictObject({
  style: z.enum(FRONT_STYLES.map(s => s.key) as [string, ...string[]], oneOf('front style', FRONT_STYLES.map(s => s.key)))
    .describe('How the fronts are made: ' + FRONT_STYLES.map(s => `"${s.key}" (${s.name})`).join(', ')).optional(),
  overlay: z.enum(FRONT_OVERLAYS.map(o => o.key) as [string, ...string[]], oneOf('front overlay', FRONT_OVERLAYS.map(o => o.key)))
    .describe('How the fronts sit on the carcass: ' + FRONT_OVERLAYS.map(o => `"${o.key}" (${o.name})`).join(', ')).optional(),
  reveal: z.union(FRONT_REVEALS_MM.map(r => z.literal(r)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>], oneOf('reveal (mm)', FRONT_REVEALS_MM))
    .describe('The gap round each leaf, in millimetres: ' + FRONT_REVEALS_MM.join(', ')).optional(),
  leaves: z.record(z.string(), leaf).describe('Settings per door opening, keyed "bay.row" (bays from 0 on the left, rows from 0 at the bottom), or per leaf "bay.row.leaf"').optional(),
}).describe('The fronts: style, overlay, reveal and per-opening settings; leave out what should stay the default') as unknown as z.ZodType<DesignFronts>;
