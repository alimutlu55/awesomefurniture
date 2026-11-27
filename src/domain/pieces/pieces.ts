/**
 * The one place a piece is made from its data: `cabinetPiece`, `fixturePiece`, `furnishingPiece`, and the bodies of a
 * room's own pieces. Every rule, tool and test asks these, never a family's data directly. See docs/room-pieces.md.
 */
import type { Studio, StudioFixture, StudioFurnishing } from '../studio/studio';
import { startFurnishingType } from '../studio/furnishings/furnishing-kinds';
import { fixtureType } from '../studio/fixtures/fixture-kinds';
import { startType } from '../studio/fixtures/fixture-edit';
import { cabinetPieceKind, fixturePieceKind, furnishingPieceKind } from './piece-kinds';
import { Furnishing, Rug } from './furnishing-piece';
import { Fixture } from './fixture-piece';
import { Cabinet, KitchenUnit, WallUnit, WorktopPiece, type CabinetData } from './cabinet-piece';
import { isKitchen } from '../furniture/furniture';
import { bodyBox } from './piece';
import type { Body, PieceKey, Room } from './piece-model';

export { Furnishing, Rug, Fixture, Cabinet, KitchenUnit, WallUnit };
export type { CabinetData };

export { PIECE_KINDS } from './piece-kinds';
export type RoomPiece = Cabinet | WallUnit | Fixture | Furnishing;

export function pieceOf(data: CabinetData): Cabinet | WallUnit;
export function pieceOf(data: StudioFixture): Fixture;
export function pieceOf(data: StudioFurnishing): Furnishing;
export function pieceOf(data: CabinetData | StudioFixture | StudioFurnishing): RoomPiece;
export function pieceOf(data: CabinetData | StudioFixture | StudioFurnishing): RoomPiece {
  if ('state' in data) {
    const kind = cabinetPieceKind(data.state);
    if (kind.mobility === 'on-wall') return new WallUnit(data);
    if (kind.mobility === 'on-worktop') return new WorktopPiece(data);
    return isKitchen(data.state) ? new KitchenUnit(data) : new Cabinet(data);
  }
  if ('wall' in data) return new Fixture(data);
  // Catalogue-only callers may read fixture capabilities before a wall is assigned.
  if (fixturePieceKind(data.kind) && !furnishingPieceKind(data.kind)) return new Fixture(data as unknown as StudioFixture);
  return furnishingPieceKind(data.kind)?.blocks === false ? new Rug(data) : new Furnishing(data);
}

export const furnishingPiece = (f: StudioFurnishing) => pieceOf(f);
export const fixturePiece = (f: StudioFixture) => pieceOf(f);
export const cabinetPiece = (c: CabinetData) => pieceOf(c);

export function newFixturePiece(kind: string): Fixture | undefined {
  const type = startType(kind), entry = type && fixtureType(kind, type);
  return entry ? pieceOf({ id: '', kind, type: entry.id, wall: '', offset: 0, ...entry.size }) : undefined;
}

export function newFurnishingPiece(kind: string): Furnishing | undefined {
  const type = startFurnishingType(kind);
  return type && pieceOf({ id: '', kind, type: type.id, x: 0, z: 0, angle: 0, ...type.size });
}
export const cabinetBox = (c: CabinetData) => bodyBox(cabinetPiece(c).body(undefined), c.id);

/** Every piece the room itself keeps (toilets, basins, beds, rugs), as pieces. */
export function studioPieces(studio: Studio | undefined) {
  return [...(studio?.fixtures ?? []).map(fixturePiece), ...(studio?.furnishings ?? []).map(furnishingPiece)];
}
/** Their bodies. */
export const studioBodies = (studio: Studio | undefined): Body[] => studioPieces(studio).map(p => p.body(studio));
/** The room with its own pieces and the cabinets standing in it. */
export const roomOf = (studio: Studio | undefined, cabinets: readonly CabinetData[] = []): Room =>
  ({ studio, cabinets, bodies: [...cabinets.map(c => cabinetPiece(c).body(studio)), ...studioBodies(studio)] });
/** The room's own piece with this key, if it has one. */
export function studioPiece(studio: Studio | undefined, key: PieceKey) {
  if (key.family === 'fixture') { const f = studio?.fixtures?.find(x => x.id === key.id); return f && fixturePiece(f); }
  if (key.family === 'furnishing') { const f = studio?.furnishings?.find(x => x.id === key.id); return f && furnishingPiece(f); }
  return undefined;
}

export function roomPiece(room: Room, key: PieceKey): RoomPiece | undefined {
  if (key.family !== 'cabinet') return studioPiece(room.studio, key);
  const data = room.cabinets?.find(c => String(c.id) === key.id);
  return data && pieceOf(data);
}
