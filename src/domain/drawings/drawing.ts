/**
 * A technical drawing as plain data: what a carpenter reads, not how it looks on screen. Lengths are whole
 * millimetres on the real object, x to the right and y up on the sheet; the presentation scales a view to
 * paper and chooses line weights, lettering and where dimension lines stand off the object (ISO 128 / 129).
 */
export interface P { readonly x: number; readonly y: number }

/** The weight of a line, heaviest first: cut through (walls on a plan, the floor on an elevation), seen
 * outlines, thin detail, hidden or overhead (dashed), centre lines (chain), and how a door or flap swings
 * (long dashes: an elevation's triangle pointing at the hinges, a door drawn open on a plan). */
export type Stroke = 'cut' | 'outline' | 'thin' | 'hidden' | 'centre' | 'swing';

export interface Line {
  readonly kind: 'line';
  readonly points: readonly P[];
  readonly stroke: Stroke;
  readonly closed?: boolean | undefined;
  /** A cut wall is hatched; glass is a light tint. */
  readonly fill?: 'hatch' | 'glass' | undefined;
}
export interface Note {
  readonly kind: 'note';
  readonly at: P;
  readonly lines: readonly string[];
  readonly align: 'start' | 'middle' | 'end';
  /** Degrees anticlockwise, for a note written along a sloping or vertical edge. */
  readonly angle?: number | undefined;
  /** Smaller lettering, for a name written on a front (Oven, Fridge). */
  readonly small?: boolean | undefined;
}
/** Which way something opens or pulls out, on a plan: an arrow from `at` along `dir`. */
export interface Arrow { readonly kind: 'arrow'; readonly at: P; readonly dir: P }
/** A piece's mark (K1, W2): the same mark on the plan, its wall's elevation and later the schedules. */
export interface Tag { readonly kind: 'tag'; readonly at: P; readonly text: string }
/**
 * A string of dimensions along one line, as builders read them: each stop is measured along `dir` from
 * `origin` (whole millimetres, ascending), and each figure is the distance between two neighbouring stops,
 * so the figures always add up to the total. The string stands on the `side` of the measured line given by
 * turning `dir` a quarter anticlockwise (1) or clockwise (-1), `clear` millimetres off it to pass what is in
 * the way (a wall's thickness), then `row` rows out: row 0 nearest, the overall size outermost.
 */
export interface Dimensions {
  readonly kind: 'dims';
  readonly origin: P;
  readonly dir: P;
  readonly stops: readonly number[];
  readonly side: 1 | -1;
  readonly clear: number;
  readonly row: number;
}
/** Where an elevation is seen from, marked on the plan: a pointer at `at` looking along `dir`, with the
 * elevation's letter. */
export interface ViewMark { readonly kind: 'view-mark'; readonly at: P; readonly dir: P; readonly text: string }
export type Item = Line | Note | Tag | Dimensions | ViewMark | Arrow;

/** One row of the list of pieces on a sheet: its mark, what it is, and its outer size. */
export interface PieceRow { readonly mark: string; readonly name: string; readonly size: string; readonly where: string }
/** One drawing on a sheet, titled under it ("Front", "Section A–A"); a sheet's views share its scale. */
export interface View { readonly title: string; readonly items: readonly Item[] }
/** A schedule: columns and rows of text (a cutting list, a hardware list), with notes under it. */
export interface Table {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** Columns holding numbers, set right-aligned. */
  readonly numeric: readonly number[];
  readonly notes: readonly string[];
}
export interface Sheet {
  readonly number: number;
  readonly title: string;
  /** The drawings on it, side by side at one scale. A schedule sheet has none. */
  readonly views: readonly View[];
  readonly table?: Table | undefined;
  /** The pieces this sheet shows, listed beside the drawing. */
  readonly pieces: readonly PieceRow[];
  /** What to check before making: pieces that overlap, cover an opening or run past their wall. */
  readonly checks: readonly string[];
}
/** Rows of a schedule that fit one A3 sheet at standard lettering; a longer schedule runs on. */
export const ROWS_PER_SHEET = 34;

/** Centimetres (the design's unit) to whole millimetres. */
export const mm = (cm: number) => Math.round(cm * 10);

/** Stops in order with the ones that land on the same millimetre merged. */
export function stops(values: readonly number[]): number[] {
  return [...new Set(values.map(v => Math.round(v)))].sort((a, b) => a - b);
}

/** A closed rectangle from its corners. */
export const rect = (x0: number, y0: number, x1: number, y1: number, stroke: Stroke, fill?: Line['fill']): Line =>
  ({ kind: 'line', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], stroke, closed: true, fill });
export const line = (a: P, b: P, stroke: Stroke): Line => ({ kind: 'line', points: [a, b], stroke });
export const note = (at: P, text: string | readonly string[], align: Note['align'] = 'middle', angle?: number): Note =>
  ({ kind: 'note', at, lines: typeof text === 'string' ? [text] : text, align, angle });
