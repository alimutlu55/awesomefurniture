/** Wardrobes, chests, sideboards and kitchen units: the cabinets the editor designs and builds. Their own design (fittings,
 * fronts, Make) stays with their furniture module; as pieces in a room they follow the same rules as everything else. */
import type { Studio } from '../studio/studio';
import { furnitureModule, isKitchen } from '../furniture/furniture';
import { boardFinishGroups, withBoardFinish, type ConfiguredMaterialsState, type LegacyFinish } from '../materials/configured-materials';
import type { FurnitureDesign } from '../furniture/furniture-module';
import { cabinetPieceKind, kitchenMobility } from './piece-kinds';
import { cabinetClashes, moveCabinet, resizeCabinet, turnCabinet } from './cabinet-motion';
import { placeNearKitchenRun } from './kitchen-placement';
import { placeCabinet, type CabinetPlaceHint } from './cabinet-placement';
import { snapTurn } from './piece-motion';
import { kitchenUnit } from '../kitchen/kitchen-units';
import { wallAgainst } from '../studio/scene-gaps';
import { FloorPiece } from './floor-piece';
import { HangingPiece } from './wall-piece';
import type { Body, Mobility, MoveOptions, PieceKey, Pose, ResizeAnchor, Room, Size, SizeLimits } from './piece-model';

/** A cabinet as the room sees it: the fields of the editor's cabinet that say where it is and how big. */
export interface CabinetData {
  readonly id: number; readonly x: number; readonly y?: number; readonly z: number; readonly angle: number;
  readonly state: FurnitureDesign & {
    readonly w: number; readonly d: number; readonly h: number; readonly unit?: string | undefined;
    readonly fin?: LegacyFinish | undefined; readonly materials?: ConfiguredMaterialsState | undefined;
    readonly doors?: 'none' | 'hinged' | 'glass' | undefined;
  };
}

/** A kitchen wall unit or shelf hangs on its wall: it moves along and up and down it. A sink or hob sits on a worktop. */
export const hangsOnWall = (state: CabinetData['state']) => isKitchen(state) && kitchenMobility(kitchenUnit(state.unit)) === 'on-wall';

const cabinetBody = (c: CabinetData, key: PieceKey, noun: string): Body =>
  ({ key, noun, blocks: true, x: c.x, y: c.y || 0, z: c.z, angle: c.angle, width: c.state.w, depth: c.state.d, height: c.state.h });
const cabinetLimits = (c: CabinetData): SizeLimits => {
  const s = furnitureModule(c.state).sizes(c.state as never);
  return { width: [s.w[0], s.w[1]], depth: [s.d[0], s.d[1]], height: [s.h[0], s.h[1]] };
};

export class Cabinet extends FloorPiece<CabinetData> {
  override turn(room: Room, angle: number, free: boolean) {
    return this.turnFrom(room, snapTurn(angle, free), this.data);
  }
  get key(): PieceKey { return { family: 'cabinet', id: String(this.data.id) }; }
  get noun() { return furnitureModule(this.data.state).noun; }
  get needs() { return cabinetPieceKind(this.data.state).needs; }
  body(_studio: Studio | undefined) { return cabinetBody(this.data, this.key, this.noun); }
  limits() { return cabinetLimits(this.data); }
  override finishGroups() { return boardFinishGroups(this.data.state); }
  override withFinish(group: string, id: string) {
    const state = withBoardFinish(this.data.state, group, id);
    return state ? { ...this.data, state } : null;
  }
  override place(room: Room, hint: CabinetPlaceHint = {}) { return placeCabinet(room, this.data, this.limits(), hint); }
  override clashes(room: Room) { return cabinetClashes(this.data, room); }
  placeNear<T extends CabinetData>(room: Room, candidate: T, anchor: CabinetData, fits: (piece: T) => boolean) {
    return placeNearKitchenRun(room, candidate, anchor, fits);
  }
  protected override positionProblem(room: Room, pose: Pose, size?: Size) {
    const state = size ? { ...this.data.state, w: size.width, d: size.depth, h: size.height } : this.data.state;
    return cabinetClashes({ ...this.data, x: pose.x, y: pose.y ?? this.data.y ?? 0, z: pose.z, angle: pose.angle, state }, room)[0] ?? null;
  }
  override move(room: Room, to: Pose, options: MoveOptions = {}) { return moveCabinet(this.data, room, to, options); }
  override resize(room: Room, size: Partial<Size>, keep: ResizeAnchor = 'middle') { return resizeCabinet(this.data, room, size, this.limits(), keep); }
  turnFrom(room: Room, angle: number, from?: Pick<Pose, 'x' | 'z'>) { return turnCabinet(this.data, room, angle, from); }
}
/** Kitchen base and tall units: cabinets that join a run under one worktop. */
export class KitchenUnit extends Cabinet {}
export class WorktopPiece extends KitchenUnit { override readonly mobility: Mobility = 'on-worktop'; }

export class WallUnit extends HangingPiece<CabinetData> {
  get key(): PieceKey { return { family: 'cabinet', id: String(this.data.id) }; }
  get noun() { return furnitureModule(this.data.state).noun; }
  get needs() { return cabinetPieceKind(this.data.state).needs; }
  readonly side = 0;
  wallId(studio: Studio | undefined) { return wallAgainst({ x: this.data.x, z: this.data.z, angle: this.data.angle, d: this.data.state.d }, studio)?.id ?? null; }
  offset(studio: Studio | undefined) { return wallAgainst({ x: this.data.x, z: this.data.z, angle: this.data.angle, d: this.data.state.d }, studio)?.t ?? 0; }
  body(_studio: Studio | undefined) { return cabinetBody(this.data, this.key, this.noun); }
  limits() { return cabinetLimits(this.data); }
  override finishGroups() { return boardFinishGroups(this.data.state); }
  override withFinish(group: string, id: string) {
    const state = withBoardFinish(this.data.state, group, id);
    return state ? { ...this.data, state } : null;
  }
  override place(room: Room, hint: CabinetPlaceHint = {}) { return placeCabinet(room, this.data, this.limits(), hint); }
  override clashes(room: Room) { return cabinetClashes(this.data, room); }
  placeNear<T extends CabinetData>(room: Room, candidate: T, anchor: CabinetData, fits: (piece: T) => boolean) {
    return placeNearKitchenRun(room, candidate, anchor, fits);
  }
  protected override positionProblem(room: Room, pose: Pose, size?: Size) {
    const state = size ? { ...this.data.state, w: size.width, d: size.depth, h: size.height } : this.data.state;
    return cabinetClashes({ ...this.data, x: pose.x, y: pose.y ?? this.data.y ?? 0, z: pose.z, angle: pose.angle, state }, room)[0] ?? null;
  }
  override move(room: Room, to: Pose, options: MoveOptions = {}) { return moveCabinet(this.data, room, to, options); }
  override resize(room: Room, size: Partial<Size>, keep: ResizeAnchor = 'middle') { return resizeCabinet(this.data, room, size, this.limits(), keep); }
  turnFrom(room: Room, angle: number, from?: Pick<Pose, 'x' | 'z'>) { return turnCabinet(this.data, room, angle, from); }
}
