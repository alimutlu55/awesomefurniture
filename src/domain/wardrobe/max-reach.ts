import type { EditorDesign } from './editor-design';

/** Max reach: the highest a person comfortably reaches. It is a setting of the whole project: every wardrobe and cabinet in
 * it plans, advises and draws against the same height. Not set, the editor plans for the usual height and shows no reach. */
export const DEFAULT_REACH = 185;
export const MIN_REACH = 100;
export const MAX_REACH = 250;
/** The reach of someone seated (Auto design's accessible option), whatever the project's. */
export const SEATED_REACH = 122;

/** Clamped to what a person can reach, to the millimetre. */
export const clampReach = (cm: number) => Math.round(Math.max(MIN_REACH, Math.min(MAX_REACH, cm)) * 10) / 10;

/** Gives a design the project's reach (or the usual one when none is set). The design's own reach line is not kept: the
 * line follows the project's setting. */
export function applyMaxReach(design: Pick<EditorDesign, 'profile' | 'reachLine'>, reach: number | undefined): void {
  const value = reach ?? DEFAULT_REACH;
  design.profile.reach = design.profile.accessible ? SEATED_REACH : value;
  design.profile.reachStd = value;
  delete design.reachLine;
}
