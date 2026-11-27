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
import { isWallUtility } from '../studio/wall-utilities';
import { piecePoint, steadyLine } from './piece-motion';
import { sameKey } from './piece-model';
import type { Body, Capabilities, Collidable, Duplicable, Measurable, Mobility, Needs, PieceGap, PieceKey, Placeable, Pose, Resizable, Room, SizeLimits } from './piece-model';

/** A body in the collision rules' box form. */
export const bodyObstacle = (b: Body): Obstacle => ({ id: b.key.family + ':' + b.key.id, x: b.x, y: b.y, z: b.z, angle: b.angle, state: { w: b.width, d: b.depth, h: b.height } });
/** A body as the measuring rule's box, under a number of the caller's choosing. */
export const bodyBox = (b: Body, id: number): PlacedBox => ({ id, x: b.x, z: b.z, y: b.y, angle: b.angle, w: b.width, d: b.depth, h: Math.max(b.height, 1) });
/** Shrunk a little: a piece standing flush against a wall or a neighbour touches it, which is fine. */
const shrink = (o: Obstacle): Obstacle => ({ ...o, y: o.y + .05, state: { w: o.state.w - .2, d: o.state.d - .2, h: Math.max(.05, o.state.h - .1) } });
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

export abstract class Piece<D> implements Placeable, Collidable, Measurable, Resizable, Duplicable {
  constructor(readonly data: D) {}
  abstract readonly key: PieceKey;
  /** Lowercase noun for messages: "bed", "toilet". */
  abstract readonly noun: string;
  abstract readonly needs: Needs;
  abstract readonly mobility: Mobility;
  abstract body(studio: Studio | undefined): Body;
  abstract limits(): SizeLimits;
  /** In other pieces' way. A rug is not. */
  get blocks() { return true; }
  /** Its collision rule checks the doorways too (a fixture checks the doors on its own wall itself). */
  protected get keepsDoorwaysClear() { return true; }
  /** The families whose pieces it may not run into here (cabinets are checked by the commands, which know them). */
  protected collidesWith(other: Body) { return other.blocks; }

  get capabilities(): Capabilities {
    return { mobility: this.mobility, turnable: false, typed: false, resizable: true, finishable: false, duplicable: true };
  }

  /** Why it cannot be where it is, worded as what to do about it: a wall, a shape standing on the floor, a doorway, another piece. */
  clashes(room: Room): string[] {
    const studio = room.studio, me = shrink(bodyObstacle(this.body(studio))), out: string[] = [];
    if (studio && wallObstacles(studio).some(o => overlaps(me, o))) return [`The ${this.noun} runs into a wall. Move it into the room.`];
    if (!this.blocks) return out;
    if (studio && groundedShapes(studio).some(o => overlaps(me, o))) out.push(`The ${this.noun} runs into a pillar or boxing. Move it.`);
    if (studio && this.keepsDoorwaysClear && doorways(studio).some(o => overlaps(me, o))) out.push(`The ${this.noun} stands in a doorway. Move it.`);
    const other = room.bodies.find(b => !sameKey(b.key, this.key) && this.collidesWith(b) && overlaps(me, shrink(bodyObstacle(b))));
    if (other) out.push(`The ${this.noun} runs into the ${other.noun}. Move one of them.`);
    return out;
  }

  /** The free floor on each side to the walls and every other piece, from the middle of each side, short where it is
   * less than a person needs (in front of a desk, beside and at the foot of a bed). */
  gaps(room: Room): PieceGap[] {
    const b = this.body(room.studio), others = room.bodies.filter(o => o.blocks && !sameKey(o.key, this.key)).map((o, i) => bodyBox(o, -1 - i));
    return gapsAround(bodyBox(b, 0), others, room.studio, ['left', 'right', 'front', 'back']).filter(g => g.distance > .5 && g.distance < 400).flatMap(g => {
      const line = steadyLine(b, g.side, g.distance), side = g.side as PieceGap['side'];
      if (!line) return [];
      const need = side === 'front' ? this.needs.front : side === 'left' || side === 'right' ? this.needs.sides : 0;
      return [{ side, distance: g.distance, ...line, short: need > 0 && g.distance < need }];
    });
  }

  /** Where a copy may go, nearest first: beside it on its right, on its left, in front, behind. */
  copyPoses(room: Room): Pose[] {
    const b = this.body(room.studio);
    return ([[b.width + 5, 0], [-b.width - 5, 0], [0, b.depth + 5], [0, -b.depth - 5]] as const).map(([s, t]) => ({ ...piecePoint(b, s, t), angle: b.angle }));
  }
}
