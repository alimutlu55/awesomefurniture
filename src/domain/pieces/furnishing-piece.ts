/** Beds, bedside tables, desks, armchairs and rugs: floor pieces whose kind (furnishing-kinds.ts) says their sizes, the
 * free floor they need and whether they are in anything's way. Every rule comes from FloorPiece and Piece. */
import type { Studio, StudioFurnishing } from '../studio/studio';
import { FURNISHING_FINISHES, furnishingType, type FurnishingFinishGroup } from '../studio/furnishings/furnishing-kinds';
import { newFurnishingPose } from '../studio/furnishings/furnishing-place';
import { furnishingPieceKind } from './piece-kinds';
import { changePieceLook, roundPiece } from './piece';
import { FloorPiece } from './floor-piece';
import type { Body, Needs, PieceKey, PlaceHint, Placement, ResizeAnchor, Room, Size, SizeLimits } from './piece-model';

export class Furnishing extends FloorPiece<StudioFurnishing> {
  get key(): PieceKey { return { family: 'furnishing', id: this.data.id }; }
  get noun() { return furnishingPieceKind(this.data.kind)?.source.name.toLowerCase() ?? 'furniture'; }
  get needs(): Needs { return furnishingPieceKind(this.data.kind)?.needs ?? { front: 0, sides: 0 }; }
  body(_studio: Studio | undefined): Body {
    const f = this.data;
    return { key: this.key, noun: this.noun, blocks: this.blocks, x: f.x, y: 0, z: f.z, angle: f.angle, width: f.width, depth: f.depth, height: f.height };
  }
  limits(): SizeLimits {
    const t = furnishingType(this.data.kind, this.data.type);
    return t?.limits ?? { width: [1, 1000], depth: [1, 1000], height: [.5, 500] };
  }
  override place(room: Room, hint: PlaceHint = {}): Placement | null {
    if (!room.studio) return null;
    const size = this.size(room);
    const pose = newFurnishingPose(room.studio, this.data.kind, { w: size.width, d: size.depth },
      at => !this.accepts(room, { ...at, size }, hint), hint);
    return pose ? { ...pose, size } : null;
  }

  withSize(size: Partial<Size>, keep: ResizeAnchor = 'back'): StudioFurnishing {
    const f = this.data, rounded = Object.fromEntries(Object.entries(size).map(([key, value]) => [key, roundPiece(value)]));
    const pose = this.sizeAt({ studio: undefined, bodies: [] }, rounded, keep);
    return { ...f, ...rounded, x: roundPiece(pose.x), z: roundPiece(pose.z) };
  }

  override types() { return furnishingPieceKind(this.data.kind)?.source.types ?? []; }
  override withType(id: string): StudioFurnishing | null {
    const t = this.types().find(type => type.id === id), f = this.data;
    if (!t) return null;
    return t.id === f.type ? f : { ...this.withSize(t.size), type: t.id };
  }

  override finishGroups() {
    return (furnishingPieceKind(this.data.kind)?.source.finishes ?? []).map(id => ({ id, choices: FURNISHING_FINISHES[id] }));
  }

  override withFinish(group: string, id: string): StudioFurnishing | null {
    const finish = this.finishGroups().find(g => g.id === group);
    if (!finish?.choices.some(choice => choice.id === id)) return null;
    return changePieceLook(this.data, { [group as FurnishingFinishGroup]: finish.choices[0]?.id === id ? undefined : id });
  }
}

/** A rug lies flat: furniture stands on it, so it is in nobody's way, and it goes where it is put rather than against a wall. */
export class Rug extends Furnishing {
  override get blocks() { return false; }
  protected override get snapsToWalls() { return false; }
  protected override get keepsDoorwaysClear() { return false; }
}
