import type { EditorDesign } from '../wardrobe/editor-design';
import { plinthOf } from '../wardrobe/carcass';
import { PANEL } from '../wardrobe/catalog.js';
import { interiorFloorOf, RAIL_DROP } from '../wardrobe/carcass';
import { cabinetDoorAreas, doorHingeSide } from '../wardrobe/door-layout';
import { fitting, hasTrait, type FrontOpening } from '../wardrobe/fittings';
import { createWardrobeGeometry } from '../geometry/wardrobe-geometry.js';
import { cornerDoorSide, cornerFrontSplit, cornerPulloutGeometry, fridgeSplit, hingedLeaves, itemHingeSide, kitchenFrontRect, shelfHeights } from '../kitchen/kitchen-fronts';
import { isKitchen } from '../furniture/furniture';
import { type FaceWidth } from '../kitchen/corner-widths';

interface Box { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
/** A front as the drawings show it: how it opens, the side its hinges are on, and an appliance's name. */
export interface Front extends Box {
  readonly opens: FrontOpening | 'open';
  readonly hinge?: 'left' | 'right' | undefined;
  readonly label?: string | undefined;
  /** What it is called in the cutting list ("Cupboard door", "Drawer front"). */
  readonly name: string;
  /** The appliance's own front (an oven): nothing is cut for it. */
  readonly own?: boolean | undefined;
  readonly installation?: boolean | undefined;
}
/** What is inside, behind the fronts: fittings and boards, rails, and a cupboard's shelves. */
export interface Inside extends Box { readonly kind: 'box' | 'rail' | 'shelf' }
/** A blind-corner pull-out mechanism inside a kitchen bay: its blind panel, hinged door, pivot post and swing-out trays. */
export type CornerPullout = ReturnType<typeof cornerPulloutGeometry> & {
  readonly bayIndex: number;
  readonly cx: number;
  readonly y0: number;
  readonly sw: number;
  readonly hh: number;
  readonly doorSide: 'left' | 'right';
  readonly blind: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  readonly door: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly hinge: 'left' | 'right' };
};

/**
 * A piece's fronts and what is behind them, centimetres from its left face and its bottom. A wardrobe with doors:
 * its door leaves, hinged on the side nearer its end, over its fittings, shelves, partitions and rails. An open
 * wardrobe: those fittings, nothing over them. A kitchen unit: each fitting's own front where it is built (overlay
 * fronts), a wide door as two leaves, a tall fridge as fridge over freezer, with the cupboards' shelves behind.
 */
