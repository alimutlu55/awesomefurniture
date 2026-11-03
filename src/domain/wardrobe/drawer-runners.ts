import { BACK_PANEL } from './carcass';

const RUNNER_LENGTHS = [25, 27, 30, 35, 40, 45, 50, 55, 60];
export const runnerForSpace = (available: number) => [...RUNNER_LENGTHS].reverse().find(length => length <= available + 1e-9);

/** The longest standard full-extension runner fitting the clear depth less 10 mm. Centimetres. */
export function drawerExtension(depth: number): number {
  return runnerForSpace(depth - BACK_PANEL - 1) ?? RUNNER_LENGTHS[0]!;
}
