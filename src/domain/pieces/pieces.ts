/**
 * The one place a piece is made from its data: `cabinetPiece`, `fixturePiece`, `furnishingPiece`, and the bodies of a
 * room's own pieces. Every rule, tool and test asks these, never a family's data directly. See docs/room-pieces.md.
 */
import type { Studio, StudioFixture, StudioFurnishing } from '../studio/studio';
import { furnishingKind } from '../studio/furnishings/furnishing-kinds';
import { Furnishing, Rug } from './furnishing-piece';
import { Fixture } from './fixture-piece';
import { Cabinet, KitchenUnit, WallUnit, hangsOnWall, type CabinetData } from './cabinet-piece';
import { isKitchen } from '../furniture/furniture';
import type { Body, PieceKey, Room } from './piece-model';

export { Furnishing, Rug, Fixture, Cabinet, KitchenUnit, WallUnit };
export type { CabinetData };

export const furnishingPiece = (f: StudioFurnishing): Furnishing => furnishingKind(f.kind)?.flat ? new Rug(f) : new Furnishing(f);
export const fixturePiece = (f: StudioFixture) => new Fixture(f);
export const cabinetPiece = (c: CabinetData) => !isKitchen(c.state) ? new Cabinet(c) : hangsOnWall(c.state) ? new WallUnit(c) : new KitchenUnit(c);

/** Every piece the room itself keeps (toilets, basins, beds, rugs), as pieces. */
export function studioPieces(studio: Studio | undefined) {
  return [...(studio?.fixtures ?? []).map(fixturePiece), ...(studio?.furnishings ?? []).map(furnishingPiece)];
}
/** Their bodies. */
export const studioBodies = (studio: Studio | undefined): Body[] => studioPieces(studio).map(p => p.body(studio));
/** The room with its own pieces and the cabinets standing in it. */
export const roomOf = (studio: Studio | undefined, cabinets: readonly CabinetData[] = []): Room =>
  ({ studio, bodies: [...cabinets.map(c => cabinetPiece(c).body(studio)), ...studioBodies(studio)] });
/** The room's own piece with this key, if it has one. */
export function studioPiece(studio: Studio | undefined, key: PieceKey) {
  if (key.family === 'fixture') { const f = studio?.fixtures?.find(x => x.id === key.id); return f && fixturePiece(f); }
  if (key.family === 'furnishing') { const f = studio?.furnishings?.find(x => x.id === key.id); return f && furnishingPiece(f); }
  return undefined;
}
