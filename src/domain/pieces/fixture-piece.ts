/** Toilets and basins: wall pieces whose kind (fixture-kinds.ts) says their types, sizes, finishes and the floor they need.
 * Where one stands comes from its wall and the boxing behind it (fixture-place.ts); its own rules (a window sill, its
 * boxing) stay in fixture-validation.ts and fixture-setup.ts, called from here. */
import type { Studio, StudioFixture, wallLine } from '../studio/studio';
import { fixtureKind, fixtureType } from '../studio/fixtures/fixture-kinds';
import { fixturePlace } from '../studio/fixtures/fixture-place';
import { slideFixture, standingAgainst, standsOnFloor } from '../studio/fixtures/fixture-setup';
import { WallPiece } from './wall-piece';
import type { Body, Capabilities, Needs, PieceKey, PieceTarget, Room, SizeLimits } from './piece-model';

export class Fixture extends WallPiece<StudioFixture> {
  get key(): PieceKey { return { family: 'fixture', id: this.data.id }; }
  get noun() { return fixtureKind(this.data.kind)?.name.toLowerCase() ?? 'fixture'; }
  get needs(): Needs { return { front: fixtureKind(this.data.kind)?.use ?? 0, sides: 0 }; }
  get side() { return fixtureKind(this.data.kind)?.side ?? 0; }
  /** The fixture's wall, doors, windows and boxing are validated by fixture-validation. */
  override clashes(room: Room) { return this.pieceClashes(room); }
  /** Walls, shapes and other fixtures are its own rules; here it meets the rest of the room: beds, desks, other furniture. */
  protected override collidesWith(other: Body) { return other.blocks && other.key.family === 'furnishing'; }
  wallId() { return this.data.wall; }
  offset() { return this.data.offset; }
  slide(studio: Studio, offset: number) { return slideFixture(studio, this.data.id, offset); }
  protected override neighbour(body: Body, studio: Studio, wallId: string, line: NonNullable<ReturnType<typeof wallLine>>, thickness: number) {
    if (body.key.family !== 'fixture') return super.neighbour(body, studio, wallId, line, thickness);
    const other = studio.fixtures?.find(f => f.id === body.key.id && f.wall === wallId);
    return other ? { offset: other.offset, gap: Math.max(this.side, fixtureKind(other.kind)?.side ?? 0) } : null;
  }
  body(studio: Studio | undefined): Body {
    const f = this.data, place = studio && fixturePlace(studio, f);
    const solid = place?.solid ?? { x: 0, y: 0, z: 0, angle: 0, state: { w: f.width, d: f.depth, h: f.height } };
    return { key: this.key, noun: this.noun, blocks: true, x: solid.x, y: solid.y, z: solid.z, angle: solid.angle,
      width: solid.state.w, depth: solid.state.d, height: solid.state.h };
  }
  limits(): SizeLimits {
    const t = fixtureType(this.data.kind, this.data.type);
    return t?.limits ?? { width: [1, 1000], depth: [1, 1000], height: [1, 500] };
  }
  override get capabilities(): Capabilities {
    const kind = fixtureKind(this.data.kind), type = fixtureType(this.data.kind, this.data.type);
    const typed = !!kind?.tap || (kind?.setups?.length ?? kind?.types.length ?? 0) > 1;
    const finishable = kind?.finishes.some(group => group !== 'front' || type?.cabinet) ?? false;
    return { ...super.capabilities, typed, finishable };
  }

  /** A boxing on its wall (not its own, which goes with it): centred on it, flush with its ends, or beside it. */
  protected override extraTargets(room: Room): PieceTarget[] {
    const studio = room.studio, f = this.data, half = f.width / 2, out: PieceTarget[] = [];
    for (const c of studio?.ceilings ?? []) {
      if (c.wall !== f.wall || c.run !== 'along' || !standsOnFloor(c) || standingAgainst(studio!, c.id).every(x => x.id === f.id)) continue;
      const ts = c.outline!.map(p => p.t), from = Math.min(...ts), to = Math.max(...ts);
      out.push({ v: (from + to) / 2, label: 'Centred on the boxing', src: (from + to) / 2 },
        { v: from + half, label: 'Flush with the boxing', src: from }, { v: to - half, label: 'Flush with the boxing', src: to },
        { v: from - half, label: 'Beside the boxing', src: from }, { v: to + half, label: 'Beside the boxing', src: to });
    }
    return out;
  }
}
