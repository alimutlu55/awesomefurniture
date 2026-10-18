import type { StudioOpening } from '../studio/studio';
import { mm } from './drawing';

const KIND: Record<StudioOpening['kind'], string> = { door: 'Door', window: 'Window', archway: 'Archway' };

/** An opening as an architect writes it beside the opening: what it is, width × height, and its sill above the
 * floor, in millimetres ("Window 2940 × 2350, sill 0"). */
export const openingNote = (o: StudioOpening) => KIND[o.kind] + ' ' + mm(o.width) + ' × ' + mm(o.height) + (o.kind === 'window' ? ', sill ' + mm(o.sill) : '');
