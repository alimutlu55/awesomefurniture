/** Beds, bedside tables, desks, armchairs and rugs: floor pieces whose kind (furnishing-kinds.ts) says their sizes, the
 * free floor they need and whether they are in anything's way. Every rule comes from FloorPiece and Piece. */
import type { Studio, StudioFurnishing } from '../studio/studio';
import { furnishingKind, furnishingType } from '../studio/furnishings/furnishing-kinds';
import { FloorPiece } from './floor-piece';
import type { Body, Capabilities, Needs, PieceKey, SizeLimits } from './piece-model';

export class Furnishing extends FloorPiece<StudioFurnishing> {
  get key(): PieceKey { return { family: 'furnishing', id: this.data.id }; }
  get noun() { return furnishingKind(this.data.kind)?.name.toLowerCase() ?? 'furniture'; }
  get needs(): Needs { return furnishingKind(this.data.kind)?.use ?? { front: 0, sides: 0 }; }
  body(_studio: Studio | undefined): Body {
    const f = this.data;
    return { key: this.key, noun: this.noun, blocks: this.blocks, x: f.x, y: 0, z: f.z, angle: f.angle, width: f.width, depth: f.depth, height: f.height };
  }
  limits(): SizeLimits {
    const t = furnishingType(this.data.kind, this.data.type);
    return t?.limits ?? { width: [1, 1000], depth: [1, 1000], height: [.5, 500] };
  }
  override get capabilities(): Capabilities {
    const k = furnishingKind(this.data.kind);
    return { ...super.capabilities, typed: (k?.types.length ?? 0) > 1, finishable: (k?.finishes.length ?? 0) > 0 };
  }
}

/** A rug lies flat: furniture stands on it, so it is in nobody's way, and it goes where it is put rather than against a wall. */
export class Rug extends Furnishing {
  override get blocks() { return false; }
  protected override get snapsToWalls() { return false; }
  protected override get keepsDoorwaysClear() { return false; }
}
