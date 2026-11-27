/**
 * A piece that stands anywhere on the floor at any angle: wardrobes and other cabinets, kitchen base and tall units, beds,
 * desks, rugs. Moving and turning are written here once: near a wall it squares up flush against it and lines up along it
 * (the wall's middle, a window, its ends, the piece beside it); turns snap in 5° steps, catch a quarter turn, and slide
 * out of a wall they would turn into.
 */
import type { Studio } from '../studio/studio';
import { wallFace, wallLine } from '../studio/studio';
import { createCabinetGeometry } from '../geometry/cabinet-geometry.js';
import { ROOM_SNAP_CM, resolveAlignment } from '../geometry/alignment';
import { pushOutOfWalls, snapToWall } from '../studio/studio-placement';
import { wallObstacles } from '../studio/studio-obstacles';
import { snapTurn } from './piece-motion';
import { Piece } from './piece';
import { sameKey } from './piece-model';
import type { Aim, Alignable, Capabilities, Mobility, Movable, MoveOptions, PieceGuide, PieceTarget, Pose, Room, Turnable } from './piece-model';

const turned = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

export abstract class FloorPiece<D> extends Piece<D> implements Turnable, Alignable, Movable {
  readonly mobility: Mobility = 'floor';
  /** Squares up against a wall it comes near while dragged. A rug does not. */
  protected get snapsToWalls() { return true; }

  override get capabilities(): Capabilities { return { ...super.capabilities, turnable: true }; }

  /** Where it lines up along wall `wallId`: its middle on the wall's or a window's, its side against a wall end, and
   * beside or centred on another piece turned the same way against that wall. Values of its middle along the wall from corner a. */
  targets(room: Room, wallId: string): PieceTarget[] {
    const studio = room.studio, w = studio?.walls.find(x => x.id === wallId), line = studio && w && wallLine(studio, w), face = studio && w && wallFace(studio, w);
    if (!studio || !w || !line || !face) return [];
    const half = this.body(studio).width / 2, mid = (face.start + face.end) / 2, out: PieceTarget[] = [{ v: mid, label: 'Centred on the wall', src: mid }];
    for (const o of studio.openings) if (o.wall === wallId && o.kind === 'window') out.push({ v: o.offset, label: 'Centred under the window', src: o.offset });
    out.push({ v: face.start + half, label: 'Against the wall', src: face.start }, { v: face.end - half, label: 'Against the wall', src: face.end });
    for (const o of room.bodies) {
      if (sameKey(o.key, this.key) || !o.blocks || turned(o.angle, line.angle) > .5) continue;
      const t = (o.x - line.a.x) * line.ux + (o.z - line.a.z) * line.uz, l = t - o.width / 2, r = t + o.width / 2;
      out.push({ v: t, label: 'Centred on the ' + o.noun, src: t }, { v: l - half - 3, label: 'Beside the ' + o.noun, src: l },
        { v: r + half + 3, label: 'Beside the ' + o.noun, src: r });
    }
    return out;
  }

  /** Where it goes for a pointer that puts its middle at `raw`: near a wall (15 cm, turned less than 20°) it squares up flush
   * against it and lines up along it, holding `lock` a little longer; `free` (Shift) goes just where the pointer says. The
   * guide is a line on the floor out from the wall where it lines up. Whether it may stand there is the caller's to check. */
  aim(room: Room, raw: Pose, lock: PieceTarget | null, free: boolean, tolerance = ROOM_SNAP_CM): Aim {
    const studio = room.studio, none: Aim = { pose: raw, lock: null, guides: [] };
    if (free || !studio || !this.snapsToWalls) return none;
    const b = this.body(studio), flush = snapToWall(studio, raw, { w: b.width, d: b.depth }, 15, 20);
    if (!flush) return none;
    const w = studio.walls.find(x => {
      const l = wallLine(studio, x);
      return l && turned(l.angle, flush.angle) < .5 && Math.abs((flush.x - l.a.x) * l.nx + (flush.z - l.a.z) * l.nz - x.thickness / 2 - b.depth / 2) < 1;
    });
    const line = w && wallLine(studio, w), face = w && wallFace(studio, w);
    if (!w || !line || !face) return { pose: flush, lock: null, guides: [] };
    const t = (flush.x - line.a.x) * line.ux + (flush.z - line.a.z) * line.uz;
    const hit = resolveAlignment(t, this.targets(room, w.id), { tolerance, hold: 1.5, lock, within: [face.start + b.width / 2, face.end - b.width / 2] });
    if (!hit) return { pose: flush, lock: null, guides: [] };
    const at = (s: number, out: number) => ({ x: line.a.x + line.ux * s + line.nx * (w.thickness / 2 + out), y: 1, z: line.a.z + line.uz * s + line.nz * (w.thickness / 2 + out) });
    const guides: PieceGuide[] = hit.src === undefined ? [] : [{ a: at(hit.src, 0), b: at(hit.src, b.depth + 25), label: hit.label }];
    return { pose: { x: flush.x + line.ux * (hit.v - t), z: flush.z + line.uz * (hit.v - t), angle: flush.angle, y: raw.y }, lock: hit, guides };
  }

  move(room: Room, to: Pose, options: MoveOptions = {}) {
    return this.resolveMove(room, this.aim(room, to, options.lock ?? null, options.free ?? false, options.tolerance), options);
  }

  /** Turned about its middle to `angle` (snapped unless `free`), slid out of any wall it would turn into. */
  turn(room: Room, angle: number, free: boolean): Pose {
    const b = this.body(room.studio), pose = { x: b.x, z: b.z, angle: snapTurn(angle, free) };
    return room.studio ? FloorPiece.outOfWalls(room.studio, pose, b) : pose;
  }
  quarterTurn(room: Room): Pose { return this.turn(room, this.body(room.studio).angle + 90, true); }

  /** A pose slid out of the walls it overlaps, the shortest way; the pose itself when it is clear or cannot be freed. */
  static outOfWalls(studio: Studio, pose: Pose, size: { width: number; depth: number; height: number; y?: number }): Pose {
    const walls = createCabinetGeometry(() => [], () => wallObstacles(studio));
    const state = { w: size.width, d: size.depth, h: size.height };
    return pushOutOfWalls(studio, pose, { w: size.width, d: size.depth }, p => walls.cabinetCollides({ ...p, y: size.y ?? 0, state })) ?? pose;
  }
}
