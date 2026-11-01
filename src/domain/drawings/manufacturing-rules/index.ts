import type { ManufacturingFinding } from '../manufacturing-validation';
import type { DrawingInput, PlacedPiece } from '../room-pieces';
import { leafSize } from './leaf-size';

/**
 * Engineering rules: what a piece must meet to be built, beyond the model being sound. Each rule reads the placed
 * pieces and reports a finding per breach with its `limit`, what the design `measured`, the part it is `at` and the
 * `fix` that clears it, so the editor can badge the part and the export can say what to change. A rule is one module
 * in this folder and one line in RULES; `validateForManufacture` runs them all after its own checks.
 */
export type Rule = (input: DrawingInput, pieces: readonly PlacedPiece[]) => ManufacturingFinding[];

export const RULES: readonly Rule[] = [
  leafSize,
];
