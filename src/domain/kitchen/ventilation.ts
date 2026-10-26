import type { EditorDesign } from '../wardrobe/editor-design';
import { plinthOf } from '../wardrobe/carcass';
import { KITCHEN_PLINTH_SETBACK } from './kitchen-units';

/** Configured grille OUTER envelope, centred in the plinth. Free area and the required cut-out are separate supplier data. */
export function ventilationGrille(d: Pick<EditorDesign, 'w' | 'd' | 'product' | 'unit' | 'plinthHeight' | 'ventilationWidth' | 'ventilationHeight'>) {
  const w = d.ventilationWidth ?? 0, h = d.ventilationHeight ?? 0, plinth = plinthOf(d);
  if (d.product !== 'kitchen' || !(w > 0 && h > 0 && w <= d.w && h <= plinth)) return undefined;
  return { x0: (d.w - w) / 2, x1: (d.w + w) / 2, y0: (plinth - h) / 2, y1: (plinth + h) / 2,
    z: d.d - KITCHEN_PLINTH_SETBACK, width: w, height: h };
}
