/**
 * A piece that stands against a wall and takes the wall's angle: toilets, basins. It slides along its wall, lining up with
 * the wall's middle, a window, its ends, the clearance a person needs from a wall end and its neighbours on the wall. A
 * hanging piece (a kitchen wall unit, a shelf) also moves up and down its wall.
 */
import { wall, wallFace, wallLine } from '../studio/studio';
import type { Studio } from '../studio/studio';
import { AUTO_ALIGN_CM, resolveAlignment } from '../geometry/alignment';
import { furthestValid } from './piece-motion';
import { Piece, roundPiece } from './piece';
import { sameKey } from './piece-model';
import type { Alignable, Body, FollowsRoom, Mobility, Movable, MoveOptions, MoveOutcome, PieceGuide, PieceTarget, PlaceHint, Placement, Pose, Room, WallChange, WallPlacement } from './piece-model';

type WallLine = NonNullable<ReturnType<typeof wallLine>>;
function* wallOffsets(from: number, start: number, end: number) {
  if (!Number.isFinite(from)) return;
  for (let distance = 0; distance <= end - start; distance += 5) {
    for (const offset of distance ? [from - distance, from + distance] : [from]) {
      if (offset >= start && offset <= end) yield offset;
    }
  }
}

export abstract class WallPiece<D> extends Piece<D> implements Alignable, Movable, FollowsRoom {
  readonly mobility: Mobility = 'along-wall';
  /** The wall it stands against, and its middle along the wall from corner a. */
  abstract wallId(studio: Studio | undefined): string | null;
  abstract offset(studio: Studio | undefined): number;
  /** The clearance a person needs between its side and a wall end or a neighbour. */
  abstract readonly side: number;
  /** A kind's own places to line up with (a toilet's boxing). */
  protected extraTargets(_room: Room): PieceTarget[] { return []; }

  protected neighbour(body: Body, _studio: Studio, _wallId: string, line: WallLine, thickness: number) {
    if (Math.abs(((body.angle - line.angle) % 360 + 540) % 360 - 180) > .5) return null;
    const out = (body.x - line.a.x) * line.nx + (body.z - line.a.z) * line.nz - thickness / 2 - body.depth / 2;
    if (out > 40) return null;
    return { offset: (body.x - line.a.x) * line.ux + (body.z - line.a.z) * line.uz, gap: this.side };
  }

  range(studio: Studio, id = this.wallId(studio)): readonly [number, number] | null {
    const w = id && wall(studio, id), face = w && wallFace(studio, w);
    if (!face) return null;
    const half = this.body(studio).width / 2;
    return [face.start + half, face.end - half];
  }

  protected poseOnWall(studio: Studio, wallId: string, offset: number, y?: number): WallPlacement | null {
    const w = wall(studio, wallId), line = w && wallLine(studio, w);
    if (!w || !line) return null;
    const body = this.body(studio), out = (w.thickness + body.depth) / 2;
    return { wall: wallId, offset, x: line.a.x + line.ux * offset + line.nx * out, z: line.a.z + line.uz * offset + line.nz * out,
      y: y ?? body.y, angle: line.angle };
  }

  override place(room: Room, hint: PlaceHint = {}): Placement | null {
    const studio = room.studio;
    if (!studio) return null;
    const size = this.size(room);
    const walls = hint.wallId ? studio.walls.filter(w => w.id === hint.wallId)
      : studio.walls.slice().sort((a, b) => (wallLine(studio, b)?.length ?? 0) - (wallLine(studio, a)?.length ?? 0));
    for (const w of walls) {
      const face = wallFace(studio, w);
      if (!face) continue;
      for (const offset of wallOffsets(hint.near ?? (face.start + face.end) / 2, face.start, face.end)) {
        const pose = this.poseOnWall(studio, w.id, offset);
        if (pose && this.accepts(room, { ...pose, size, wallId: w.id }, hint)) return { ...pose, size, wallId: w.id };
      }
    }
    return null;
  }

  protected override copyFallback(): null { return null; }

  override copyPoses(room: Room): Placement[] {
    const studio = room.studio, id = this.wallId(studio), w = studio && id && wall(studio, id), face = studio && w && wallFace(studio, w);
    if (!studio || !w || !face) return [];
    const current = this.offset(studio), size = this.size(room);
    return [...wallOffsets(current, face.start, face.end)].flatMap(offset => {
      const pose = Math.abs(offset - current) >= size.width && this.poseOnWall(studio, w.id, offset);
      return pose ? [{ ...pose, wallId: w.id, size }] : [];
    });
  }

  /** Keeps the old point along a changed wall or transfers the piece across a wall split. */
  followRoom(before: Studio, after: Studio, split?: WallChange): WallPlacement | null {
    const id = this.wallId(before), w = id && wall(before, id), old = w && wallLine(before, w);
    const t = this.offset(before);
    if (!id || !old) return null;
    if (split) return split.wall === id && t >= split.at
      ? this.poseOnWall(after, split.second, roundPiece(t - split.at)) : this.poseOnWall(after, id, t);
    const next = wall(after, id), now = next && wallLine(after, next), range = this.range(after, id);
    if (!now || !range) return null;
    if (old.a.x === now.a.x && old.a.z === now.a.z && old.b.x === now.b.x && old.b.z === now.b.z) return this.poseOnWall(after, id, t);
    const x = old.a.x + old.ux * t, z = old.a.z + old.uz * t;
    const along = (x - now.a.x) * now.ux + (z - now.a.z) * now.uz;
    const [min, max] = range;
    return this.poseOnWall(after, id, roundPiece(max < min ? along : Math.max(min, Math.min(max, along))));
  }

