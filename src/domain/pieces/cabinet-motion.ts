import { createCabinetGeometry } from '../geometry/cabinet-geometry';
import { isKitchen } from '../furniture/furniture';
import { pushOutOfWalls } from '../studio/studio-placement';
import { studioObstacles } from '../studio/studio-obstacles';
import type { CabinetData } from './cabinet-piece';
import { piecePoint } from './piece-motion';
import { sizeAxes } from './piece';
import type { MoveOptions, MoveOutcome, Outcome, Pose, ResizeAnchor, Room, Size, SizeLimits, SizedPose } from './piece-model';

export function cabinetCollision(room: Room) {
  const obstacles = studioObstacles(room.studio);
  return createCabinetGeometry(() => room.cabinets ?? [], () => obstacles);
}
const dimension = { width: 'w', depth: 'd', height: 'h' } as const;

/** Cabinet sweeps include derived end panels, worktops and corner installations. */
export function moveCabinet(cabinet: CabinetData, room: Room, to: Pose, options: MoveOptions): MoveOutcome {
  const collision = cabinetCollision(room);
  const target = { ...to, y: to.y ?? cabinet.y ?? 0 };
  const at = options.exact ? [target] : [target, { ...target, z: cabinet.z }, { ...target, x: cabinet.x },
    { ...target, x: cabinet.x, z: cabinet.z }, { ...target, y: cabinet.y ?? 0 }];
  const travel = (p: Pose) => Math.hypot(p.x - cabinet.x, (p.y ?? 0) - (cabinet.y ?? 0), p.z - cabinet.z);
  const best = at.map(p => ({ ...collision.safeCabinetTranslation(cabinet, p), angle: cabinet.angle }))
    .reduce((best, pose) => travel(pose) > travel(best) + .01 ? pose : best);
  const reason = options.problem?.(best);
  return { value: reason ? null : best, ...(reason ? { reason } : {}), lock: null, guides: [] };
}

export function turnCabinet(cabinet: CabinetData, room: Room, angle: number, from?: Pick<Pose, 'x' | 'z'>): Pose {
  const collision = cabinetCollision(room), studio = room.studio;
  if (studio && from) {
    const obstacles = createCabinetGeometry(() => [], () => studioObstacles(studio));
    const pose = pushOutOfWalls(studio, { x: from.x, z: from.z, angle }, cabinet.state, p => obstacles.cabinetCollides({ ...cabinet, ...p }));
    if (pose && !collision.cabinetCollides({ ...cabinet, ...pose })) return { ...pose, y: cabinet.y };
  }
  return { x: cabinet.x, y: cabinet.y, z: cabinet.z, angle: collision.safeCabinetRotation(cabinet, angle) };
}

export function cabinetClashes(cabinet: CabinetData, room: Room): string[] {
  const collision = cabinetCollision(room), hit = collision.cabinetObstruction(cabinet);
  if (!hit) return [];
  if (hit === 'wall') return ['The cabinet runs into a wall. Move it into the room.'];
  if (hit === 'fixture') return ['The cabinet runs into a fixture. Move one of them.'];
  if (hit === 'furnishing') return ['The cabinet runs into room furniture. Move one of them.'];
  return ['The cabinet overlaps another cabinet or its installation parts. Move one of them.'];
}

export function resizeCabinet(cabinet: CabinetData, room: Room, changes: Partial<Size>, limits: SizeLimits, keep: ResizeAnchor): Outcome<SizedPose> {
  const collision = cabinetCollision(room);
  let next = cabinet;
  for (const axis of sizeAxes) {
    const value = changes[axis];
    if (value === undefined || value === next.state[dimension[axis]]) continue;
    if (!Number.isFinite(value) || value < limits[axis][0] || value > limits[axis][1]) {
      return { value: null, reason: `Keep the cabinet within its allowed ${axis}.` };
    }
    const state = { ...next.state, [dimension[axis]]: value };
    if (axis === 'depth' && keep === 'back') {
      const pose = piecePoint(next, 0, (value - next.state.d) / 2), candidate = { ...next, ...pose, state };
      if (collision.cabinetCollides(candidate)) return { value: null, reason: 'That depth runs into another piece or the room.' };
      next = candidate;
      continue;
    }
    const pose = collision.cabinetResizePose(next, dimension[axis], value, isKitchen(next.state));
    if (!pose) return { value: null, reason: 'That size runs into another piece or the room.' };
    next = { ...next, ...pose, state };
  }
  const { x, y, z, angle, state } = next;
  return { value: { x, y: y ?? 0, z, angle, width: state.w, depth: state.d, height: state.h } };
}
