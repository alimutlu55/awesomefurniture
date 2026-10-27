import { unitAxes, type UnitPose } from './kitchen-runs';
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

/** The physical board of an installation component, in scene coordinates. Its reserved envelope is
 * deliberately deeper than a front strip's actual stock; clash checks must use the stock bounds. */
export function installationSolid(p: UnitPose & { state: UnitPose['state'] & Partial<Pick<EditorDesign, 'frontThickness' | 'fin' | 'shape'>> }) {
  const slab = installationSlab({ ...p.state, fin: p.state.fin ?? 'White' });
  if (!slab) return { id: p.id, x: p.x, y: p.y ?? 0, z: p.z, angle: p.angle, state: { w: p.state.w, h: p.state.h, d: p.state.d } };
  return localSolid(p, slab);
}

/** Project one physical board, measured from the cabinet's left/back/bottom faces, into scene space. */
export function localSolid(p: UnitPose, slab: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }) {
  const { u, v } = unitAxes(p.angle), along = (slab.x0 + slab.x1) / 2 - p.state.w / 2, across = (slab.z0 + slab.z1) / 2 - p.state.d / 2;
  return { id: p.id, x: p.x + u.x * along + v.x * across, y: (p.y ?? 0) + slab.y0,
    z: p.z + u.z * along + v.z * across, angle: p.angle,
    state: { w: slab.x1 - slab.x0, h: slab.y1 - slab.y0, d: slab.z1 - slab.z0 } };
}
