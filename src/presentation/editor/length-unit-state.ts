import { DEFAULT_LENGTH_UNIT, formatLength, isLengthUnit, lengthNumber, lengthUnit as unitDef, type LengthUnit } from '../../domain/geometry/length-units';

/** The unit lengths are shown in: a person's preference, shared by every editor on the page and remembered in the
 * browser. The design itself is always centimetres; this only changes how it is shown and typed. */
const KEY = 'wardrobeForge.lengthUnit';
const listeners = new Set<(unit: LengthUnit) => void>();
const stored = (): LengthUnit => {
  try { const value = globalThis.localStorage?.getItem(KEY); return isLengthUnit(value) ? value : DEFAULT_LENGTH_UNIT; }
  catch { return DEFAULT_LENGTH_UNIT; }
};
let current: LengthUnit = stored();

export const currentLengthUnit = () => current;
/** " cm", " mm" or " in": what follows a number. */
export const unitSuffix = () => ' ' + unitDef(current).short;
/** "183.4" in the current unit. */
export const lengthText = (cm: number) => lengthNumber(cm, current);
/** "183.4 cm" in the current unit. */
export const lengthWithUnit = (cm: number) => formatLength(cm, current);

export function setLengthUnit(unit: LengthUnit) {
  if (unit === current) return;
  current = unit;
  try { globalThis.localStorage?.setItem(KEY, unit); } catch { /* private window: the choice lasts for this page */ }
  for (const listener of [...listeners]) listener(unit);
}
/** Calls `listener` when the unit changes; returns what undoes it (register it with the editor lifetime). */
export function onLengthUnitChange(listener: (unit: LengthUnit) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
