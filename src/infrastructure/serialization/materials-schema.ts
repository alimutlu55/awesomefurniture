import { z } from 'zod';
import { decorCatalog } from '../../domain/materials/decor-catalog';
import { HANDLE_FINISHES, ACCESSORY_FINISHES } from '../../domain/materials/configured-materials';

const decorId = (zone: 'carcass' | 'fronts' | 'worktop') => z.string().refine(
  id => decorCatalog.some(sku => sku.id === id && sku.allowedZones.includes(zone)), `Unknown or incompatible ${zone} board SKU`);
/** Resolve manufacturer metadata server-side: clients send IDs, never arbitrary descriptors or texture URLs. */
export const materialsSchema = z.strictObject({
  carcassDecorId: decorId('carcass'), frontDecorId: decorId('fronts'),
  handleFinish: z.enum(HANDLE_FINISHES), internalAccessoryFinish: z.enum(ACCESSORY_FINISHES),
  worktopDecorId: decorId('worktop').optional(), linkedDecors: z.boolean().optional(),
}).refine(m => !m.linkedDecors || m.carcassDecorId === m.frontDecorId, 'Linked board selections must match');
