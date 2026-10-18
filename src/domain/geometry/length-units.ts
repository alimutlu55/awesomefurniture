/** Display units for lengths. The design is always stored and calculated in centimetres; a unit only changes how a
 * length is shown and how a typed length is read. Conversions are exact (1 in = 25.4 mm); only the number of decimals
 * shown differs, and a typed value reads back to within 0.15 mm, well inside the 1 mm (0.1 cm) the design keeps. */
export const LENGTH_UNITS = [
  { key: 'mm', name: 'Millimetres', short: 'mm', perCm: 10, shown: 0, typed: 1 },
  { key: 'cm', name: 'Centimetres', short: 'cm', perCm: 1, shown: 1, typed: 2 },
  { key: 'in', name: 'Inches', short: 'in', perCm: 1 / 2.54, shown: 2, typed: 2 },
] as const;
export type LengthUnit = typeof LENGTH_UNITS[number]['key'];
export const DEFAULT_LENGTH_UNIT: LengthUnit = 'cm';

export const lengthUnit = (key: string | null | undefined) => LENGTH_UNITS.find(u => u.key === key) ?? LENGTH_UNITS[1];
export const isLengthUnit = (key: unknown): key is LengthUnit => LENGTH_UNITS.some(u => u.key === key);

/** Centimetres → a number in `unit`, rounded to what a person reads (`typed` for a field, else `shown`). */
export function fromCm(cm: number, unit: LengthUnit, typed = false): number {
  const u = lengthUnit(unit), places = typed ? u.typed : u.shown, k = 10 ** places;
  return Math.round(cm * u.perCm * k) / k;
}
/** A number typed in `unit` → centimetres, to the 0.01 mm the design resolves. */
export function toCm(value: number, unit: LengthUnit): number {
  return Math.round(value / lengthUnit(unit).perCm * 1000) / 1000;
}
/** The number alone, as shown ("183.4", "1834", "72.2"). */
export const lengthNumber = (cm: number, unit: LengthUnit, typed = false) => String(fromCm(Math.max(0, cm), unit, typed));
/** The number with its unit ("183.4 cm", "1834 mm", "72.2 in"). */
export const formatLength = (cm: number, unit: LengthUnit) => lengthNumber(cm, unit) + ' ' + lengthUnit(unit).short;
/** Step for a number field in `unit` equivalent to `cmStep` centimetres, or 'any' where no round step exists. */
export function stepIn(cmStep: number, unit: LengthUnit): string {
  if (unit === 'in') return 'any';
  return String(Math.max(unit === 'mm' ? 1 : 0.1, fromCm(cmStep, unit, true)));
}