export function piecefronts(design: EditorDesign, faceWidths: readonly FaceWidth[] = []): { fronts: Front[]; inside: Inside[]; covered: boolean; cornerPullouts: CornerPullout[]; invalidFridgeSplit?: boolean } {
  // The rules read a design being edited; nothing is selected in a drawing.
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing), widths = geometry.widths();
  const fronts: Front[] = [], inside: Inside[] = [], cornerPullouts: CornerPullout[] = [], kitchen = isKitchen(design);
  let invalidFridgeSplit = false;
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
      if (it.k === 'fridge' && design.fridgeSplit && design.fridgeSplit >= r.y1 - r.y0) invalidFridgeSplit = true;
      const opens = def.opens ?? 'open', label = hasTrait(it.k, 'appliance') ? def.zone.label : undefined, own = !!def.ownFront;
      const name = (def.zone.label ?? def.name) + (opens === 'side' ? ' door' : ' front'), hinge = itemHingeSide(it, design), explicit = !!(it.hinge ?? design.doorHang);
      if (it.k === 'corner') {
        let doorSide = cornerDoorSide(it);
        let { blind, door } = cornerFrontSplit(r.x0, r.x1, hinge, doorSide);
        if (faceWidths.some(s => s.strip)) {
          const hidden = faceWidths.find(s => s.covered)!, open = faceWidths.find(s => !s.covered && !s.strip)!;
          if (hidden && open) {
            blind = { x0: hidden.from, x1: hidden.to }; door = { x0: open.from, x1: open.to, hinge };
            doorSide = open.from < hidden.from ? 'left' : 'right';
          }
        }
        const mech = cornerPulloutGeometry(cx, pos.y0, pos.w, it.h, design.d, blind, doorSide);
        if (faceWidths.some(s => s.strip)) {
          for (const s of faceWidths) fronts.push({ x0: Math.max(r.x0, s.from), x1: Math.min(r.x1, s.to), y0: r.y0, y1: r.y1,
            opens: s.covered || s.strip ? 'fixed' : 'side', hinge, ...(s.strip ? { installation: true } : {}),
            name: s.strip ? 'Corner installation strip' : s.covered ? 'Corner blind panel' : 'Corner pull-out door' });
        } else {
          fronts.push({ ...blind, y0: r.y0, y1: r.y1, opens: 'fixed', name: 'Corner blind panel' });
          fronts.push({ ...door, y0: r.y0, y1: r.y1, opens: 'side', name: 'Corner pull-out door' });
        }
        inside.push({ kind: 'box', x0: mech.post.x0, x1: mech.post.x1, y0: mech.post.y0, y1: mech.post.y1 });
        for (const t of mech.trays) {
          inside.push({ kind: 'box', x0: t.rail.x0, x1: t.rail.x1, y0: t.base.y0, y1: t.rail.y1 });
          inside.push({ kind: 'shelf', x0: t.base.x0, x1: t.base.x1, y0: t.base.y1, y1: t.base.y1 });
        }
        cornerPullouts.push({ ...mech, bayIndex: i, cx, y0: pos.y0, sw: pos.w, hh: it.h, doorSide, blind: { ...blind, y0: r.y0, y1: r.y1 }, door: { ...door, y0: r.y0, y1: r.y1 } });
      } else if (opens === 'side') {
        const split = fridgeSplit(r.y0, r.y1, it.h, it.k === 'fridge' ? design.fridgeSplit : undefined), rows = split === null ? [[r.y0, r.y1]] : [[r.y0, split], [split, r.y1]];
        for (const [y0, y1] of rows) for (const leaf of hingedLeaves(r.x0, r.x1, hinge, explicit)) fronts.push({ ...leaf, y0: y0!, y1: y1!, opens, label, name, own });
        if (!label) for (const y of shelfHeights(pos.y0, pos.y0 + it.h)) inside.push({ kind: 'shelf', x0: cx - pos.w / 2, x1: cx + pos.w / 2, y0: y, y1: y });
      } else fronts.push({ ...r, opens, label, name, own });
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
  // Wardrobe doors: each leaf hinged on the side nearer the wardrobe's end unless doorHang overrides it.
  const covered = !kitchen && design.doors !== 'none';
  if (covered) for (const a of cabinetDoorAreas(design, widths)) fronts.push({ ...a, opens: 'side', hinge: doorHingeSide(a, design), name: 'Door' });
  const installed = !kitchen || !faceWidths.some(s => s.strip || s.covered) ? fronts : fronts.flatMap(f => {
    if (f.installation) return [];
    return faceWidths.filter(s => !s.strip).flatMap(s => {
      const x0 = Math.max(f.x0, s.from), x1 = Math.min(f.x1, s.to);
      return x1 - x0 > 1e-7 ? [{ ...f, x0, x1, ...(s.covered ? { opens: 'fixed' as const, name: 'Corner return panel' } : {}) }] : [];
    });
  });
  if (kitchen) for (const s of faceWidths.filter(s => s.strip)) installed.push({ x0: s.from, x1: s.to,
    y0: plinthOf(design), y1: design.h, opens: 'fixed', installation: true, name: 'Corner installation strip' });
  return { fronts: installed, inside, covered, cornerPullouts, ...(invalidFridgeSplit ? { invalidFridgeSplit: true } : {}) };
}
