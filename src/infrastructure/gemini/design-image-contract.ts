import { z } from 'zod';
import { materialsSchema } from '../serialization/materials-schema';
import { selectedDecors } from '../../application/projects/selected-decors';
import { IMAGE_VIEWS, DESIGN_REFERENCE_WIDTH, DESIGN_REFERENCE_HEIGHT } from '../../application/projects/design-image.ts';
import { renderCategory } from '../../application/projects/configuration-summary.ts';
import { FITTINGS } from '../../domain/wardrobe/fittings.ts';
import { PURPOSES } from '../../domain/wardrobe/purposes.ts';
import { FIN } from '../../domain/wardrobe/catalog.js';
import type { Wardrobe } from '../../domain/wardrobe/wardrobe.ts';

export const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
// A flat character check avoids regular-expression stack overflow on multi-megabyte images.
const base64 = (max: number) => z.string().min(4).max(max).regex(/^[A-Za-z0-9+/]*={0,2}$/).refine(value => value.length % 4 === 0);
export const imageData = base64(6 * 1024 * 1024);
// Allow generated-image base64 overhead independently of the smaller reference-image limit.
export const generatedImageData = base64(72 * 1024 * 1024);
const finish = z.enum(Object.keys(FIN) as [Wardrobe['finish'], ...Wardrobe['finish'][]]);
const coordinate = z.number().finite();
const dimensions = z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() });
const specification = z.looseObject({
  schemaVersion: z.literal(1), units: z.literal('cm'),
  design: z.looseObject({ furniture: z.array(z.looseObject({
    name: z.string().max(200), product: z.literal('kitchen').optional(), finish, doors: z.enum(['none', 'solid', 'glass']),
    materials: materialsSchema.optional(),
    dimensions, position: z.object({ x: coordinate, y: coordinate, z: coordinate }), rotation: coordinate,
    sections: z.array(z.looseObject({
      width: z.number().positive(),
      items: z.array(z.looseObject({
        kind: z.enum(FITTINGS.map(fitting => fitting.key)), width: z.number().positive(), height: z.number().nonnegative(),
        x: coordinate, y: coordinate, boxes: z.number().int().nonnegative().nullable(),
        purpose: z.enum(PURPOSES.map(purpose => purpose.key)).optional(), frontFacing: z.boolean().optional(),
        editorItem: z.looseObject({ f: finish.nullable().optional() }).optional(),
      })).max(1000),
      dividers: z.array(z.looseObject({ orientation: z.enum(['horizontal', 'vertical']), x: coordinate, y: coordinate, length: z.number().positive() })).max(1000),
    })).min(1).max(100),
  })).min(1).max(100), studio: z.looseObject({ walls: z.array(z.looseObject({
    id: z.string().max(200), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), finish: z.enum(['matte', 'eggshell', 'satin']).optional(),
  })).max(1000) }).optional() }),
  technicalDrawings: z.array(z.json()).max(1000),
}).refine(value => JSON.stringify(value).length <= 2 * 1024 * 1024, 'Design specification is too large');
export const designImageRequestSchema = z.strictObject({
  specification,
  renderConfig: z.strictObject({
    category: z.enum(['wardrobe', 'kitchen']), stagingLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    hasIntegratedLed: z.boolean().optional(), hasCeilingBulkhead: z.boolean().optional(),
  }).optional(),
  references: z.array(z.strictObject({
    view: z.enum(IMAGE_VIEWS), mimeType: z.literal('image/jpeg'), data: imageData,
    width: z.literal(DESIGN_REFERENCE_WIDTH), height: z.literal(DESIGN_REFERENCE_HEIGHT),
    camera: z.strictObject({ position: z.array(z.number().finite()).length(3), target: z.array(z.number().finite()).length(3), fov: z.number().positive().max(120) }),
  })).length(3).refine(images => IMAGE_VIEWS.every(view => images.some(image => image.view === view)), 'Three distinct views are required'),
  decorSwatches: z.array(z.strictObject({ decorId: z.string().max(100), mimeType: z.enum(['image/webp', 'image/jpeg', 'image/png']),
    data: base64(1400000) })).max(8).optional(),
}).refine(input => !input.renderConfig || input.renderConfig.category === renderCategory(input.specification), 'Render category must match the configured furniture')
  .refine(input => {
    const selected = new Set(selectedDecors(input.specification).filter(({ sku }) => sku.pbr.textureUrl).map(({ sku }) => sku.id));
    const ids = input.decorSwatches?.map(swatch => swatch.decorId) ?? [];
    return new Set(ids).size === ids.length && ids.every(id => selected.has(id));
  }, 'Swatches must reference distinct selected catalog decors with verified textures');
export function parseDesignImageRequest(value: unknown) {
  const parsed = designImageRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
