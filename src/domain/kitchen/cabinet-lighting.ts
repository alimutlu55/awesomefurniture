import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { resolveMaterials } from '../materials/configured-materials';
import { ceilingPieces, ceilingPolyline, resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { kitchenUnit, installationKind } from './kitchen-units';

/** Actual model LED centre lines, local x from the left face and y from the unit underside. No cable route is inferred. */
export function cabinetLighting(d: EditorDesign) {
  if (!resolveMaterials(d).integratedLed || installationKind(d) || d.w <= 2 * PANEL) return [];
  const upper = d.product === 'kitchen' && kitchenUnit(d.unit).elevation > 0;
  const points = upper ? [{ x: PANEL, y: -.4 }, { x: d.w - PANEL, y: -.4 }]
    : ceilingPolyline(ceilingPieces(resolveShape(d)), PANEL, d.w - PANEL).map(p => ({ x: p.x, y: p.y - PANEL - .4 }));
  return points.slice(1).map((b, i) => ({ a: points[i]!, b, z: d.d - 6,
    length: Math.hypot(b.x - points[i]!.x, b.y - points[i]!.y) }));
}
