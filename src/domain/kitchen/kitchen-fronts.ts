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

/** Above this width a hinged front is two leaves. Centimetres. */
export const DOUBLE_DOOR_OVER = 62;
/** Hinged leaves across x0..x1: one up to DOUBLE_DOOR_OVER wide, hinged on `hinge` ('left' by default, handle on the
 * opposite edge); two above it, hinged on the outer sides and meeting in the middle unless `explicit` is true. */
export function hingedLeaves(x0: number, x1: number, hinge: 'left' | 'right' = 'left', explicit = false): { x0: number; x1: number; hinge: 'left' | 'right' }[] {
  if (x1 - x0 <= DOUBLE_DOOR_OVER) return [{ x0, x1, hinge }];
  const mid = (x0 + x1) / 2;
  return explicit
    ? [{ x0, x1: mid, hinge }, { x0: mid, x1, hinge }]
    : [{ x0, x1: mid, hinge: 'left' }, { x0: mid, x1, hinge: 'right' }];
}
/** Which half of a blind-corner pull-out holds the door ('left' by default, or 'right' when aligned right via ax === 'r'). */
export const cornerDoorSide = (item?: { readonly ax?: 'l' | 'c' | 'r' | undefined }): 'left' | 'right' =>
  item?.ax === 'r' ? 'right' : 'left';
/** Which side a single-leaf kitchen front hinges on: the item's own choice first, then the cabinet's doorHang.
 * In Auto mode, a blind-corner pull-out hinges at its centre post so its handle sits on the outer edge away from the
 * inner corner; other single-leaf doors hinge on the left (handle on the right). */
export const itemHingeSide = (
  item?: { readonly k?: string | undefined; readonly hinge?: 'left' | 'right' | undefined; readonly ax?: 'l' | 'c' | 'r' | undefined },
  design?: { readonly doorHang?: 'left' | 'right' | undefined },
): 'left' | 'right' =>
  item?.hinge ?? design?.doorHang ?? (item?.k === 'corner' ? (cornerDoorSide(item) === 'left' ? 'right' : 'left') : 'left');
/** Where a blind-corner pull-out front divides into its hinged door leaf and the fixed blind panel that tucks into the
 * corner: `doorSide` chooses which half holds the door ('left' by default, 'right' when flipped), while `hinge` sets
 * which edge of that door leaf has the hinges ('right' puts the handle on the left edge; 'left' on the right edge). */
export function cornerFrontSplit(x0: number, x1: number, hinge: 'left' | 'right' = 'right', doorSide: 'left' | 'right' = 'left') {
  const mid = (x0 + x1) / 2;
  return doorSide === 'right'
    ? { blind: { x0, x1: mid }, door: { x0: mid, x1, hinge } }
    : { blind: { x0: mid, x1 }, door: { x0, x1: mid, hinge } };
}
/** Where a fridge front splits into a freezer door below and a fridge door above: only in a tall housing (a fitting
 * over 140 cm). Null for one door. */
export const fridgeSplit = (y0: number, y1: number, h: number) => h > 140 ? y0 + Math.max(50, (y1 - y0) * .32) : null;
/** Heights of the adjustable shelves in a cupboard from y0 to y1: about one every 34 cm, evenly spaced. */
export function shelfHeights(y0: number, y1: number): number[] {
  const count = Math.floor((y1 - y0) / 34);
  return Array.from({ length: count }, (_, n) => y0 + (y1 - y0) * (n + 1) / (count + 1));
}
