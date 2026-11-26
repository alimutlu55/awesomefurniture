import { FITTINGS, fitting, type FittingDef } from '../wardrobe/fittings';
import type { KitchenUnitKey } from './kitchen-units';

/**
 * How a fitting fills a kitchen unit. A kitchen unit is closed by its fronts from its bottom board to its top board:
 * fronts meet with only their reveal, never a strip of open carcass between them. So a fitting added to a unit takes its
 * own height but grows into a leftover too low for anything else the unit can hold, and a fitting that is the unit's
 * whole front (a sink cupboard, dishwasher, under-counter fridge, corner or cargo pull-out in a base unit: the fittings
 * registry's `kitchen.whole`) takes all of it, with nothing stacked on it.
 *
 * Centimetres. Pure: the geometry (free height, inside height) is passed in.
 */
const DEFS = FITTINGS as readonly FittingDef[];
const allowedIn = (unit: KitchenUnitKey) => DEFS.filter(f => (f.kitchen?.units as readonly string[] | undefined)?.includes(unit));

/** The lowest front a unit can hold: a leftover lower than this cannot be closed by another fitting, so the fitting
 * under it grows to close it. */
export const smallestFront = (unit: KitchenUnitKey) => Math.min(...allowedIn(unit).map(f => f.min));

/** Whether a fitting kind is the whole front of this unit (it fills the inside and nothing stacks with it). */
export const takesWholeFront = (kind: string | undefined, unit: KitchenUnitKey | undefined) =>
  !!unit && ((fitting(kind)?.kitchen?.whole as readonly string[] | undefined)?.includes(unit) ?? false);

const round = (cm: number) => Math.round(cm * 100) / 100;

/**
 * Height a new fitting takes in a kitchen unit when `free` centimetres are open where it goes: all of it for a whole
 * front, else its usual height, grown to close a leftover lower than the unit's smallest front. Never more than the
 * fitting's own maximum (an oven stays 60 cm) and never more than is free.
 */
export function kitchenFitHeight(kind: string, unit: KitchenUnitKey, free: number): number {
  const def = fitting(kind);
  if (!def) return free;
  const most = Math.min(def.max, free);
  if (takesWholeFront(kind, unit)) return round(most);
  const usual = Math.min(Math.max(def.height, def.min), most);
  return round(free - usual < smallestFront(unit) - .01 ? most : usual);
}

/** Why a whole front cannot go where only `free` of the unit's `inside` height is open, or '' when it can. */
export function wholeFrontProblem(kind: string, unit: KitchenUnitKey | undefined, free: number, inside: number): string {
  if (!takesWholeFront(kind, unit) || free >= inside - .05) return '';
  return 'Takes the whole cabinet front';
}

/** Whether a bay `width` cm wide is within the widths a fitting is made for. */
export const withinMadeWidth = (kind: string, width: number) => width <= (fitting(kind)?.maxWidth ?? Infinity) + .01;
