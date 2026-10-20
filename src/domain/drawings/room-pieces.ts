import type { EditorDesign } from '../wardrobe/editor-design';
import type { Studio, StudioWall } from '../studio/studio';
import { wallFace, wallLine } from '../studio/studio';
import { wallAgainst } from '../studio/scene-gaps';
import { furnitureModule, isKitchen } from '../furniture/furniture';
import { kitchenUnit } from '../kitchen/kitchen-units';

/** A piece of furniture where it stands: centre on the floor, height of its base, turn (degrees). Centimetres. */
export interface DrawingPiece {
  readonly id: number; readonly name: string;
  readonly x: number; readonly y: number; readonly z: number; readonly angle: number;
  readonly design: EditorDesign;
}
/** What the drawings are made from: the room (if any) and the furniture in it. */
export interface DrawingInput { readonly studio?: Studio | undefined; readonly pieces: readonly DrawingPiece[] }

/** A piece as the drawings place it: its mark, and the wall it stands against with where it starts and ends
 * along that wall's room face (centimetres from the wall's corner `a`, as openings are measured). */
export interface PlacedPiece extends DrawingPiece {
  readonly mark: string;
  readonly wall: string | null;
  readonly lo: number; readonly hi: number;
  /** Its back's distance off the wall face. */
  readonly off: number;
  /** It hangs on the wall (a wall unit or shelf): above the cut of a plan, drawn dashed there. */
  readonly hung: boolean;
  /** A sink or hob standing on a worktop, or a shelf: not a cabinet. */
  readonly fixture: 'sink' | 'hob' | 'shelf' | undefined;
}

/** A wall as the drawings read it: its line, room face and openings. */
export function wallGeometry(studio: Studio, w: StudioWall) {
  const line = wallLine(studio, w), face = wallFace(studio, w);
  if (!line || !face) return null;
  return { wall: w, line, face, openings: studio.openings.filter(o => o.wall === w.id).sort((a, b) => a.offset - b.offset) };
}

/** Every piece placed and marked. Marks use persisted cabinet ids (W1, K2…) and remain stable as furniture moves.
 * The list runs wall by wall, left to right, then pieces standing free. */
export function placePieces({ studio, pieces }: DrawingInput): PlacedPiece[] {
  const walls = studio?.walls ?? [];
  const placed = pieces.map(p => {
    const against = wallAgainst({ x: p.x, z: p.z, angle: p.angle, d: p.design.d }, studio);
    const fixture = isKitchen(p.design) ? kitchenUnit(p.design.unit).fixture : undefined;
    const hung = p.y > .5 && fixture !== 'sink' && fixture !== 'hob';
    return { ...p, wall: against?.id ?? null, lo: (against?.t ?? 0) - p.design.w / 2, hi: (against?.t ?? 0) + p.design.w / 2,
      off: Math.max(0, against?.dist ?? 0), hung, fixture, mark: '' };
  });
  const order = (p: typeof placed[number]) => p.wall === null ? walls.length : walls.findIndex(w => w.id === p.wall);
  placed.sort((a, b) => order(a) - order(b) || a.lo - b.lo || Number(a.hung) - Number(b.hung));
  return placed.map(p => ({ ...p, mark: furnitureModule(p.design).mark + p.id }));
}

/** A piece's name on a drawing: the kitchen unit it is (Wall cabinet, Sink), or its own name. */
export const pieceName = (p: Pick<DrawingPiece, 'design' | 'name'>) => isKitchen(p.design) ? kitchenUnit(p.design.unit).name : p.name;
