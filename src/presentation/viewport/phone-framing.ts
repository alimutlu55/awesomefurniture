/** How much of the usable view a chosen piece, or a chosen fitting or board, may take before the camera zooms (lo to
 * hi), and how much it takes when the camera does zoom (aim). A piece keeps room around it to be moved. */
export const FILL = { piece: { lo: .35, hi: .85, aim: .4 }, part: { lo: .3, hi: .7, aim: .32 } } as const;

type Box = { x: number; y: number; w: number; h: number; d: number };

/**
 * Where the camera goes when something is chosen on a phone: it always brings what was chosen to the middle of the
 * view, and zooms only when it is too small to work on or too big to see whole, to `aim` of the view. Otherwise the
 * zoom stays as it was. `box` is in the piece's own frame (x across its width from its centre, y up from its base);
 * `fit` is the distance at which the box would fill the usable view; `dist` the camera's distance now.
 */
export function phoneFraming({ pose, box, fit, dist, part }: {
  pose: { x: number; y?: number | undefined; z: number; angle: number }; box: Box; fit: number; dist: number; part: boolean;
}): { x: number; y: number; z: number; dist: number } {
  const { lo, hi, aim } = part ? FILL.part : FILL.piece, a = pose.angle, share = fit / dist;
  return {
    x: pose.x + box.x * Math.cos(a), y: (pose.y || 0) + box.y, z: pose.z - box.x * Math.sin(a),
    dist: share >= lo && share <= hi ? dist : fit / aim
  };
}
