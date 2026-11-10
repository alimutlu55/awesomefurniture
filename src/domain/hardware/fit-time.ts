import { hardware } from './hardware-registry';
import type { HardwareCategory } from './hardware-types';

/**
 * How long fitting takes, for one person who has done it before (estimates; drilling not included). The engine's
 * passport and prices and Make's assembly plan both read these, so a step's time and the piece's add up to one number.
 */

/** Minutes to fit one of each kind of hardware. */
export const FIT_MINUTES: Readonly<Record<HardwareCategory, number>> = {
  connector: 1.5, fixing: .3, support: .5, hinge: 4, runner: 10, handle: 3, rail: 5, leg: 1, bracket: 3, lift: 20, mechanism: 25,
  plinth: 1, track: 30, lighting: 15,
};
/** Minutes to fit one fitting of this kind: its entry's own time where it has one, else its category's. */
export const fitMinutes = (kind: string): number => { const entry = hardware(kind); return entry?.assembly.minutes ?? FIT_MINUTES[entry?.category ?? 'fixing']; };
/** Minutes to handle, place and square up one board. */
export const BOARD_MINUTES = 2;
