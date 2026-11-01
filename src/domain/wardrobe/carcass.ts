import { PANEL, PLINTH } from './catalog.js';
import { kitchenUnit } from '../kitchen/kitchen-units';

/** How a wardrobe carcass is built up, in centimetres: the one place every board deduction comes from.
 *
 * Height: the plinth (PLINTH) carries the base board (PANEL); the clear interior starts on the base
 * board at PLINTH + PANEL and ends under the top boards (their vertical thickness grows with the slope,
 * see shapeBoards). Width: two side panels and one PANEL-thick partition between bays (sectionWidths).
 * Depth, back to front: the back board (BACK_PANEL) sits between the sides; partitions and the base
 * board run from its face to PARTITION_SETBACK behind the front edge; shelves and fittings stop
 * FITTING_SETBACK behind it, so a door closes clear of them. No board runs into another. */
export const BACK_PANEL = .6;
export const PARTITION_SETBACK = .5;
export const FITTING_SETBACK = 1.4;
/** The longest clear span between supports a shelf carries without bowing (decision D2), by board thickness: millimetres
 * of thickness to centimetres of span. */
export const SHELF_SPAN: Readonly<Record<number, number>> = { 18: 80, 25: 100 };
/** The span for a board `thickness` centimetres thick: the thickest listed board it is at least as thick as, or the
 * thinnest listed one. Centimetres. */
export function shelfSpanFor(thickness: number): number {
  const listed = Object.keys(SHELF_SPAN).map(Number).sort((a, b) => a - b), mm = Math.round(thickness * 10);
  return SHELF_SPAN[[...listed].reverse().find(t => t <= mm) ?? listed[0]!]!;
}
/** The clear fitting depth a side-facing hanging rail needs for clothes on hangers (decision D3). Centimetres. */
export const MIN_HANGING_DEPTH = 53;
/** Height of the base board's top face: where the clear interior starts. */
export const INTERIOR_FLOOR = PLINTH + PANEL;
/** The plinth under a carcass: 8 cm, except for a unit that hangs on a wall (a kitchen wall unit), whose bottom board is
 * its lower edge. Everything vertical in the engine starts from this, so a wall unit has no dead space under its floor. */
export const plinthOf = (design: { product?: string | undefined; unit?: string | undefined; plinthHeight?: number | undefined }) =>
  design.product === 'kitchen' ? (kitchenUnit(design.unit).elevation > 0 || kitchenUnit(design.unit).installation === 'end-panel' ? 0 : design.plinthHeight ?? PLINTH) : PLINTH;
/** Height of the top face of the base board of a design: where its clear interior starts. */
export const interiorFloorOf = (design: { product?: string | undefined; unit?: string | undefined; plinthHeight?: number | undefined }) => plinthOf(design) + PANEL;

/** A board running from the back board's face to `setback` behind the front edge of a cabinet `d` deep.
 * `z0`/`z1` are measured from the back (z = 0); `centre` is cabinet-centred, as the renderer places boards. */
export function boardDepth(d: number, setback: number) {
  const z0 = BACK_PANEL, z1 = d - setback;
  return { z0, z1, depth: z1 - z0, centre: (z0 + z1) / 2 - d / 2 };
}
/** Shelves, fitting boards and the space a fitting may use. */
export const fittingDepth = (d: number) => boardDepth(d, FITTING_SETBACK);
/** A drawer's own front inside the carcass (behind any doors): PANEL thick, its face INNER_FRONT_GAP behind the front
 * edge, and 5 mm short of its space top and bottom, so stacked drawers show a 1 cm line between them. The board over or
 * under a drawer stops 1 mm behind that front, which closes over its edge: the deeper shelf line would run into it. */
export const INNER_FRONT_GAP = .3;
export function innerFront(d: number, y0: number, h: number) {
  const z1 = d - INNER_FRONT_GAP, z0 = z1 - PANEL;
  return { y0: y0 + .5, y1: y0 + h - .5, z0, z1, centre: (z0 + z1) / 2 - d / 2 };
}
export const besideInnerFrontDepth = (d: number) => boardDepth(d, INNER_FRONT_GAP + PANEL + .1);
/** Partitions between bays and the base board. */
export const partitionDepth = (d: number) => boardDepth(d, PARTITION_SETBACK);
/** Clear depth inside the carcass, from the back board to the front edge. */
export const interiorDepth = (d: number) => d - BACK_PANEL;
/** Outer cabinet depth that gives a fitting this usable depth (the inverse of fittingDepth). */
export const depthForFitting = (usable: number) => usable + BACK_PANEL + FITTING_SETBACK;

/** A hanging rail: its centre sits RAIL_DROP below the top of the fitting's clear space, so hanger hooks
 * clear the board above; garments hang from RAIL_RADIUS below the centre. */
export const RAIL_DROP = 6;
export const RAIL_RADIUS = 1.2;
