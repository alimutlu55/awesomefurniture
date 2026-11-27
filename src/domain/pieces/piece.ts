/**
 * The abstract piece: what every piece in a room does, written once. Its body in the room, the collision rule (walls,
 * shapes standing on the floor, doorways, every other piece), the gaps around it, its size limits and where a copy goes.
 * Concrete kinds (furnishing-piece.ts, fixture-piece.ts, cabinet-piece.ts) only say what they are.
 */
import type { Studio } from '../studio/studio';
import { wallLine } from '../studio/studio';
import { createCabinetGeometry } from '../geometry/cabinet-geometry.js';
import { gapsAround, type PlacedBox } from '../studio/scene-gaps';
import { groundedShapes, wallObstacles, type Obstacle } from '../studio/studio-obstacles';
import { placeAgainstWall, placeOnRoomFloor } from '../studio/studio-placement';
import { isWallUtility } from '../studio/wall-utilities';
import { furthestValid, piecePoint, steadyLine } from './piece-motion';
import { sameKey } from './piece-model';
import type {
  Aim, Body, Capabilities, Collidable, Duplicable, Finishable, Measurable, Mobility, MoveOptions, MoveOutcome, Needs, Outcome,
  PieceFinishGroup, PieceGap, PieceKey, PieceType, Placeable, PlaceHint, Placement, Pose, Resizable, ResizeAnchor, Room, Size, SizedPose, SizeLimits, Typed,
} from './piece-model';

/** A body in the collision rules' box form. */
export const bodyObstacle = (b: Body): Obstacle => ({ id: b.key.family + ':' + b.key.id, x: b.x, y: b.y, z: b.z, angle: b.angle, state: { w: b.width, d: b.depth, h: b.height } });
/** A body as the measuring rule's box, under a number of the caller's choosing. */
export const bodyBox = (b: Body, id: number): PlacedBox => ({ id, x: b.x, z: b.z, y: b.y, angle: b.angle, w: b.width, d: b.depth, h: Math.max(b.height, 1) });
/** Shrunk a little: a piece standing flush against a wall or a neighbour touches it, which is fine. */
const shrink = (o: Obstacle): Obstacle => ({ ...o, y: o.y + .05, state: { w: o.state.w - .2, d: o.state.d - .2, h: Math.max(.05, o.state.h - .1) } });
export const sizeAxes = ['width', 'depth', 'height'] as const;
export const roundPiece = (value: number) => Math.round(value * 10) / 10;
/** Defaults are stored by absence in the saved data. */
export function changePieceLook<D extends object>(data: D, look: Partial<D>): D {
  const next: D = { ...data, ...look };
  for (const key of Object.keys(look) as (keyof D)[]) if (look[key] === undefined) delete next[key];
  return next;
}

const geometry = createCabinetGeometry(() => []);
const overlaps = (a: Obstacle, b: Obstacle) => geometry.cabinetOverlaps(a, b);

/** The floor a person walks through at each door and archway: as wide as it, 50 cm into the room. */
export function doorways(studio: Studio): Obstacle[] {
  return studio.openings.flatMap(o => {
    const w = studio.walls.find(x => x.id === o.wall), line = w && wallLine(studio, w);
    if (!w || !line || isWallUtility(o.kind) || o.kind === 'window' || o.sill > 1) return [];
    const depth = 50, off = w.thickness / 2 + depth / 2;
    return [{ id: 'doorway:' + o.id, x: line.a.x + line.ux * o.offset + line.nx * off, y: 0, z: line.a.z + line.uz * o.offset + line.nz * off,
      angle: line.angle, state: { w: o.width, d: depth, h: o.height } }];
  });
}

export { steadyLine };

export abstract class Piece<D> implements Placeable, Collidable, Measurable, Resizable, Duplicable, Typed<D>, Finishable<D> {
  constructor(readonly data: D) {}
  abstract readonly key: PieceKey;
  /** Lowercase noun for messages: "bed", "toilet". */
  abstract readonly noun: string;
  abstract readonly needs: Needs;
  abstract readonly mobility: Mobility;
  abstract body(studio: Studio | undefined): Body;
  abstract limits(): SizeLimits;
  size(room: Room): Size {
    const { width, depth, height } = this.body(room.studio);
    return { width, depth, height };
  }
  types(): readonly PieceType[] { return []; }
  withType(_id: string): D | null { return null; }
  finishGroups(): readonly PieceFinishGroup[] { return []; }
  withFinish(_group: string, _id: string): D | null { return null; }

  protected sizeAt(room: Room, change: Partial<Size>, keep: ResizeAnchor): SizedPose {
    const body = this.body(room.studio), size = { ...this.size(room), ...change };
    const at = piecePoint(body, 0, keep === 'back' ? (size.depth - this.size(room).depth) / 2 : 0);
    return { ...size, ...at, y: body.y, angle: body.angle };
  }

  resize(room: Room, change: Partial<Size>, keep: ResizeAnchor = 'middle'): Outcome<SizedPose> {
    const wanted = { ...this.size(room), ...change }, limits = this.limits();
    const bad = sizeAxes.find(axis => !Number.isFinite(wanted[axis]) || wanted[axis] < limits[axis][0] - .01 || wanted[axis] > limits[axis][1] + .01);
    if (bad) return { value: null, reason: `The ${this.noun}'s ${bad} must be ${limits[bad][0]}–${limits[bad][1]} cm.` };
    const next = this.sizeAt(room, change, keep), reason = this.positionProblem(room, next, next);
    return reason ? { value: null, reason } : { value: next };
  }

