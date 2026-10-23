import { z } from 'zod';

const point = z.strictObject({ t: z.number().finite(), y: z.number().finite() });
export const profileSolidSchema = z.strictObject({
  loops: z.array(z.array(z.number().int().nonnegative()).min(3)).min(1),
  rings: z.array(z.strictObject({ u: z.number().finite().min(0).max(1), points: z.array(point).min(3) })).min(2),
  controls: z.array(z.strictObject({
    id: z.string().min(1), point: z.number().int().nonnegative(), u: z.number().finite().min(0).max(1), scope: z.enum(['profile', 'section']),
  })),
});
