import type { EditorDesign } from '../wardrobe/editor-design';
import { PANEL } from '../wardrobe/catalog.js';
import { interiorFloorOf, RAIL_DROP } from '../wardrobe/carcass';
import { cabinetDoorAreas } from '../wardrobe/door-layout';
import { fitting, hasTrait, type FrontOpening } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { fridgeSplit, hingedLeaves, kitchenFrontRect, shelfHeights } from '../kitchen/kitchen-fronts';
import { isKitchen } from '../furniture/furniture';

interface Box { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
/** A front as the drawings show it: how it opens, the side its hinges are on, and an appliance's name. */
export interface Front extends Box {
  readonly opens: FrontOpening | 'open';
  readonly hinge?: 'left' | 'right' | undefined;
  readonly label?: string | undefined;
}
/** What is inside, behind the fronts: fittings and boards, rails, and a cupboard's shelves. */
export interface Inside extends Box { readonly kind: 'box' | 'rail' | 'shelf' }

/**
 * A piece's fronts and what is behind them, centimetres from its left face and its bottom. A wardrobe with doors:
 * its door leaves, hinged on the side nearer its end, over its fittings, shelves, partitions and rails. An open
 * wardrobe: those fittings, nothing over them. A kitchen unit: each fitting's own front where it is built (overlay
 * fronts), a wide door as two leaves, a tall fridge as fridge over freezer, with the cupboards' shelves behind.
 */
export function piecefronts(design: EditorDesign): { fronts: Front[]; inside: Inside[]; covered: boolean } {
  // The rules read a design being edited; nothing is selected in a drawing.
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), widths = geometry.widths();
  const fronts: Front[] = [], inside: Inside[] = [], kitchen = isKitchen(design);
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    for (const [j, pos] of geometry.computeLayout(i).entries()) {
      const it = design.secs[i]![j]!, def = fitting(it.k)!, cx = bayL + pos.off + pos.w / 2;
      if (!kitchen) {
        inside.push({ kind: 'box', x0: bayL + pos.off, x1: bayL + pos.off + pos.w, y0: pos.y0, y1: pos.y1 });
        if (hasTrait(it.k, 'hanging')) inside.push({ kind: 'rail', x0: bayL + pos.off, x1: bayL + pos.off + pos.w, y0: pos.y1 - RAIL_DROP, y1: pos.y1 - RAIL_DROP });
        continue;
      }
      const r = kitchenFrontRect(design.unit, cx, pos.y0, pos.w, it.h, { bottom: interiorFloorOf(design), top: design.h - PANEL }, { left: PANEL, right: design.w - PANEL });
      const opens = def.opens ?? 'open', label = hasTrait(it.k, 'appliance') ? def.zone.label : undefined;
      if (opens === 'side') {
        const split = fridgeSplit(r.y0, r.y1, it.h), rows = split === null ? [[r.y0, r.y1]] : [[r.y0, split], [split, r.y1]];
        for (const [y0, y1] of rows) for (const leaf of hingedLeaves(r.x0, r.x1)) fronts.push({ ...leaf, y0: y0!, y1: y1!, opens, label });
        if (!label) for (const y of shelfHeights(pos.y0, pos.y0 + it.h)) inside.push({ kind: 'shelf', x0: cx - pos.w / 2, x1: cx + pos.w / 2, y0: y, y1: y });
      } else fronts.push({ ...r, opens, label });
    }
    if (!kitchen) {
      for (const d of geometry.sectionDividers(i)) {
        const r = geometry.visibleRect(d);
        inside.push({ kind: 'box', x0: bayL + r.x0, x1: bayL + r.x1, y0: geometry.interiorFloor() + r.y0, y1: geometry.interiorFloor() + r.y1 });
      }
      if (i < widths.length - 1) inside.push({ kind: 'box', x0: bayL + sw, x1: bayL + sw + PANEL, y0: interiorFloorOf(design), y1: Infinity });
    }
    bayL += sw + PANEL;
  });
  // Wardrobe doors: each leaf hinged on the side nearer the wardrobe's end, as the 3D view hangs them.
  const covered = !kitchen && design.doors !== 'none';
  if (covered) for (const a of cabinetDoorAreas(design, widths)) fronts.push({ ...a, opens: 'side', hinge: (a.x0 + a.x1) / 2 <= design.w / 2 ? 'left' : 'right' });
  return { fronts, inside, covered };
}
