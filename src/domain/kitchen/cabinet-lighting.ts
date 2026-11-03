import type { EditorDesign } from '../wardrobe/editor-design';
import { CABINET_LED_ENTRY } from '../hardware/hardware-registry';
import { PANEL } from '../wardrobe/catalog.js';
import { resolveMaterials } from '../materials/configured-materials';
import { ceilingPieces, ceilingPolyline, resolveShape } from '../wardrobe/shape/wardrobe-shape';
import { kitchenUnit, installationKind } from './kitchen-units';

const LED_DROP_CM = (CABINET_LED_ENTRY.rules.clearanceMm.topDrop ?? 4) / 10;
const LED_SETBACK_CM = (CABINET_LED_ENTRY.rules.clearanceMm.frontSetback ?? 60) / 10;

/** Actual model LED centre lines, local x from the left face and y from the unit underside. No cable route is inferred. */
export function cabinetLighting(d: EditorDesign) {
  if (!resolveMaterials(d).integratedLed || installationKind(d) || d.w <= 2 * PANEL) return [];
  const upper = d.product === 'kitchen' && kitchenUnit(d.unit).elevation > 0;
  const points = upper ? [{ x: PANEL, y: -LED_DROP_CM }, { x: d.w - PANEL, y: -LED_DROP_CM }]
    : ceilingPolyline(ceilingPieces(resolveShape(d)), PANEL, d.w - PANEL).map(p => ({ x: p.x, y: p.y - PANEL - LED_DROP_CM }));
  return points.slice(1).map((b, i) => ({ a: points[i]!, b, z: d.d - LED_SETBACK_CM,
    length: Math.hypot(b.x - points[i]!.x, b.y - points[i]!.y) }));
}
