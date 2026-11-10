/**
 * Hinges: every kind of concealed hinge a door leaf can hang on, and the one rule for how many a leaf takes and where.
 *
 * Declared in the domain hardware registry (`HINGE_ENTRY`, `PLATE_ENTRY` in `src/domain/hardware/hinges-hardware.ts`).
 * The hardware list, Make (cups, plates, the buy list) and the drawings ask it; never copy its kinds or sizes into
 * another file.
 */
import { HINGE_ENTRY, PLATE_ENTRY } from '../hardware/hinges-hardware';
import { hasTrait } from './fittings';
import type { EditorDesign } from './editor-design';

/** Where hinge values come from, shown wherever a person reads them. */
export const HINGE_SOURCE = HINGE_ENTRY.source;

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
  /** The door weight one hinge carries, kg. */
  readonly loadKg: number;
}

const PLATE_HOLE = PLATE_ENTRY.drilling[0]!;
const PLATE: HingePlate = {
  pitch: PLATE_HOLE.pitchMm ?? 32,
  line: PLATE_HOLE.lineMm,
  screw: { d: PLATE_HOLE.dMm, depth: PLATE_HOLE.depthMm },
};

export type HingeKind = 'standard' | 'wide' | 'widest' | 'zero' | 'thick' | 'glass' | 'corner';

export const HINGES: readonly (HingeDef & { readonly key: HingeKind })[] = (HINGE_ENTRY.variants ?? []).map(v => ({
  key: v.key as HingeKind,
  name: v.name,
  size: v.sizeLabel,
  angle: v.angleDeg ?? 110,
  use: v.use ?? '',
  cup: v.cup ?? null,
  plate: PLATE,
  softClose: v.key !== 'glass',
  loadKg: v.loadKg ?? 4,
}));

export const HINGE_KINDS = HINGES.map(h => h.key) as readonly HingeKind[];
export const DEFAULT_HINGE: HingeKind = (HINGE_ENTRY.defaultVariant ?? 'standard') as HingeKind;
export const hinge = (key: string | undefined): HingeDef => HINGES.find(h => h.key === key) ?? HINGES[0]!;

/** Room beside a cabinet's left and right sides (as you face it) to the nearest wall or other piece. Centimetres. */
export interface SideRoom { readonly left: number; readonly right: number }
/** A door hinged at a cabinet's end with less room than this beside it opens wider, so it clears the wall or piece. Cm. */
export const TIGHT_SIDE = (HINGE_ENTRY.rules.clearanceMm.side ?? 100) / 10;

/**
 * The hinge a door leaf hangs on: the kind set for it; a glass door's clamp hinge; a zero-protrusion hinge when its bay
 * holds something that pulls out (drawers and pull-outs must slide past the open door); a 155° hinge when it hinges at
 * the cabinet's end with less than TIGHT_SIDE beside it; else the standard 110°. `leaf.bay` is a wardrobe door's bay.
 */
export function hingeFor(leaf: { readonly hingeKind?: string | undefined; readonly hinge?: 'left' | 'right' | undefined; readonly bay?: number | undefined; readonly x0: number; readonly x1: number },
  design: Pick<EditorDesign, 'w' | 'secs'>, glass: boolean, room?: SideRoom): HingeKind {
  if (leaf.hingeKind && HINGE_KINDS.includes(leaf.hingeKind as HingeKind)) return leaf.hingeKind as HingeKind;
  if (glass) return (HINGE_ENTRY.rules.exclusions?.find(e => e.material === 'glass')?.fallbackVariant ?? 'glass') as HingeKind;
  if (leaf.bay !== undefined && design.secs[leaf.bay]?.some(it => hasTrait(it.k, 'pullout'))) return 'zero';
  const side = leaf.hinge ?? 'left', atEnd = side === 'left' ? leaf.x0 < 2 : leaf.x1 > design.w - 2;
  if (room && atEnd && room[side] < TIGHT_SIDE) return 'wide';
  return DEFAULT_HINGE;
}

const THRESHOLDS = HINGE_ENTRY.rules.quantityByHeightMm ?? [[900, 2], [1600, 3], [2000, 4], [Infinity, 5]];
const EDGE_INSET_CM = (HINGE_ENTRY.rules.edgeInsetMm ?? 100) / 10;

/** Concealed hinges by a door's height (mm), as common practice advises: up to 900 mm two, to 1600 three, to 2000 four,
 * above five. */
