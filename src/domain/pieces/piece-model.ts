/**
 * Room pieces: one model for everything that stands in a room (wardrobes and other cabinets, kitchen units, toilets and
 * basins, beds and rugs). See docs/room-pieces.md.
 *
 * The saved data stays plain JSON. A piece class is a view over that data: every method is pure, takes the room it stands
 * in, and returns data. The physical rules (collision, snapping, turning, gaps) are written once in the abstract classes;
 * a concrete kind only says what it is. Centimetres and degrees; at angle 0 a piece's back is at -z, its front faces +z.
 */
import type { Studio } from '../studio/studio';
import type { Pose as FloorPose } from '../studio/studio-placement';
import type { CabinetData } from './cabinet-piece';
import type { AlignTarget } from '../geometry/alignment';

/** A floor pose may omit elevation; a body always has it. */
export interface Pose extends FloorPose { readonly y?: number | undefined }
export interface Size { readonly width: number; readonly depth: number; readonly height: number }
export type SizeLimits = { readonly [K in keyof Size]: readonly [number, number] };

/** Which family a piece belongs to: where its data is kept and which concrete class reads it. */
export type PieceFamily = 'cabinet' | 'fixture' | 'furnishing';
export interface PieceKey { readonly family: PieceFamily; readonly id: string }
export const sameKey = (a: PieceKey | undefined, b: PieceKey | undefined) => !!a && !!b && a.family === b.family && a.id === b.id;

/** A piece as every rule sees it: where it is, how big, whether it is in anything's way, and what to call it. `y` is its
 * underside (a wall cabinet hangs). */
export interface Body extends Pose, Size {
  readonly key: PieceKey;
  readonly y: number;
  readonly blocks: boolean;
  /** Lowercase noun for messages: "bed", "toilet", "wardrobe". */
  readonly noun: string;
}

/** The room a piece stands in: its walls and shapes, and every other piece in it, of every family. */
export interface Room {
  readonly studio: Studio | undefined;
  readonly bodies: readonly Body[];
  /** Cabinets retain their installation details for continuous collision and fitting checks. */
  readonly cabinets?: readonly CabinetData[] | undefined;
}

/** A line drawn while something lines up: from `a` to `b`, with what it lined up with. */
export interface PieceGuide { readonly a: { x: number; y: number; z: number }; readonly b: { x: number; y: number; z: number }; readonly label: string }
export type PieceTarget = AlignTarget<number>;

/** What a move or turn asks for: the pose to go to, what it lined up with (held a little longer next time) and its guides. */
export interface Aim { readonly pose: Pose; readonly lock: PieceTarget | null; readonly guides: readonly PieceGuide[] }

/** The free floor a person needs to use a piece, in front and at its sides (a bed is got into from its sides). */
export interface Needs { readonly front: number; readonly sides: number }

/** A gap from a piece's side to what is next to it, drawn from the middle of that side so it slides with the piece. */
export interface PieceGap {
  readonly side: 'left' | 'right' | 'front' | 'back';
  readonly distance: number;
  readonly from: { x: number; y: number; z: number }; readonly to: { x: number; y: number; z: number };
  /** Less than a person needs there. */
  readonly short: boolean;
}

export interface Outcome<T> { readonly value: T | null; readonly reason?: string }
export interface Placement extends Pose {
  readonly size: Size;
  readonly wallId?: string | undefined;
  readonly offset?: number | undefined;
}
export interface PlaceHint {
  readonly wallId?: string | undefined;
  readonly near?: number | undefined;
  readonly accept?: ((placement: Placement) => boolean) | undefined;
}
export interface MoveOptions {
  readonly free?: boolean | undefined;
  readonly lock?: PieceTarget | null | undefined;
  readonly tolerance?: number | undefined;
  readonly from?: Pose | undefined;
  readonly problem?: ((pose: Pose) => string | null) | undefined;
  /** Numeric cabinet inputs follow the exact sweep; gestures can also slide along a blocked axis. */
  readonly exact?: boolean | undefined;
}
export interface MoveOutcome extends Outcome<Pose> {
  readonly lock: PieceTarget | null;
  readonly guides: readonly PieceGuide[];
}
export type ResizeAnchor = 'back' | 'middle';
export type SizedPose = Size & Pose & { readonly y: number };
export interface PieceType { readonly id: string; readonly name: string; readonly size: Size; readonly limits: SizeLimits }
export interface PieceFinish { readonly id: string; readonly name: string }
export interface PieceFinishGroup { readonly id: string; readonly choices: readonly PieceFinish[] }
export type WallChange = { readonly wall: string; readonly second: string; readonly at: number };
export interface WallPlacement extends Pose { readonly wall: string; readonly offset: number }

export interface Placeable { body(studio: Studio | undefined): Body; place(room: Room, hint?: PlaceHint): Placement | null }
export interface Collidable { readonly blocks: boolean; clashes(room: Room): string[] }
export interface Measurable { readonly needs: Needs; gaps(room: Room): PieceGap[] }
export interface Resizable {
  limits(): SizeLimits;
  resize(room: Room, size: Partial<Size>, keep?: ResizeAnchor): Outcome<SizedPose>;
}
export interface Duplicable { copyPoses(room: Room): Pose[]; copyPose(room: Room, hint?: PlaceHint): Pose | null }
export type Mobility = 'floor' | 'along-wall' | 'on-wall' | 'on-worktop';
export interface Movable { readonly mobility: Mobility; move(room: Room, to: Pose, options?: MoveOptions): MoveOutcome }
export interface Turnable { turn(room: Room, angle: number, free: boolean): Pose; quarterTurn(room: Room): Pose }
export interface Alignable { targets(room: Room, wallId: string): PieceTarget[] }
export interface Typed<D> { types(): readonly PieceType[]; withType(id: string): D | null }
export interface Finishable<D> { finishGroups(): readonly PieceFinishGroup[]; withFinish(group: string, id: string): D | null }
export interface FollowsRoom { followRoom(before: Studio, after: Studio, split?: WallChange): WallPlacement | null }

/** What a piece can do, for building its tools (toolbar, handles, keys) without knowing its kind. */
export interface Capabilities {
  readonly mobility: Mobility;
  readonly turnable: boolean;
  readonly typed: boolean;
  readonly resizable: boolean;
  readonly finishable: boolean;
  readonly duplicable: boolean;
}
