/**
 * The turn handle every turnable piece has (a wardrobe, a kitchen unit, a bed): its button and the angle a pointer asks
 * for. The snapping is the rule every piece shares (`snapTurn` in domain/pieces/piece-motion.ts).
 */
export const TURN_TITLE = 'Drag to rotate · Click, move, then click to set · Arrow keys rotate';
/** The ↻ button's content: the arrow, and a place for the angle while it turns. */
export const TURN_MARKUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg><span></span>';
/** Arrow keys on a turn handle turn this far. */
export const TURN_KEY_STEP = 15;

/** Where a turn started: the piece's angle and middle, the pointer's bearing from it on the floor (null until known),
 * its screen x, and whether the view looks down enough to turn by sweeping round the piece. */
export interface TurnStart { readonly angle: number; readonly centre: { readonly x: number; readonly z: number }; polar: number | null; x: number | null; readonly spatial: boolean }

/** The angle the pointer asks for, before snapping: seen from above, the sweep of the pointer round the piece's middle;
 * at eye level, its sideways travel (0.6° a pixel). */
export function sweptAngle(start: TurnStart, ground: { x: number; z: number } | null, clientX: number): number {
  let delta = (clientX - (start.x ?? clientX)) * .6;
  if (start.spatial && ground && start.polar !== null) {
    const a = Math.atan2(ground.x - start.centre.x, ground.z - start.centre.z) - start.polar;
    delta = Math.atan2(Math.sin(a), Math.cos(a)) * 180 / Math.PI;
  }
  return start.angle + delta;
}
/** The bearing of a floor point from a piece's middle, as `sweptAngle` measures it. */
export const bearing = (centre: { x: number; z: number }, p: { x: number; z: number } | null) => p ? Math.atan2(p.x - centre.x, p.z - centre.z) : null;
