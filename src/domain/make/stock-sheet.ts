import { getDecor } from '../materials/decor-catalog';

/**
 * The stock sheet boards are cut from (decision D9): 2800 × 2070 mm, trimmed 10 mm all round, with a 4 mm saw kerf
 * between parts. Millimetres.
 */
export const STOCK = { length: 2800, width: 2070, kerf: 4, trim: 10 } as const;

/** A decor with a grain is cut along it: its parts may not turn on the sheet. An unknown decor is taken to have one. */
export const hasGrain = (decorId: string) => { try { return getDecor(decorId).grainDirection !== 'none'; } catch { return true; } };

/** Whether a part `length` along its grain by `width` fits a trimmed sheet: as it lies, or turned when the decor has
 * no grain. Millimetres. */
export function fitsStock(length: number, width: number, decorId: string, stock: typeof STOCK = STOCK): boolean {
  const L = stock.length - 2 * stock.trim, W = stock.width - 2 * stock.trim;
  return length <= L && width <= W || !hasGrain(decorId) && width <= L && length <= W;
}
