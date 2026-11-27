/**
 * A piece that stands against a wall and takes the wall's angle: toilets, basins. It slides along its wall, lining up with
 * the wall's middle, a window, its ends, the clearance a person needs from a wall end and its neighbours on the wall. A
 * hanging piece (a kitchen wall unit, a shelf) also moves up and down its wall.
 */
import { wallFace, wallLine } from '../studio/studio';
import type { Studio } from '../studio/studio';
import { Piece } from './piece';
import { sameKey } from './piece-model';
import type { Alignable, Mobility, PieceGuide, PieceTarget, Room } from './piece-model';

export abstract class WallPiece<D> extends Piece<D> implements Alignable {
  readonly mobility: Mobility = 'along-wall';
  /** The wall it stands against, and its middle along the wall from corner a. */
  abstract wallId(studio: Studio | undefined): string | null;
  abstract offset(studio: Studio | undefined): number;
  /** The clearance a person needs between its side and a wall end or a neighbour. */
  abstract readonly side: number;
  /** A kind's own places to line up with (a toilet's boxing). */
  protected extraTargets(_room: Room): PieceTarget[] { return []; }

  targets(room: Room, wallId: string): PieceTarget[] {
    const studio = room.studio, w = studio?.walls.find(x => x.id === wallId), face = studio && w && wallFace(studio, w), line = studio && w && wallLine(studio, w);
    if (!studio || !face || !line) return [];
    const half = this.body(studio).width / 2, mid = (face.start + face.end) / 2, unit = ' cm';
    const out: PieceTarget[] = [{ v: mid, label: 'Centred on the wall', src: mid }];
    for (const o of studio.openings) if (o.wall === wallId && o.kind === 'window') out.push({ v: o.offset, label: 'Centred under the window', src: o.offset });
    out.push(...this.extraTargets(room));
    out.push({ v: face.start + half, label: 'Against the wall', src: face.start }, { v: face.end - half, label: 'Against the wall', src: face.end },
      { v: face.start + half + this.side, label: `${this.side}${unit} from the wall`, src: face.start },
      { v: face.end - half - this.side, label: `${this.side}${unit} from the wall`, src: face.end });
    // Its neighbours on the wall: other pieces standing square against it.
    for (const o of room.bodies) {
      if (sameKey(o.key, this.key) || !o.blocks || Math.abs(((o.angle - line.angle) % 360 + 540) % 360 - 180) > .5) continue;
      const out_ = (o.x - line.a.x) * line.nx + (o.z - line.a.z) * line.nz - w!.thickness / 2 - o.depth / 2;
      if (out_ > 40) continue;
      const t = (o.x - line.a.x) * line.ux + (o.z - line.a.z) * line.uz, l = t - o.width / 2, r = t + o.width / 2, gap = this.side;
      out.push({ v: l - gap - half, label: `${gap}${unit} from the ${o.noun}`, src: l }, { v: r + gap + half, label: `${gap}${unit} from the ${o.noun}`, src: r });
    }
    return out.map(t => ({ ...t, v: Math.round(t.v * 10) / 10 }));
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
