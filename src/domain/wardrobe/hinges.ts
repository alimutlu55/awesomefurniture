/**
 * Hinges: every kind of concealed hinge a door leaf can hang on, and the one rule for how many a leaf takes and where.
 *
 * THIS IS THE ONLY PLACE THAT DEFINES A HINGE KIND OR COUNTS HINGES. The hardware list, Make (cups, plates, the buy
 * list) and the drawings ask it; never copy its kinds or sizes into another file.
 *
 * Values are generic common practice (decision D5), not a maker's catalogue: System 32, 35 mm cups 22.5 mm from the
 * door's edge, plates on the 37 mm line. Wherever a person reads them they are labelled HINGE_SOURCE.
 *
 * TO ADD A HINGE KIND: append one entry and run `npm test`; tests/architecture/hinges.test.ts walks it everywhere.
 */
import { hasTrait } from './fittings';
import type { EditorDesign } from './editor-design';

/** Where hinge values come from, shown wherever a person reads them. */
export const HINGE_SOURCE = 'common practice; check the maker\'s template';

/** The cup bored in the back of the door: diameter and depth (mm), and its centre's distance from the hinge edge. */
export interface HingeCup { readonly d: number; readonly depth: number; readonly fromEdge: number }
/** The mounting plate on the upright: two screw holes `pitch` apart, on the System 32 line `line` in from the front. Mm. */
export interface HingePlate { readonly pitch: number; readonly line: number; readonly screw: { readonly d: number; readonly depth: number } }

export interface HingeDef {
  readonly key: string;
  readonly name: string;
  /** How Make's buy list sizes it (a hinge "110°"). */
  readonly size: string;
  /** How far the door opens, degrees. */
  readonly angle: number;
  /** Where it is used, in a few words. */
  readonly use: string;
  /** Its cup; none for a hinge clamped to glass (nothing is drilled in the door). */
  readonly cup: HingeCup | null;
  readonly plate: HingePlate;
  /** A soft-close version is made. */
  readonly softClose: boolean;
  /** The door weight one hinge carries, kg (common practice: the count by height below keeps an 18 mm board door within
   * it). */
  readonly loadKg: number;
}

const CUP: HingeCup = { d: 35, depth: 13, fromEdge: 22.5 };
const PLATE: HingePlate = { pitch: 32, line: 37, screw: { d: 5, depth: 12 } };

export const HINGES = [
  { key: 'standard', name: 'Concealed hinge, 110°', size: '110°', angle: 110, use: 'Most doors', cup: CUP, plate: PLATE, softClose: true, loadKg: 4 },
  { key: 'wide', name: 'Concealed hinge, 155°', size: '155°', angle: 155, use: 'Door against a wall or a neighbour', cup: CUP, plate: PLATE, softClose: true, loadKg: 4 },
  { key: 'widest', name: 'Concealed hinge, 170°', size: '170°', angle: 170, use: 'Door that must fold right back', cup: CUP, plate: PLATE, softClose: true, loadKg: 4 },
  { key: 'zero', name: 'Zero-protrusion hinge, 155°', size: '155° zero protrusion', angle: 155, use: 'Pull-outs behind the door', cup: CUP, plate: PLATE, softClose: true, loadKg: 4 },
  { key: 'thick', name: 'Thick-door hinge, 95°', size: '95° thick door', angle: 95, use: 'Doors thicker than 25 mm', cup: { d: 35, depth: 15, fromEdge: 22.5 }, plate: PLATE, softClose: true, loadKg: 5 },
  { key: 'glass', name: 'Glass/mirror door hinge', size: 'glass', angle: 95, use: 'Glass and mirror doors, clamped', cup: null, plate: PLATE, softClose: false, loadKg: 3 },
  { key: 'corner', name: 'Blind-corner hinge, 95°', size: '95° blind corner', angle: 95, use: 'A door beside a blind corner', cup: CUP, plate: PLATE, softClose: true, loadKg: 4 },
] as const satisfies readonly HingeDef[];
export type HingeKind = typeof HINGES[number]['key'];
export const HINGE_KINDS = HINGES.map(h => h.key) as readonly HingeKind[];
export const DEFAULT_HINGE: HingeKind = 'standard';
export const hinge = (key: string | undefined): HingeDef => (HINGES as readonly HingeDef[]).find(h => h.key === key) ?? HINGES[0];

/** Room beside a cabinet's left and right sides (as you face it) to the nearest wall or other piece. Centimetres. */
export interface SideRoom { readonly left: number; readonly right: number }
/** A door hinged at a cabinet's end with less room than this beside it opens wider, so it clears the wall or piece. Cm. */
export const TIGHT_SIDE = 10;

/**
 * The hinge a door leaf hangs on: the kind set for it; a glass door's clamp hinge; a zero-protrusion hinge when its bay
 * holds something that pulls out (drawers and pull-outs must slide past the open door); a 155° hinge when it hinges at
 * the cabinet's end with less than TIGHT_SIDE beside it; else the standard 110°. `leaf.bay` is a wardrobe door's bay.
 */
export function hingeFor(leaf: { readonly hingeKind?: string | undefined; readonly hinge?: 'left' | 'right' | undefined; readonly bay?: number | undefined; readonly x0: number; readonly x1: number },
  design: Pick<EditorDesign, 'w' | 'secs'>, glass: boolean, room?: SideRoom): HingeKind {
  if (leaf.hingeKind && HINGE_KINDS.includes(leaf.hingeKind as HingeKind)) return leaf.hingeKind as HingeKind;
  if (glass) return 'glass';
  if (leaf.bay !== undefined && design.secs[leaf.bay]?.some(it => hasTrait(it.k, 'pullout'))) return 'zero';
  const side = leaf.hinge ?? 'left', atEnd = side === 'left' ? leaf.x0 < 2 : leaf.x1 > design.w - 2;
  if (room && atEnd && room[side] < TIGHT_SIDE) return 'wide';
  return DEFAULT_HINGE;
}

/** Concealed hinges by a door's height (mm), as common practice advises: up to 900 mm two, to 1600 three, to 2000 four,
 * above five. */
export const hingesFor = (heightMm: number) => heightMm <= 900 ? 2 : heightMm <= 1600 ? 3 : heightMm <= 2000 ? 4 : 5;
/** Hinge centres along a door `length` cm tall: 10 cm from each end and evenly between. */
export function hingeStations(length: number): number[] {
  const n = hingesFor(Math.round(length * 10));
  return Array.from({ length: n }, (_, k) => 10 + (length - 20) * k / (n - 1));
}
