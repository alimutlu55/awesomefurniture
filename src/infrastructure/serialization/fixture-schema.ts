import { z } from 'zod';
import { FIXTURE_CATALOG } from '../../domain/studio/fixtures/fixture-catalog';

const id = z.string().trim().min(1), finite = z.number().finite(), positive = finite.min(.5).max(500);
const color = z.string().regex(/^#[0-9a-f]{6}$/i), status = z.enum(['new', 'existing']);
const floor = z.strictObject({ kind: z.literal('floor'), x: finite, z: finite, y: finite.nonnegative(), angle: finite });
const wall = z.strictObject({ kind: z.literal('wall'), wall: id, offset: finite, y: finite.nonnegative(), gap: finite.nonnegative() });
export const fixtureAnchorSchema = z.discriminatedUnion('kind', [floor, wall,
  z.strictObject({ kind: z.literal('enclosure'), enclosure: id, offset: finite, y: finite.nonnegative() }),
  z.strictObject({ kind: z.literal('fixture'), fixture: id, x: finite, z: finite, lift: finite.nonnegative() }),
]);
export const fixtureSchema = z.strictObject({
  id, kind: z.enum(FIXTURE_CATALOG.map(f => f.key) as [typeof FIXTURE_CATALOG[number]['key'], ...typeof FIXTURE_CATALOG[number]['key'][]]),
  variant: id, w: positive, h: positive, d: positive, color, anchor: fixtureAnchorSchema, status, assembly: id.optional(),
  installation: z.strictObject({ w: positive, h: positive, d: positive, access: z.enum(['front', 'top']) }).optional(),
  connections: z.array(z.strictObject({ role: id, utility: id })).optional(),
});
export const enclosureSchema = z.strictObject({
  id, name: id, anchor: z.discriminatedUnion('kind', [floor, wall]), w: finite.min(.5).max(2000), h: positive, d: positive,
  lining: finite.nonnegative(), color, sideColor: color, topColor: color,
  finish: z.enum(['paint', 'tile', 'panel']), form: z.enum(['boxing', 'module']), status, generatedFor: id.optional(),
});
