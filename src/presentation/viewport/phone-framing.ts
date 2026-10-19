import { Vector3, type Camera } from 'three';

/** How much of the usable view a chosen piece, or a chosen fitting or board, may take before the camera moves (lo to
 * hi), and how much it takes when the camera does move (aim). A piece keeps room around it to be moved. */
export const FILL = { piece: { lo: .15, hi: .85, aim: .35 }, part: { lo: .3, hi: .7, aim: .32 } } as const;
/** The bars over the view on a phone: the mode switch and menu at the top, the toolbar at the bottom (in pixels). */
export const BARS = { top: 64, bottom: 115, side: 14 } as const;

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Box = { x: number; y: number; w: number; h: number; d: number };

/**
 * Where the camera goes when something is chosen on a phone, or null to stay where it is. The camera moves as little
 * as it can: not at all when what was chosen is wholly in view and neither too small nor too big; only sideways when
 * it is the right size but partly out of view; otherwise it zooms just enough to fill `aim` of the view. `box` is in
 * the piece's own frame (x across its width from its centre, y up from its base); `fit` is the distance at which the
 * box would fill the usable view; `dist` the camera's distance now.
 */
export function phoneFraming({ cam, view, pose, box, fit, dist, part }: {
  cam: Camera; view: Rect; pose: { x: number; y?: number | undefined; z: number; angle: number }; box: Box; fit: number; dist: number; part: boolean;
}): { x: number; y: number; z: number; dist: number } | null {
  const { lo, hi, aim } = part ? FILL.part : FILL.piece, a = pose.angle, share = fit / dist;
  const centre = { x: pose.x + box.x * Math.cos(a), y: (pose.y || 0) + box.y, z: pose.z - box.x * Math.sin(a) };
  cam.updateMatrixWorld(true);
  let inView = true;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const u = sx * box.w / 2, v = sz * box.d / 2;
    const q = new Vector3(centre.x + u * Math.cos(a) + v * Math.sin(a), centre.y + sy * box.h / 2, centre.z - u * Math.sin(a) + v * Math.cos(a)).project(cam);
    const x = view.left + (q.x + 1) / 2 * view.width, y = view.top + (1 - q.y) / 2 * view.height;
    if (q.z > 1 || x < view.left + BARS.side || x > view.right - BARS.side || y < view.top + BARS.top || y > view.bottom - BARS.bottom) inView = false;
  }
  const sized = share >= lo && share <= hi;
  if (inView && sized) return null;
  return { ...centre, dist: sized ? dist : fit / aim };
}
