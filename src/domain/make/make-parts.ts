import type { Board, BoardStock } from '../drawings/cabinet-boards';
import { mm } from '../drawings/drawing';
import { type DrawingInput, type PlacedPiece, placePieces } from '../drawings/room-pieces';
import { pieceBoards } from '../drawings/unit-detail';
import { resolveMaterials } from '../materials/configured-materials';
import type { EditorDesign } from '../wardrobe/editor-design';

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
}
export interface MakePiece {
  readonly piece: PlacedPiece;
  readonly parts: readonly MakePart[];
  readonly size: { readonly w: number; readonly h: number; readonly d: number };
}

/** The decor a board is cut from. */
export function decorOf(b: Board, design: EditorDesign): string {
  if (b.decorId) return b.decorId;
  const m = resolveMaterials(design);
  if (b.stock === 'door' || b.stock === 'front') return m.frontDecorId;
  if (b.stock === 'back') return m.backingDecorId ?? m.carcassDecorId;
  return m.carcassDecorId;
}

/** What makes two boards the same part: name, stock, cutting size to the millimetre, banding, decor, and the shape
 * of a sloped outline (taken from its own corner, so a left and a right side under a slope stay apart). */
function sameness(b: Board, decor: string): string {
  const x = b.outline ? Math.min(...b.outline.map(p => p.x)) : 0, y = b.outline ? Math.min(...b.outline.map(p => p.y)) : 0;
  const outline = b.outline ? b.outline.map(p => mm(p.x - x) + ',' + mm(p.y - y)).join(' ') : '';
  return [b.name, b.stock, mm(b.cut.length), mm(b.cut.width), mm(b.cut.thickness), b.edges, decor, outline].join('|');
}

/** The boards of a piece as numbered parts. Numbers follow the order the boards are built in (`cabinetBoards`). */
export function makeParts(boards: readonly Board[], design: EditorDesign): MakePart[] {
  const groups = new Map<string, { decor: string; boards: Board[] }>();
  for (const b of boards) {
    const decor = decorOf(b, design), key = sameness(b, decor), group = groups.get(key);
    if (group) group.boards.push(b); else groups.set(key, { decor, boards: [b] });
  }
  return [...groups.values()].map((g, i) => {
    const b = g.boards[0]!;
    return { n: i + 1, name: b.name, stock: b.stock, cut: b.cut, edges: b.edges, decorId: g.decor, note: b.note, boards: g.boards };
  });
}

/** The piece with id `id` in a design, taken apart; null when it has no boards (a sink or hob) or does not exist. */
export function makePiece(input: DrawingInput, id: number): MakePiece | null {
  const pieces = placePieces(input), piece = pieces.find(p => p.id === id);
  if (!piece) return null;
  const boards = pieceBoards(piece, pieces);
  if (!boards.length) return null;
  const { w, h, d } = piece.design;
  return { piece, parts: makeParts(boards, piece.design), size: { w, h, d } };
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
