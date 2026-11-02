/**
 * Front styles: how a cabinet's door and drawer fronts are made (slab, Shaker, profiled edge, handle rail), how they sit
 * on the carcass (overlay) and the gap left round each leaf (reveal).
 *
 * THIS IS THE ONLY PLACE THAT DEFINES A FRONT STYLE, AN OVERLAY OR A REVEAL. The saved design, the spec, door geometry,
 * 3D, drawings and Make ask this registry; never copy its keys or sizes into another file.
 *
 * TO ADD A STYLE: append one entry to FRONT_STYLES and run `npm test`. tests/architecture/front-styles.test.ts walks
 * every entry through every field and names what is missing.
 *
 * Sizes on fronts are small, so they are whole millimetres here (`…Mm`); door geometry works in centimetres.
 */
import type { DecorCategory } from '../materials/decor-types';

/** How a leaf sits on the carcass: what share of the side board's front edge it covers, and whether it sits inside the
 * carcass faces instead of in front of them. */
export interface FrontOverlayDef {
  readonly key: string;
  readonly name: string;
  /** Share of an outer board's thickness the leaf covers: 1 covers it (less half a reveal), .5 shares a board with the
   * next leaf, 0 leaves it showing. */
  readonly cover: number;
  /** The leaf sits between the carcass faces, flush with their front edges, with a reveal all round. */
  readonly inset: boolean;
}

export const FRONT_OVERLAYS = [
  { key: 'full', name: 'Full overlay', cover: 1, inset: false },
  { key: 'half', name: 'Half overlay', cover: .5, inset: false },
  { key: 'inset', name: 'Inset', cover: 0, inset: true },
] as const satisfies readonly FrontOverlayDef[];
export type FrontOverlay = typeof FRONT_OVERLAYS[number]['key'];

/** The gap between neighbouring leaves, and between a leaf and the top of the wardrobe. Millimetres. */
export const FRONT_REVEALS_MM = [2, 3, 4] as const;
export type FrontRevealMm = typeof FRONT_REVEALS_MM[number];

export interface FrontStyleDef {
  readonly key: string;
  readonly name: string;
  /** Overlays it can be hung with. The first is its default. */
  readonly overlays: readonly FrontOverlay[];
  /** Decor categories it can be made from: a frame and panel, or a routed edge, needs a board that can be machined. */
  readonly decors: readonly DecorCategory[];
  /** Handles it takes: any handle kind, or none because the front is its own grip. */
  readonly handles: 'any' | 'none';
  /** Shaker: the frame round a recessed centre panel. */
  readonly frame?: { readonly stileMm: number; readonly railMm: number; readonly recessMm: number };
  /** Profiled edge: the width of the moulding run round the face. */
  readonly edgeProfileMm?: number;
  /** Handle rail: the grip routed (or a J-profile fitted) along the leaf's top edge. */
  readonly grip?: { readonly heightMm: number; readonly depthMm: number };
  /** The `frontProfile` value in saved materials that already means this style (designs saved before styles). */
  readonly materialProfile?: 'slab' | 'micro_shaker';
}

const ALL_FRONT_DECORS = ['wood_melamine', 'natural_veneer', 'unicolor_matte', 'high_gloss', 'textile_leather',
  'stone_mineral', 'metallic_brushed', 'glass_mirror'] as const satisfies readonly DecorCategory[];

export const FRONT_STYLES = [
  { key: 'slab', name: 'Slab', overlays: ['full', 'half', 'inset'], decors: ALL_FRONT_DECORS, handles: 'any', materialProfile: 'slab' },
  { key: 'shaker', name: 'Shaker', overlays: ['full', 'inset'], decors: ['unicolor_matte', 'natural_veneer'], handles: 'any',
    frame: { stileMm: 65, railMm: 65, recessMm: 6 }, materialProfile: 'micro_shaker' },
  { key: 'profiled', name: 'Profiled edge', overlays: ['full', 'half'], decors: ['unicolor_matte', 'natural_veneer'], handles: 'any',
    edgeProfileMm: 10 },
  { key: 'rail', name: 'Handle rail', overlays: ['full', 'half'], decors: ['wood_melamine', 'unicolor_matte', 'high_gloss', 'natural_veneer'],
    handles: 'none', grip: { heightMm: 30, depthMm: 20 } },
] as const satisfies readonly FrontStyleDef[];
export type FrontStyle = typeof FRONT_STYLES[number]['key'];

export const frontStyle = (key: string | undefined): FrontStyleDef | undefined => (FRONT_STYLES as readonly FrontStyleDef[]).find(s => s.key === key);
export const frontOverlay = (key: string | undefined): FrontOverlayDef | undefined => (FRONT_OVERLAYS as readonly FrontOverlayDef[]).find(o => o.key === key);
export const isFrontReveal = (mm: unknown): mm is FrontRevealMm => (FRONT_REVEALS_MM as readonly unknown[]).includes(mm);

/** What a design has when it says nothing about its fronts: today's slab leaves, full overlay, 2 mm reveal. */
export const DEFAULT_FRONT = Object.freeze({ style: 'slab', overlay: 'full', revealMm: 2 } as const satisfies {
  style: FrontStyle; overlay: FrontOverlay; revealMm: FrontRevealMm });
