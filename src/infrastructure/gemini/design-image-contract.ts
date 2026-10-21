import { z } from 'zod';
import { IMAGE_VIEWS } from '../../application/projects/design-image.ts';

export const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
// A flat character check avoids regular-expression stack overflow on multi-megabyte images.
const base64 = (max: number) => z.string().min(4).max(max).regex(/^[A-Za-z0-9+/]*={0,2}$/).refine(value => value.length % 4 === 0);
export const imageData = base64(6 * 1024 * 1024);
// Allow base64 overhead for a detailed 4K PNG, independently of the smaller reference-image limit.
export const generatedImageData = base64(72 * 1024 * 1024);
const specification = z.looseObject({
  schemaVersion: z.literal(1), units: z.literal('cm'),
  design: z.looseObject({ furniture: z.array(z.looseObject({
    dimensions: z.object({ width: z.number().positive(), height: z.number().positive(), depth: z.number().positive() }),
    sections: z.array(z.json()).max(100),
  })).min(1).max(100) }),
  technicalDrawings: z.array(z.json()).max(1000),
}).refine(value => JSON.stringify(value).length <= 2 * 1024 * 1024, 'Design specification is too large');
export const designImageRequestSchema = z.strictObject({
  specification,
  references: z.array(z.strictObject({
    view: z.enum(IMAGE_VIEWS), mimeType: z.literal('image/jpeg'), data: imageData,
    width: z.literal(1440), height: z.literal(1080),
    camera: z.strictObject({ position: z.array(z.number().finite()).length(3), target: z.array(z.number().finite()).length(3), fov: z.number().positive().max(120) }),
  })).length(3).refine(images => IMAGE_VIEWS.every(view => images.some(image => image.view === view)), 'Three distinct views are required'),
});
export function parseDesignImageRequest(value: unknown) {
  const parsed = designImageRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
