import { PANEL, PLINTH } from '../wardrobe/catalog.js';
import { BACK_PANEL, FITTING_SETBACK, PARTITION_SETBACK } from '../wardrobe/carcass';
import { DOOR } from '../wardrobe/door-layout';
import { FRONT_GAP } from '../kitchen/kitchen-fronts';
import { KITCHEN_PLINTH_SETBACK, WORKTOP } from '../kitchen/kitchen-units';
import { isKitchen } from '../furniture/furniture';
import { type Item, type View, line, note, rect } from './drawing';
import type { PlacedPiece } from './room-pieces';

/** Centimetres to millimetres, to the half millimetre a detail is drawn to. */
const h = (cm: number) => Math.round(cm * 20) / 2;
const T = h(PANEL), GAP = h(FRONT_GAP);
const cut = (x0: number, y0: number, x1: number, y1: number) => rect(x0, y0, x1, y1, 'cut', 'hatch');
const dims = (x: number, y: number, dir: 'across' | 'up', values: readonly number[], side: 1 | -1, row = 0): Item =>
  ({ kind: 'dims', origin: { x, y }, dir: dir === 'across' ? { x: 1, y: 0 } : { x: 0, y: 1 }, side, clear: 0, row, stops: [...new Set(values)].sort((a, b) => a - b).map(v => v - (dir === 'across' ? x : y)) });

/** D1, seen from above: two kitchen units side by side at their fronts. Each front reaches over its side panel but half
 * the gap, so the fronts of the two units meet with one gap between them. */
function frontsAtJoint(): Item[] {
  const reach = 100, depth = 80;
  return [cut(-T, -depth, 0, 0), cut(0, -depth, T, 0), cut(-reach, 0, -GAP / 2, T), cut(GAP / 2, 0, reach, T),
    dims(-T, T, 'across', [-T, -GAP / 2, GAP / 2, T], 1), dims(-T, T, 'across', [-T, 0, T], 1, 1), dims(reach, 0, 'up', [0, T], -1),
    note({ x: -reach / 2, y: -depth / 2 }, 'Side'), note({ x: reach / 2, y: -depth / 2 }, 'Side')];
}

/** D2, a section at the foot of a kitchen floor unit: the base board on the sides above the plinth, the front over it,
 * and the plinth board set back on its legs. Depth runs left to right to the front. */
function plinthAndBase(): Item[] {
  const front = 0, base = h(PLINTH), plinth = front - h(KITCHEN_PLINTH_SETBACK), from = -140;
  return [line({ x: from - 20, y: 0 }, { x: front + 60, y: 0 }, 'cut'),
    cut(from, base, front - h(PARTITION_SETBACK), base + T), rect(from, 0, front, base + 120, 'thin'),
    cut(front, base + GAP / 2, front + T, base + 120), cut(plinth - 16, 0, plinth, base), line({ x: plinth - 60, y: 0 }, { x: plinth - 60, y: base }, 'thin'),
    // The plinth's setback from the carcass front below; the base board's own small setback above it.
    dims(plinth - 16, 0, 'across', [plinth, front, front + T], -1), dims(front - h(PARTITION_SETBACK), base + T, 'across', [front - h(PARTITION_SETBACK), front], 1),
    dims(from, 0, 'up', [0, base, base + T], 1),
    note({ x: plinth - 60, y: base / 2 }, 'Leg', 'end')];
}

/** D3, a section at the top front of a kitchen base unit: the worktop on the top board, overhanging the front. */
function worktopEdge(): Item[] {
  const front = 0, top = 0, from = -120, wt = h(WORKTOP.thickness), over = h(WORKTOP.overhang);
  return [cut(from, top - T, front, top), cut(from, top, front + over, top + wt), rect(from, top - 120, front, top, 'thin'),
    cut(front, top - 120, front + T, top - GAP / 2),
    dims(front, top + wt, 'across', [front, front + T, front + over], 1), dims(from, top - T, 'up', [top - T, top, top + wt], 1)];
}

/** D4, a section through a wardrobe's front: a shelf stopping short of the carcass front, the partition a little less,
 * the door standing just in front of the carcass. */
