/** Toilets and basins: wall pieces whose kind (fixture-kinds.ts) says their types, sizes, finishes and the floor they need.
 * Where one stands comes from its wall and the boxing behind it (fixture-place.ts); its own rules (a window sill, its
 * boxing) stay in fixture-validation.ts and fixture-setup.ts, called from here. */
import type { Studio, StudioFixture, wallLine } from '../studio/studio';
import { FINISHES, fixtureKind, fixtureType, type FinishGroup } from '../studio/fixtures/fixture-kinds';
import { fixtureProblems, fixtureClashes } from '../studio/fixtures/fixture-validation';
import { groundedShapes, wallObstacles } from '../studio/studio-obstacles';
import { fixturePlace } from '../studio/fixtures/fixture-place';
import { slideFixture, standingAgainst, standsOnFloor } from '../studio/fixtures/fixture-setup';
import { fixturePieceKind } from './piece-kinds';
import { changePieceLook, roundPiece } from './piece';
import { WallPiece } from './wall-piece';
import type { Body, Capabilities, Needs, PieceKey, PieceTarget, Pose, Room, Size, SizeLimits, SizedPose } from './piece-model';

export class Fixture extends WallPiece<StudioFixture> {
  get key(): PieceKey { return { family: 'fixture', id: this.data.id }; }
  get noun() { return fixturePieceKind(this.data.kind)?.source.name.toLowerCase() ?? 'fixture'; }
  get needs(): Needs { return fixturePieceKind(this.data.kind)?.needs ?? { front: 0, sides: 0 }; }
  get side() { return fixtureKind(this.data.kind)?.side ?? 0; }
  /** The fixture's wall, doors, windows and boxing are validated by fixture-validation. */
  override clashes(room: Room, body = this.body(room.studio)) { return this.pieceClashes(room, this.collisionBox(body)); }
  protected override positionProblem(room: Room, pose: Pose, size?: Size) {
    const studio = room.studio;
    const wall = 'wallId' in pose && typeof pose.wallId === 'string' ? pose.wallId
      : 'wall' in pose && typeof pose.wall === 'string' ? pose.wall : this.data.wall;
    const offset = 'offset' in pose && typeof pose.offset === 'number' ? pose.offset : this.data.offset;
    const candidate = new Fixture({ ...this.data, ...size, wall, offset });
    if (!studio) return 'Choose a wall first.';
    const own = fixtureProblems(studio, candidate.data)[0];
    if (own) return own;
    const fixtures = [...(studio.fixtures ?? []).filter(f => f.id !== candidate.data.id), candidate.data];
    const collision = fixtureClashes({ ...studio, fixtures }, wallObstacles(studio), groundedShapes(studio))[0];
    return collision ?? candidate.clashes(room)[0] ?? null;
  }
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
  protected override poseOnWall(studio: Studio, wallId: string, offset: number) {
    const placed = fixturePlace(studio, { ...this.data, wall: wallId, offset });
    return placed ? { wall: wallId, offset, x: placed.solid.x, z: placed.solid.z, y: placed.solid.y, angle: placed.solid.angle } : null;
  }

  override size(_room: Room): Size {
    const { width, depth, height } = this.data;
    return { width, depth, height };
  }

  protected override sizeAt(room: Room, change: Partial<Size>): SizedPose {
    const next = new Fixture(this.withSize(change)), { x, y, z, angle } = next.body(room.studio);
    return { ...next.size(room), x, y, z, angle };
  }

  withSize(size: Partial<Size>): StudioFixture {
    const rounded = Object.fromEntries(Object.entries(size).map(([key, value]) => [key, roundPiece(value)]));
    return { ...this.data, ...rounded };
  }

  override types() { return fixturePieceKind(this.data.kind)?.source.types ?? []; }
  override withType(id: string): StudioFixture | null {
    const type = this.types().find(t => t.id === id), f = this.data;
    if (!type) return null;
    if (type.id === f.type) return f;
    const keep = (axis: 'width' | 'height') => type.limits[axis][0] <= f[axis] && f[axis] <= type.limits[axis][1] ? f[axis] : type.size[axis];
    return { ...f, type: type.id, width: keep('width'), depth: type.size.depth, height: keep('height') };
  }

  override finishGroups() {
    const type = fixtureType(this.data.kind, this.data.type);
    return (fixturePieceKind(this.data.kind)?.source.finishes ?? []).filter(group => group !== 'front' || type?.cabinet)
      .map(id => ({ id, choices: FINISHES[id] }));
  }

  override withFinish(group: string, id: string): StudioFixture | null {
    const finish = this.finishGroups().find(g => g.id === group);
    if (!finish?.choices.some(choice => choice.id === id)) return null;
    return changePieceLook(this.data, { [group as FinishGroup]: finish.choices[0]?.id === id ? undefined : id });
  }

  limits(): SizeLimits {
    const t = fixtureType(this.data.kind, this.data.type);
    return t?.limits ?? { width: [1, 1000], depth: [1, 1000], height: [1, 500] };
  }
  override get capabilities(): Capabilities {
    const kind = fixturePieceKind(this.data.kind)?.source;
    return { ...super.capabilities, typed: !!kind?.tap || (kind?.setups?.length ?? this.types().length) > 1 };
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
