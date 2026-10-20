import { BACK_PANEL } from './carcass';

/** The longest standard full-extension runner fitting the clear depth less 10 mm. Centimetres. */
export function drawerExtension(depth: number): number {
  const lengths = [25, 27, 30, 35, 40, 45, 50, 55, 60];
  return [...lengths].reverse().find(length => length <= depth - BACK_PANEL - 1) ?? lengths[0]!;
}
