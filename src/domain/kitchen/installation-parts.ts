import { plinthOf } from '../wardrobe/carcass';
import { installationKind } from './kitchen-units';
import { PANEL } from '../wardrobe/catalog.js';
import { getDecor } from '../materials/decor-catalog';
import { resolveMaterials } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';

/** Cabinet-local centimetres. The envelope reserves the exact installation width; only this slab is cut.
 * A strip occupies the front of that envelope, an end panel its full depth. Neither has a carcass. */
export function installationSlab(d: Pick<EditorDesign, 'product' | 'unit' | 'w' | 'h' | 'd' | 'materials' | 'fin' | 'plinthHeight' | 'frontThickness' | 'shape'>) {
  const kind = installationKind(d);
  if (!kind) return undefined;
  const thickness = kitchenFrontThickness(d);
  return { name: kind === 'filler' ? 'Installation strip' : 'End/Separator pane',
    stock: kind === 'filler' ? 'front' as const : 'carcass' as const,
    x0: 0, x1: d.w, y0: kind === 'filler' ? Math.min(plinthOf(d), d.h - .1) : 0, y1: d.h,
    z0: kind === 'filler' ? d.d : 0, z1: kind === 'filler' ? d.d + thickness : d.d,
    cut: { length: d.h - (kind === 'filler' ? Math.min(plinthOf(d), d.h - .1) : 0),
      width: kind === 'filler' ? d.w : d.d, thickness: kind === 'filler' ? thickness : d.w },
    edges: 'L2 W2', note: d.shape ? 'Cut top to inherited front/rear side profile; dimensions are the enclosing blank' : 'Exact installed size; no automatic scribing or trimming allowance' };
}

/** Exact front stock thickness; shared by the slab renderer, construction details and cutting list. */
export const kitchenFrontThickness = (d: Pick<EditorDesign, 'materials' | 'fin' | 'frontThickness' | 'shape'>) =>
  d.frontThickness ?? (d.materials ? getDecor(resolveMaterials(d).frontDecorId).thicknessMm / 10 : PANEL);
