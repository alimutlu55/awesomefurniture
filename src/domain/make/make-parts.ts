import type { Board, BoardStock } from '../drawings/cabinet-boards';
import { mm } from '../drawings/drawing';
import { type DrawingInput, type PlacedPiece, placePieces } from '../drawings/room-pieces';
import { pieceBoards } from '../drawings/unit-detail';
import { resolveMaterials } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';
import { assemblySteps, buyList, drillingChecks, drillingSignature, type BuyLine, type Finding, type Step } from './make-assembly';
import { type Construction, constructionOf } from './make-construction';
import { drawerBoxes, frontHardware, frontMotions, type Motion } from './make-hardware';
import { backFixing, findJoints, type Fitting, type Groove, type Hole, jointFittings } from './make-joints';

/**
 * Make: one piece of furniture taken down to the boards it is cut from. Every board comes from `cabinetBoards` (through
 * `pieceBoards`), the same list the cutting list and the manufacturing check use, so a part on screen is a line on paper.
 * Centimetres throughout, in the piece's own frame: x from its left face, y up from the floor, z from its back.
 */

/** One part: identical boards counted together under one number, in the order the piece is built from them. */
export interface MakePart {
  readonly n: number;
  readonly name: string;
  readonly stock: BoardStock;
  readonly cut: Board['cut'];
  readonly edges: string;
  /** The decor it is cut from: its own (a drawer front), else the piece's front, back or carcass decor. */
  readonly decorId: string;
  readonly note?: string | undefined;
  readonly boards: readonly Board[];
  /** Where its boards are in the piece's board list (holes, grooves and fittings name boards by this index). */
  readonly ids: readonly number[];
}
export interface MakePiece {
  readonly piece: PlacedPiece;
  readonly parts: readonly MakePart[];
  readonly size: { readonly w: number; readonly h: number; readonly d: number };
  /** Every board: the cutting list's, then the drawer boxes Make adds for side-mount runners. */
  readonly boards: readonly Board[];
  readonly construction: Construction;
  readonly holes: readonly Hole[];
  readonly grooves: readonly Groove[];
  readonly fittings: readonly Fitting[];
  readonly steps: readonly Step[];
  readonly buy: readonly BuyLine[];
  readonly findings: readonly Finding[];
  /** How each board moves when the piece is opened (doors swing, drawers slide); null: it stays. */
  readonly motions: readonly (Motion | null)[];
}

/** The decor a board is cut from. */
export function decorOf(b: Board, design: EditorDesign): string {
  if (b.decorId) return b.decorId;
  const m = resolveMaterials(design);
  if (b.stock === 'door' || b.stock === 'front') return m.frontDecorId;
  if (b.stock === 'back') return m.backingDecorId ?? m.carcassDecorId;
  return m.carcassDecorId;
}

/** What makes two boards the same part: name, stock, cutting size to the millimetre, banding, decor, the shape of a
 * sloped outline (taken from its own corner, so a left and a right side under a slope stay apart), and its drilling. */
function sameness(b: Board, decor: string, drilling: string): string {
  const x = b.outline ? Math.min(...b.outline.map(p => p.x)) : 0, y = b.outline ? Math.min(...b.outline.map(p => p.y)) : 0;
  const outline = b.outline ? b.outline.map(p => mm(p.x - x) + ',' + mm(p.y - y)).join(' ') : '';
  return [b.name, b.stock, mm(b.cut.length), mm(b.cut.width), mm(b.cut.thickness), b.edges, decor, outline, drilling].join('|');
}

/** The boards of a piece as numbered parts. Numbers follow the order the boards are built in (`cabinetBoards`); boards
 * drilled differently (a left and a right side) are different parts. */
export function makeParts(boards: readonly Board[], design: EditorDesign, holes: readonly Hole[] = []): MakePart[] {
  const groups = new Map<string, { decor: string; boards: Board[]; ids: number[] }>();
  boards.forEach((b, i) => {
    const decor = decorOf(b, design), key = sameness(b, decor, drillingSignature(b, holes.filter(h => h.board === i))), group = groups.get(key);
    if (group) { group.boards.push(b); group.ids.push(i); } else groups.set(key, { decor, boards: [b], ids: [i] });
  });
  return [...groups.values()].map((g, i) => {
    const b = g.boards[0]!;
    return { n: i + 1, name: b.name, stock: b.stock, cut: b.cut, edges: b.edges, decorId: g.decor, note: b.note, boards: g.boards, ids: g.ids };
  });
}

/** The piece with id `id` in a design, taken apart; null when it has no boards (a sink or hob) or does not exist. */
export function makePiece(input: DrawingInput, id: number): MakePiece | null {
  const pieces = placePieces(input), piece = pieces.find(p => p.id === id);
  if (!piece) return null;
  const cut = pieceBoards(piece, pieces);
  if (!cut.length) return null;
  const boards = [...cut, ...drawerBoxes(piece, cut)], construction = constructionOf(piece.design);
  const joints = jointFittings(boards, findJoints(boards), construction), back = backFixing(boards, construction), hardware = frontHardware(piece, pieces, boards, joints.holes);
  // Hardware's holes name its fittings from 0: they follow the joints' and the back's in the one list.
  const shift = joints.fittings.length + back.fittings.length;
  const holes = [...joints.holes, ...hardware.holes.map(h => h.of === undefined ? h : { ...h, of: h.of + shift })];
  const fittings = [...joints.fittings, ...back.fittings, ...hardware.fittings];
  const { w, h, d } = piece.design;
  return {
    piece, parts: makeParts(boards, piece.design, holes), size: { w, h, d }, boards, construction, holes, grooves: back.grooves, fittings,
    steps: assemblySteps(boards, fittings), buy: buyList(fittings), findings: drillingChecks(boards, holes), motions: frontMotions(piece, pieces, boards),
  };
}

/** How many long and short edges are banded, from the cutting list's code (L1, L2 W2, L1 W2, —). */
export function bandedEdges(code: string): { long: number; short: number } {
  const long = /L(\d)/.exec(code), short = /W(\d)/.exec(code);
  return { long: long ? Number(long[1]) : 0, short: short ? Number(short[1]) : 0 };
}

/** The size to cut a part so that, with `bandMm` of edge banding on its banded edges, it finishes at its size. Banding on
 * a long edge makes the board wider, on a short edge longer. Centimetres. */
export function cutWithBand(part: Pick<MakePart, 'cut' | 'edges'>, bandMm: number): Board['cut'] {
  const e = bandedEdges(part.edges), t = bandMm / 10, exact = (cm: number) => Math.round(cm * 1000) / 1000;
  return { length: exact(part.cut.length - e.short * t), width: exact(part.cut.width - e.long * t), thickness: part.cut.thickness };
}
