import { RUNNER_ENTRY } from '../hardware/hardware-registry';
import { BACK_PANEL } from './carcass';

/** Nominal runner lengths in centimetres, derived from the domain hardware registry (mm -> cm). */
export const RUNNER_LENGTHS: readonly number[] = RUNNER_ENTRY.sizesMm.map(mm => mm / 10);

/** Side clearance per runner member in centimetres (12.5 mm = 1.25 cm). */
export const RUNNER_CLEARANCE: number = (RUNNER_ENTRY.rules.clearanceMm.side ?? 12.5) / 10;

/** Rear clearance behind the runner in centimetres (10 mm = 1 cm). */
export const RUNNER_REAR_GAP: number = (RUNNER_ENTRY.rules.clearanceMm.rearGap ?? 10) / 10;

export const runnerForSpace = (available: number) =>
  [...RUNNER_LENGTHS].reverse().find(length => length <= available + 1e-9);

/** The longest standard full-extension runner fitting the clear depth less the rear gap. Centimetres. */
export function drawerExtension(depth: number): number {
  return runnerForSpace(depth - BACK_PANEL - RUNNER_REAR_GAP) ?? RUNNER_LENGTHS[0]!;
}
