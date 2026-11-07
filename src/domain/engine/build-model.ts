import { modelRevision } from '../drawings/manufacturing-validation';
import { type DrawingInput, type PlacedPiece, placePieces } from '../drawings/room-pieces';
import type { Construction } from '../make/make-construction';
import { type MakePiece, decorOf, makePlacedPiece } from '../make/make-parts';
import { type Content, piecesContents } from './physics/contents';
import { type LoadCheck, loadChecks, weightOf } from './physics/structure';

/**
 * The build model: every piece in a scene as it is built, in one place. It is the engine's single source of truth:
 * passports, prices, load checks, rules and exports all read it, so they agree with one another and with the drawings
 * and Make by construction.
 *
 * It does not derive the furniture again. Each piece comes from Make (`makePlacedPiece`), which builds from the same
 * board list as the cutting list, the drawings and the manufacturing check (`pieceBoards` → `cabinetBoards`). The model
 * adds what Make does not know: what is kept in the piece and what carries it (physics/contents.ts), how hard each
 * part works (physics/structure.ts) and what the piece weighs.
 *
 * A builder profile can lower the model: build every piece with the profile's joints and back (`construction`), the
 * way a workshop with that equipment would. Without one, each piece keeps its own construction.
 */

export interface BuiltPiece {
  readonly piece: PlacedPiece;
  readonly make: MakePiece;
  readonly contents: readonly Content[];
  readonly loads: readonly LoadCheck[];
  /** The piece's own weight, empty, kilograms (boards only; hardware is a few percent more). */
  readonly kg: number;
}

export interface BuildModel {
  readonly input: DrawingInput;
  /** A fingerprint of everything the model is made from, including a construction it was lowered with. */
  readonly revision: string;
  readonly placed: readonly PlacedPiece[];
  readonly pieces: readonly BuiltPiece[];
  readonly construction: Construction | undefined;
}

export interface BuildOptions {
  /** Build every piece with these joints and back instead of its own (a builder profile's). */
  readonly construction?: Construction | undefined;
}

/** The scene as a builder would build it with `construction` (or each piece's own). */
function lowered(input: DrawingInput, construction: Construction | undefined): DrawingInput {
  if (!construction) return input;
  return { ...input, pieces: input.pieces.map(p => ({ ...p, design: { ...p.design, construction } })) };
}

/** One placed piece taken down to its parts, its contents and its loads; null for a fixture (a sink, a hob). */
export function buildPiece(piece: PlacedPiece, placed: readonly PlacedPiece[]): BuiltPiece | null {
  const make = makePlacedPiece(piece, placed);
  if (!make) return null;
  const contents = piecesContents(piece.design, make.boards);
  const kg = make.boards.reduce((s, b) => s + weightOf(b, decorOf(b, piece.design)), 0);
  return { piece, make, contents, loads: loadChecks(make, contents), kg };
}

export function buildModel(input: DrawingInput, options: BuildOptions = {}): BuildModel {
  const source = lowered(input, options.construction), placed = placePieces(source);
  const pieces = placed.flatMap(p => buildPiece(p, placed) ?? []);
  const revision = modelRevision(input) + (options.construction ? ':' + options.construction.joints + '-' + options.construction.back : '');
  return { input: source, revision, placed, pieces, construction: options.construction };
}
