import { kitchenUnit, type KitchenUnitKey } from './kitchen-units';
import { PANEL } from '../wardrobe/catalog.js';

/** The gap between the fronts of two units standing side by side. Centimetres. */
export const FRONT_GAP = .3;

/**
 * Where a kitchen fitting's front is: overlay fronts reach over the boards around them. A front at the unit's edge
 * reaches over the whole side panel (less half the gap to the next unit); beside another front in the same unit it
 * stops halfway across their shared partition. The lowest front reaches over the bottom board (a wall unit's down to
 * its lower edge, as its bottom is solid), the highest over the top board. `cx`, `sw`: the fitting's centre and width;
 * `y`, `h`: its bottom and height; `inside`: the bottom and top of the unit's inside; `outer`: the inner faces of its
 * side panels. Any one frame of reference, centimetres.
 */
export function kitchenFrontRect(unit: KitchenUnitKey | undefined, cx: number, y: number, sw: number, h: number,
  inside: { bottom: number; top: number }, outer?: { left: number; right: number }) {
  const edge = (side: number, face: number) => outer !== undefined && Math.abs(side - face) < PANEL + .01 ? PANEL - FRONT_GAP / 2 : PANEL / 2;
  const x0 = cx - sw / 2 - edge(cx - sw / 2, outer?.left ?? 0), x1 = cx + sw / 2 + edge(cx + sw / 2, outer?.right ?? 0);
  const y0 = Math.abs(y - inside.bottom) < .05 ? (kitchenUnit(unit).plinth ? y - PANEL : 0) : y, y1 = Math.abs(y + h - inside.top) < .05 ? y + h + PANEL : y + h;
  return { x0, x1, y0, y1 };
}
