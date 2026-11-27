/**
 * Room pieces: one model for everything that stands in a room (wardrobes and other cabinets, kitchen units, toilets and
 * basins, beds and rugs). See docs/room-pieces.md.
 *
 * The saved data stays plain JSON. A piece class is a view over that data: every method is pure, takes the room it stands
 * in, and returns data. The physical rules (collision, snapping, turning, gaps) are written once in the abstract classes;
 * a concrete kind only says what it is. Centimetres and degrees; at angle 0 a piece's back is at -z, its front faces +z.
 */
import type { Studio } from '../studio/studio';
import type { Pose } from '../studio/studio-placement';
import type { AlignTarget } from '../geometry/alignment';

export type { Pose };
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
export interface Room { readonly studio: Studio | undefined; readonly bodies: readonly Body[] }

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

/* ---- One interface per action ---- */

/** It has a body in the room, and a place a new one goes. */
export interface Placeable { body(studio: Studio | undefined): Body }
/** It may not run into walls, shapes, doorways or other pieces. */
export interface Collidable { readonly blocks: boolean; clashes(room: Room): string[] }
/** It is measured: the free floor around it, amber where a person has less than it needs. */
export interface Measurable { readonly needs: Needs; gaps(room: Room): PieceGap[] }
/** It has sizes with limits, from its kind. */
export interface Resizable { limits(): SizeLimits }
/** It can be copied beside itself. */
export interface Duplicable { copyPoses(room: Room): Pose[] }
/** How it moves: anywhere on the floor, along its wall, along and up and down its wall. */
export type Mobility = 'floor' | 'along-wall' | 'on-wall';
export interface Movable { readonly mobility: Mobility }
/** It turns about its middle. */
export interface Turnable { turn(room: Room, angle: number, free: boolean): Pose; quarterTurn(room: Room): Pose }
/** Where it lines up along a wall. */
export interface Alignable { targets(room: Room, wallId: string): PieceTarget[] }
/** It comes in types (a single or a king bed). */
export interface Typed { readonly typed: boolean }
/** It has finishes to choose. */
export interface Finishable { readonly finishable: boolean }

/** What a piece can do, for building its tools (toolbar, handles, keys) without knowing its kind. */
export interface Capabilities {
  readonly mobility: Mobility;
  readonly turnable: boolean;
  readonly typed: boolean;
  readonly resizable: boolean;
  readonly finishable: boolean;
  readonly duplicable: boolean;
}