  moveAlong(room: Room, offset: number, from: number, lock: PieceTarget | null, free: boolean, problem: (offset: number) => string | null, format?: (cm: number) => string) {
    const aim = this.aimAlong(room, offset, lock, free, format);
    const at = (t: number) => from + (aim.offset - from) * t;
    const reason = problem(aim.offset);
    const result = reason ? furthestValid(at, value => !problem(value)) : { room: aim.offset, whole: true };
    return { value: result.room, reason, lock: aim.lock, guides: result.whole ? aim.guides : [] };
  }

  move(room: Room, to: Pose, options: MoveOptions = {}): MoveOutcome {
    const studio = room.studio, id = this.wallId(studio), w = studio && id && wall(studio, id), line = studio && w && wallLine(studio, w);
    if (!studio || !w || !line) return { value: null, reason: 'Choose a wall first.', lock: null, guides: [] };
    const offset = (pose: Pose) => (pose.x - line.a.x) * line.ux + (pose.z - line.a.z) * line.uz;
    const at = (t: number) => this.poseOnWall(studio, w.id, t, this.mobility === 'on-wall' ? to.y : undefined);
    const problem = options.problem ?? ((pose: Pose) => {
      const range = this.range(studio, w.id), t = offset(pose);
      return !range || t < range[0] - .01 || t > range[1] + .01 ? 'Keep it on its wall.' : this.positionProblem(room, pose);
    });
    const from = options.from ? offset(options.from) : this.offset(studio);
    const moved = this.moveAlong(room, offset(to), from, options.lock ?? null, options.free ?? false, t => problem(at(t)!));
    return { value: moved.value === null || (options.exact && moved.reason) ? null : at(moved.value), lock: moved.lock, guides: moved.guides,
      ...(moved.reason ? { reason: moved.reason } : {}) };
  }

  targets(room: Room, wallId: string, format = (cm: number) => cm + ' cm'): PieceTarget[] {
    const studio = room.studio, w = studio?.walls.find(x => x.id === wallId), face = studio && w && wallFace(studio, w), line = studio && w && wallLine(studio, w);
    if (!studio || !w || !face || !line) return [];
    const half = this.body(studio).width / 2, mid = (face.start + face.end) / 2;
    const out: PieceTarget[] = [{ v: mid, label: 'Centred on the wall', src: mid }];
    for (const o of studio.openings) if (o.wall === wallId && o.kind === 'window') out.push({ v: o.offset, label: 'Centred under the window', src: o.offset });
    out.push(...this.extraTargets(room));
    out.push({ v: face.start + half, label: 'Against the wall', src: face.start }, { v: face.end - half, label: 'Against the wall', src: face.end },
      { v: face.start + half + this.side, label: `${format(this.side)} from the wall`, src: face.start },
      { v: face.end - half - this.side, label: `${format(this.side)} from the wall`, src: face.end });
    // Its neighbours on the wall: other pieces standing square against it.
    for (const o of room.bodies) {
      if (sameKey(o.key, this.key) || !o.blocks) continue;
      const neighbour = this.neighbour(o, studio, wallId, line, w.thickness);
      if (!neighbour) continue;
      const { offset, gap } = neighbour, l = offset - o.width / 2, r = offset + o.width / 2;
      out.push({ v: l - gap - half, label: `${format(gap)} from the ${o.noun}`, src: l }, { v: r + gap + half, label: `${format(gap)} from the ${o.noun}`, src: r });
    }
    return out.map(t => ({ ...t, v: roundPiece(t.v) }));
  }

  aimAlong(room: Room, offset: number, lock: PieceTarget | null, free: boolean, format?: (cm: number) => string) {
    const studio = room.studio, id = this.wallId(studio), within = studio && this.range(studio);
    const hit = !free && id && within
      ? resolveAlignment(offset, this.targets(room, id, format), { tolerance: AUTO_ALIGN_CM, hold: 1, lock, within }) : null;
    return { offset: hit?.v ?? offset, lock: hit, guides: hit && studio ? this.guide(studio, hit) : [] };
  }

  /** The guide for a caught target: a line up the wall's face where it lines up. */
  guide(studio: Studio, target: PieceTarget): PieceGuide[] {
    const id = this.wallId(studio), w = studio.walls.find(x => x.id === id), line = w && wallLine(studio, w);
    if (!w || !line || target.src === undefined) return [];
    const z = w.thickness / 2 + 1, at = (y: number) => ({ x: line.a.x + line.ux * target.src! + line.nx * z, y, z: line.a.z + line.uz * target.src! + line.nz * z });
    return [{ a: at(0), b: at(Math.min(w.height, 210)), label: target.label }];
  }
}

/** Hangs on a wall at a height: it moves along its wall and up and down it. */
export abstract class HangingPiece<D> extends WallPiece<D> {
  override readonly mobility: Mobility = 'on-wall';
}
