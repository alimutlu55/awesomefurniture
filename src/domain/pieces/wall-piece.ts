/**
 * A piece that stands against a wall and takes the wall's angle: toilets, basins. It slides along its wall, lining up with
 * the wall's middle, a window, its ends, the clearance a person needs from a wall end and its neighbours on the wall. A
 * hanging piece (a kitchen wall unit, a shelf) also moves up and down its wall.
 */
import { wall, wallFace, wallLine } from '../studio/studio';
import type { Studio } from '../studio/studio';
import { AUTO_ALIGN_CM, resolveAlignment } from '../geometry/alignment';
import { Piece } from './piece';
import { sameKey } from './piece-model';
import type { Alignable, Body, Mobility, PieceGuide, PieceTarget, Room } from './piece-model';

type WallLine = NonNullable<ReturnType<typeof wallLine>>;
const tenth = (cm: number) => Math.round(cm * 10) / 10;

export abstract class WallPiece<D> extends Piece<D> implements Alignable {
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

  range(studio: Studio): readonly [number, number] | null {
    const id = this.wallId(studio), w = id && wall(studio, id), face = w && wallFace(studio, w);
    if (!face) return null;
    const half = this.body(studio).width / 2;
    return [face.start + half, face.end - half];
  }

  /** Keeps the piece at its previous point along a wall as its corners move. */
  followWall(before: Studio, after: Studio): number | null {
    const id = this.wallId(before), w = id && wall(before, id), old = w && wallLine(before, w), now = w && wallLine(after, w);
    const range = this.range(after);
    if (!old || !now || !range) return null;
    const t = this.offset(before), x = old.a.x + old.ux * t, z = old.a.z + old.uz * t;
    const along = (x - now.a.x) * now.ux + (z - now.a.z) * now.uz;
    const [min, max] = range;
    return tenth(max < min ? along : Math.max(min, Math.min(max, along)));
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
    return out.map(t => ({ ...t, v: tenth(t.v) }));
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