  protected positionProblem(room: Room, pose: Pose, size?: Size): string | null {
    const body = this.body(room.studio);
    return this.clashes(room, { ...body, ...size, ...pose, y: pose.y ?? body.y })[0] ?? null;
  }

  protected accepts(room: Room, placement: Placement, hint: PlaceHint) {
    return hint.accept ? hint.accept(placement) : !this.positionProblem(room, placement, placement.size);
  }

  place(room: Room, hint: PlaceHint = {}): Placement | null {
    const body = this.body(room.studio), size = this.size(room), footprint = { w: size.width, d: size.depth };
    const at = (pose: Pose): Placement => ({ x: pose.x, y: body.y, z: pose.z, angle: pose.angle, size });
    const collides = (pose: Pose) => !this.accepts(room, at(pose), hint);
    const studio = room.studio;
    if (!studio) return collides(body) ? null : at(body);
    const pose = placeAgainstWall(studio, footprint, collides, hint.wallId, hint.near)
      ?? (!hint.wallId ? placeOnRoomFloor(studio, footprint, collides, body.angle) : null);
    return pose ? at(pose) : null;
  }

  protected resolveMove(room: Room, to: Aim, options: MoveOptions): MoveOutcome {
    const from = options.from ?? this.body(room.studio);
    const problem = options.problem ?? ((pose: Pose) => this.positionProblem(room, pose));
    const candidate = (t: number): Pose => ({
      x: from.x + (to.pose.x - from.x) * t, z: from.z + (to.pose.z - from.z) * t, angle: to.pose.angle,
      y: (from.y ?? 0) + ((to.pose.y ?? from.y ?? 0) - (from.y ?? 0)) * t,
    });
    const goal = candidate(1), reason = problem(goal);
    if (!reason) return { value: goal, lock: to.lock, guides: to.guides };
    const value = options.exact ? null : furthestValid(candidate, pose => !problem(pose)).room;
    return { value, reason, lock: to.lock, guides: [] };
  }
  /** In other pieces' way. A rug is not. */
  get blocks() { return true; }
  /** Its collision rule checks the doorways too (a fixture checks the doors on its own wall itself). */
  protected get keepsDoorwaysClear() { return true; }
  /** The families whose pieces it may not run into here (cabinets are checked by the commands, which know them). */
  protected collidesWith(other: Body) { return other.blocks; }

  get capabilities(): Capabilities {
    return { mobility: this.mobility, turnable: false, typed: this.types().length > 1, resizable: true, finishable: this.finishGroups().length > 0, duplicable: true };
  }

  /** Why it cannot be where it is, worded as what to do about it: a wall, a shape standing on the floor, a doorway, another piece. */
  protected collisionBox(body: Body) { return shrink(bodyObstacle(body)); }

  clashes(room: Room, body = this.body(room.studio)): string[] {
    const studio = room.studio, me = this.collisionBox(body), out: string[] = [];
    if (studio && wallObstacles(studio).some(o => overlaps(me, o))) return [`The ${this.noun} runs into a wall. Move it into the room.`];
    if (!this.blocks) return out;
    if (studio && groundedShapes(studio).some(o => overlaps(me, o))) out.push(`The ${this.noun} runs into a pillar or boxing. Move it.`);
    if (studio && this.keepsDoorwaysClear && doorways(studio).some(o => overlaps(me, o))) out.push(`The ${this.noun} stands in a doorway. Move it.`);
    return [...out, ...this.pieceClashes(room, me)];
  }

  protected pieceClashes(room: Room, me = shrink(bodyObstacle(this.body(room.studio)))): string[] {
    const other = room.bodies.find(b => !sameKey(b.key, this.key) && this.collidesWith(b) && overlaps(me, shrink(bodyObstacle(b))));
    return other ? [`The ${this.noun} runs into the ${other.noun}. Move one of them.`] : [];
  }

  /** The free floor on each side to the walls and every other piece, from the middle of each side, short where it is
   * less than a person needs (in front of a desk, beside and at the foot of a bed). */
  gaps(room: Room, { includeWalls = true, includeContact = false } = {}): PieceGap[] {
    const b = this.body(room.studio), others = room.bodies.filter(o => o.blocks && !sameKey(o.key, this.key)).map((o, i) => bodyBox(o, -1 - i));
    const walls = includeWalls ? room.studio : undefined;
    return gapsAround(bodyBox(b, 0), others, walls, ['left', 'right', 'front', 'back']).filter(g => (includeContact || g.distance > .5) && g.distance < 400).flatMap(g => {
      const line = steadyLine(b, g.side, g.distance), side = g.side as PieceGap['side'];
      if (!line) return [];
      const need = side === 'front' ? this.needs.front : side === 'left' || side === 'right' ? this.needs.sides : 0;
      return [{ side, distance: g.distance, ...line, short: need > 0 && g.distance < need }];
    });
  }

  copyPose(room: Room, hint: PlaceHint = {}): Pose | null {
    const size = this.size(room);
    return this.copyPoses(room).find(pose => this.accepts(room, { ...pose, size }, hint)) ?? this.copyFallback(room, hint);
  }

  protected copyFallback(room: Room, hint: PlaceHint): Placement | null { return this.place(room, hint); }

  /** Where a copy may go, nearest first: beside it on its right, on its left, in front, behind. */
  copyPoses(room: Room): Pose[] {
    const b = this.body(room.studio);
    return ([[b.width + 5, 0], [-b.width - 5, 0], [0, b.depth + 5], [0, -b.depth - 5]] as const).map(([s, t]) => ({ ...piecePoint(b, s, t), angle: b.angle }));
  }
}