function shelfAndDoor(): Item[] {
  const front = 0, y = 0, from = -120, door = h(DOOR.standoff - DOOR.thickness / 2), dt = h(DOOR.thickness);
  return [rect(from, y - 120, front, y + 120, 'thin'), cut(from, y - T / 2, front - h(FITTING_SETBACK), y + T / 2),
    line({ x: front - h(PARTITION_SETBACK), y: y - 120 }, { x: front - h(PARTITION_SETBACK), y: y + 120 }, 'hidden'),
    cut(front + door, y - 120, front + door + dt, y + 120),
    dims(front - h(FITTING_SETBACK), y + 120, 'across', [front - h(FITTING_SETBACK), front - h(PARTITION_SETBACK), front, front + door, front + door + dt], 1),
    note({ x: from + 40, y: y + T }, 'Shelf', 'start')];
}

/** D5, seen from above at the back corner: the back board between the sides, the base and shelves stopping at its face. */
function backPanel(): Item[] {
  const back = 0, side = 0, reach = 120, bp = h(BACK_PANEL);
  return [cut(side - T, back, side, back + reach), cut(side, back, side + reach, back + bp), rect(side, back + bp, side + reach, back + reach, 'thin'),
    dims(side - T, back + reach, 'across', [side - T, side], 1), dims(side + reach, back, 'up', [back, back + bp], -1),
    note({ x: side + reach / 2, y: back + reach / 2 }, 'Base or shelf')];
}

/** D6, seen from above at the centre of a blind-corner pull-out unit: the hinged door leaf on one side, the fixed blind
 * panel and return filler on the other, with the vertical pivot post and swing-out tray setback behind the front. */
function blindCornerPullout(): Item[] {
  const reach = 100, setback = 60, post = 22;
  return [
    rect(-reach, -90, reach, 0, 'thin'),
    cut(-reach, 0, -GAP / 2, T),
    cut(GAP / 2, 0, reach, T),
    cut(20, T, 20 + T, T + 70),
    rect(60 - post / 2, -80 - post / 2, 60 + post / 2, -80 + post / 2, 'outline'),
    rect(-reach + 10, -90, 40, -setback, 'thin'),
    line({ x: -GAP / 2, y: T }, { x: -GAP / 2, y: T + 65 }, 'swing'),
    dims(-20, T, 'across', [-20, -GAP / 2, GAP / 2, 20, 20 + T], 1),
    dims(reach, -setback, 'up', [-setback, 0, T], -1),
    note({ x: -reach / 2, y: -30 }, 'Door'),
    note({ x: 60, y: -30 }, 'Blind panel'),
    note({ x: -30, y: -75 }, 'Swing tray'),
  ];
}

/** The construction details that apply to the pieces: how the fronts, plinth and worktop of kitchen units are built, and
 * the shelves and doors of wardrobes; the back panel of any cabinet. Drawn from the same rules the model is built with. */
export function constructionDetails(pieces: readonly PlacedPiece[]): View[][] {
  const cabinets = pieces.filter(p => !p.fixture), kitchen = cabinets.some(p => isKitchen(p.design)), wardrobe = cabinets.some(p => !isKitchen(p.design));
  const corner = cabinets.some(p => p.design.secs.flat().some(it => it.k === 'corner'));
  // At most three to a sheet, so each is drawn at 1:2.
  const sheets: View[][] = [];
  if (kitchen) sheets.push([{ title: 'D1 Fronts at a joint', items: frontsAtJoint() }, { title: 'D2 Plinth and base', items: plinthAndBase() }, { title: 'D3 Worktop edge', items: worktopEdge() }]);
  const cabinet: View[] = [];
  if (wardrobe) cabinet.push({ title: 'D4 Shelf and door', items: shelfAndDoor() });
  if (cabinets.length) cabinet.push({ title: 'D5 Back panel', items: backPanel() });
  if (corner) cabinet.push({ title: 'D6 Blind corner and pull-out', items: blindCornerPullout() });
  if (cabinet.length) sheets.push(cabinet);
  return sheets;
}