export const hingesFor = (heightMm: number) => (THRESHOLDS.find(([max]) => heightMm <= max) ?? THRESHOLDS.at(-1)!)[1];

/** Hinge centres along a door `length` cm tall: 10 cm from each end and evenly between. */
export function hingeStations(length: number): number[] {
  const n = hingesFor(Math.round(length * 10));
  return Array.from({ length: n }, (_, k) => EDGE_INSET_CM + (length - 2 * EDGE_INSET_CM) * k / (n - 1));
}

const MIN_INSET_CM = (HINGE_ENTRY.rules.minEdgeInsetMm ?? 70) / 10;
/** How far a hinge's plate and arm stay from anything that pulls out past them, centimetres. */
export const HINGE_PULLOUT_CLEAR = (HINGE_ENTRY.rules.clearanceMm.pullout ?? 30) / 10;
/** Two hinges on one edge are never nearer than this, centimetres. */
const MIN_HINGE_GAP = 8;
/** Moved hinges still span at least this share of the usual distance between the outer two. */
const MIN_SPREAD = .5;

/**
 * Hinge centres along a door `length` cm tall, each clear of the spans in `blocked` (centimetres up from the door's lower
 * end) that something slides past on the hinge side: a drawer behind the door, its box and runners. The hinge plate and
 * arm stand in the cabinet's front corner, so a drawer there would hit them; a flat-pack wardrobe moves its drawers up
 * a hole for hinged doors, and a made wardrobe moves the hinge instead. A hinge in a span goes to the nearest place
 * outside it (HINGE_PULLOUT_CLEAR above or below): the outer two as near their usual places as they can be, the rest evenly
 * between, none nearer an end than the hinge's least inset or nearer another hinge than MIN_HINGE_GAP. Where there is no
 * such place, or the free stretches are too short to spread the hinges (MIN_SPREAD), they stay where hingeStations has
 * them and the clash is reported (`hingeClashes`, the hinge-drawer rule) so the drawers move instead.
 */
export function hingeStationsClear(length: number, blocked: readonly (readonly [number, number])[]): number[] {
  const even = hingeStations(length), spans = blocked.map(([a, b]) => [a - HINGE_PULLOUT_CLEAR, b + HINGE_PULLOUT_CLEAR] as const);
  if (!hingeClashes(even, blocked).length) return even;
  const lo = Math.min(MIN_INSET_CM, length / 2), hi = Math.max(length - MIN_INSET_CM, length / 2);
  const free = (y: number) => y >= lo - 1e-9 && y <= hi + 1e-9 && !spans.some(([a, b]) => y > a + 1e-9 && y < b - 1e-9);
  const edges = [lo, hi, ...spans.flatMap(([a, b]) => [a, b])].filter(free);
  const nearest = (y: number, ok: (y: number) => boolean = () => true) =>
    [y, ...edges].filter(v => free(v) && ok(v)).sort((p, q) => Math.abs(p - y) - Math.abs(q - y))[0];
  // The outer hinges as near their usual places as they can be, the others evenly between them, each then moved out of
  // what it would block.
  const first = nearest(even[0]!) ?? even[0]!, last = nearest(even.at(-1)!) ?? even.at(-1)!, n = even.length;
  const placed: number[] = [];
  for (let k = 0; k < n; k++) {
    const want = n === 1 ? first : first + (last - first) * k / (n - 1);
    placed.push(nearest(want, y => placed.every(p => Math.abs(p - y) >= MIN_HINGE_GAP - 1e-9)) ?? want);
  }
  // Hinges crowded into a short free stretch no longer hold the door square: they stay where they were and the clash is
  // reported, so the drawers move instead.
  if (Math.max(...placed) - Math.min(...placed) < (even.at(-1)! - even[0]!) * MIN_SPREAD) return even;
  // Drilled to the whole millimetre.
  return placed.map(y => Math.round(y * 10) / 10).sort((p, q) => p - q);
}

/** The hinge centres among `stations` that still sit in a blocked span (see hingeStationsClear). */
export const hingeClashes = (stations: readonly number[], blocked: readonly (readonly [number, number])[]) =>
  stations.filter(y => blocked.some(([a, b]) => y > a - HINGE_PULLOUT_CLEAR + 1e-9 && y < b + HINGE_PULLOUT_CLEAR - 1e-9));
