/** Wardrobes, chests, sideboards and kitchen units: the cabinets the editor designs and builds. Their own design (fittings,
 * fronts, Make) stays with their furniture module; as pieces in a room they follow the same rules as everything else. */
import type { Studio } from '../studio/studio';
import { furnitureModule, isKitchen } from '../furniture/furniture';
import type { FurnitureDesign } from '../furniture/furniture-module';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { wallAgainst } from '../studio/scene-gaps';
import { FloorPiece } from './floor-piece';
import { HangingPiece } from './wall-piece';
import type { Body, Needs, PieceKey, SizeLimits } from './piece-model';

/** A cabinet as the room sees it: the fields of the editor's cabinet that say where it is and how big. */
export interface CabinetData {
  readonly id: number; readonly x: number; readonly y?: number; readonly z: number; readonly angle: number;
  readonly state: FurnitureDesign & { readonly w: number; readonly d: number; readonly h: number; readonly unit?: string | undefined };
}

/** A kitchen wall unit or shelf hangs on its wall: it moves along and up and down it. A sink or hob sits on a worktop. */
export const hangsOnWall = (state: CabinetData['state']) => isKitchen(state) && kitchenUnit(state.unit).elevation > 0
  && ['shelf', undefined].includes(kitchenUnit(state.unit).fixture);

const cabinetBody = (c: CabinetData, key: PieceKey, noun: string): Body =>
  ({ key, noun, blocks: true, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, width: c.state.w, depth: c.state.d, height: c.state.h });
const cabinetLimits = (c: CabinetData): SizeLimits => {
  const s = furnitureModule(c.state).sizes(c.state as never);
  return { width: [s.w[0], s.w[1]], depth: [s.d[0], s.d[1]], height: [s.h[0], s.h[1]] };
};
/** Doors and drawers need 60 cm in front to open. */
const CABINET_NEEDS: Needs = { front: 60, sides: 0 };

export class Cabinet extends FloorPiece<CabinetData> {
  get key(): PieceKey { return { family: 'cabinet', id: String(this.data.id) }; }
  get noun() { return furnitureModule(this.data.state).noun; }
  readonly needs = CABINET_NEEDS;
  body(_studio: Studio | undefined) { return cabinetBody(this.data, this.key, this.noun); }
  limits() { return cabinetLimits(this.data); }
}
/** Kitchen base and tall units: cabinets that join a run under one worktop. */
export class KitchenUnit extends Cabinet {}

export class WallUnit extends HangingPiece<CabinetData> {
  get key(): PieceKey { return { family: 'cabinet', id: String(this.data.id) }; }
  get noun() { return furnitureModule(this.data.state).noun; }
  readonly needs = CABINET_NEEDS;
  readonly side = 0;
  wallId(studio: Studio | undefined) { return wallAgainst({ x: this.data.x, z: this.data.z, angle: this.data.angle, d: this.data.state.d }, studio)?.id ?? null; }
  offset(studio: Studio | undefined) { return wallAgainst({ x: this.data.x, z: this.data.z, angle: this.data.angle, d: this.data.state.d }, studio)?.t ?? 0; }
  body(_studio: Studio | undefined) { return cabinetBody(this.data, this.key, this.noun); }
  limits() { return cabinetLimits(this.data); }
}
