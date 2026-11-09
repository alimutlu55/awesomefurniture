import { RUNNER_ENTRY } from '../hardware/hardware-registry';
import { PANEL } from './catalog.js';
import { RUNNER_CLEARANCE, RUNNER_LENGTHS, RUNNER_REAR_GAP, runnerForSpace } from './drawer-runners';

/**
 * How a drawer is put together and how it moves, for the 3D view: the same construction Make cuts (drawer-box.ts) and the
 * runner the hardware registry describes. Only the drawer itself travels: its front, its handle, its open box (two sides,
 * a back and a bottom in their groove) and the drawer member of each runner. The boards over and under it, a drawer
 * stack's own side and the cabinet member of each runner, screwed to the upright, stay where they are.
 *
 * Centimetres, cabinet-centred: x across, y up from the floor, z towards the viewer (0 at the cabinet's middle).
 */

/** An axis-aligned part by its centre and size. */
export interface DrawerPart { readonly name: string; readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly h: number; readonly d: number }

export interface DrawerMechanism {
  /** The box behind the front, open at the top: the sides, the back and the bottom. */
  readonly box: readonly DrawerPart[];
  /** Runner members: `cabinet` stays on the upright, `drawer` travels with the box. */
  readonly runners: readonly (DrawerPart & { readonly role: 'cabinet' | 'drawer' })[];
  /** The runner's nominal length. */
  readonly length: number;
  /** How far the drawer comes out when the piece is shown open (the registry's open pull of its runner). */
  readonly travel: number;
}

const RULES = RUNNER_ENTRY.rules.clearanceMm, MOTION = RUNNER_ENTRY.motion;
const BOTTOM_GAP = (RULES.bottomGap ?? 15) / 10, TOP_DROP = (RULES.topDrop ?? 40) / 10;
const OPEN_PULL = MOTION?.kind === 'telescope' ? MOTION.openPullRatio : .7;
const MEMBERS = MOTION?.kind === 'telescope' ? MOTION.members : [];
/** The bottom: 6 mm, in a groove 12 mm up from the box boards' lower edge and 8 mm into them (drawer-box.ts). */
const GROOVE = { fromEdge: 1.2, depth: .8 } as const, BOTTOM = .6;
/** The tallest box a runner takes, and the shallowest that still has a groove for its bottom. */
const MAX_TALL = 25, MIN_TALL = 5;

/** How far a drawer on a runner `length` long comes out to be seen open. Cm. */
export const drawerTravel = (length: number) => Math.round(length * OPEN_PULL);

/**
 * The drawer behind a front: `x0`..`x1` between the faces the runners are screwed to, the board under it at `floor`
 * and the one over it at `ceiling`, its front's top edge at `frontY1` with its inner face at `frontBack`, and the
 * carcass's rear face (the back board's front) at `rear`. A wardrobe drawer's own front is its box front; an `applied`
 * front (a kitchen drawer's, over the carcass) has a box front of its own behind it, ending at `frontBack`.
 */
export function drawerMechanism({ x0, x1, floor, ceiling, frontY1, frontBack, rear, applied = false }: {
  x0: number; x1: number; floor: number; ceiling: number; frontY1: number; frontBack: number; rear: number; applied?: boolean;
}): DrawerMechanism {
  const T = PANEL, length = runnerForSpace(frontBack - rear - RUNNER_REAR_GAP) ?? RUNNER_LENGTHS[0]!;
  const bx0 = x0 + RUNNER_CLEARANCE, bx1 = Math.max(bx0 + 4 * T, x1 - RUNNER_CLEARANCE), bw = bx1 - bx0, cx = (bx0 + bx1) / 2;
  // On its runners clear of the board under it, as tall as the front and the board over it allow.
  const ys = floor + BOTTOM_GAP, tall = Math.max(Math.min(MIN_TALL, frontY1 - ys), Math.min(MAX_TALL, frontY1 - TOP_DROP - ys, ceiling - ys - BOTTOM_GAP));
  const zb = frontBack - length, yc = ys + tall / 2, sideD = length - T - (applied ? T : 0);
  const box: DrawerPart[] = [
    ...applied ? [{ name: 'Box front', x: cx, y: yc, z: frontBack - T / 2, w: bw, h: tall, d: T }] : [],
    { name: 'Box side', x: bx0 + T / 2, y: yc, z: zb + T + sideD / 2, w: T, h: tall, d: sideD },
    { name: 'Box side', x: bx1 - T / 2, y: yc, z: zb + T + sideD / 2, w: T, h: tall, d: sideD },
    { name: 'Box back', x: cx, y: yc, z: zb + T / 2, w: bw, h: tall, d: T },
    { name: 'Box bottom', x: cx, y: ys + GROOVE.fromEdge + BOTTOM / 2, z: zb + T + sideD / 2, w: bw - 2 * (T - GROOVE.depth), h: BOTTOM, d: sideD },
  ];
  // Each runner by its registry members: the cabinet member in the clearance against the upright, the drawer member
  // under the box side it carries, both from the front back.
  const runners = [-1, 1].flatMap(side => MEMBERS.map(m => {
    const h = (m.heightMm ?? 20) / 10, d = length * (m.lengthRatio ?? 1), w = RUNNER_CLEARANCE * .8;
    const role = m.role === 'drawer' ? 'drawer' as const : 'cabinet' as const;
    const edge = side < 0 ? bx0 : bx1, x = role === 'cabinet' ? edge + side * RUNNER_CLEARANCE / 2 : edge - side * ((m.xOffsetMm ?? 0) / 10 + w / 2 - RUNNER_CLEARANCE / 2);
    const y = role === 'cabinet' ? ys - BOTTOM_GAP + h / 2 : ys - h / 2 + .1;
    return { name: 'Runner', role, x, y, z: frontBack - .3 - d / 2, w, h, d };
  }));
  return { box, runners, length, travel: drawerTravel(length) };
}
