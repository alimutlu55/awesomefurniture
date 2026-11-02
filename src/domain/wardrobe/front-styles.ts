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
import { decorCatalog } from '../materials/decor-catalog';
import { HINGE_KINDS, type HingeKind } from './hinges';

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

/** The most leaves one door opening can be split into: one hinged on each side, so every leaf hangs on a board. */
export const MAX_LEAVES = 2;

/** What a person set on one door opening (`bay.row`) or on one leaf of it (`bay.row.leaf`). Absent fields follow the
 * cabinet: leaves split automatically and hinge on the side nearer the wardrobe's end. */
export interface LeafSettings {
  /** How many leaves the opening is split into (only on an opening's key). */
  readonly leaves?: number | undefined;
  readonly hinge?: 'left' | 'right' | undefined;
  /** The hinge it hangs on (HINGES); absent: chosen for it. */
  readonly hingeKind?: HingeKind | undefined;
  /** Its own front decor (a glass or mirror leaf among wood ones); absent: the cabinet's front decor. */
  readonly decor?: string | undefined;
}

/** A cabinet's fronts as saved. Every field is optional: absent is the default, and defaults are never written. */
export interface DesignFronts {
  readonly style?: FrontStyle | undefined;
  readonly overlay?: FrontOverlay | undefined;
  /** Millimetres. */
  readonly reveal?: FrontRevealMm | undefined;
  /** Keyed by `leafKey`: bay index from the left, door opening from the bottom, and optionally the leaf from the left. */
  readonly leaves?: Readonly<Record<string, LeafSettings>> | undefined;
}

/** A stable key for a door opening (bay index from the left, row from the bottom) or one leaf of it. */
export const leafKey = (bay: number, row: number, leaf?: number) => leaf === undefined ? `${bay}.${row}` : `${bay}.${row}.${leaf}`;
const LEAF_KEY = /^(\d)\.(\d{1,2})(?:\.(\d))?$/;
export const parseLeafKey = (key: string): { bay: number; row: number; leaf?: number } | undefined => {
  const m = LEAF_KEY.exec(key);
  return m ? { bay: Number(m[1]), row: Number(m[2]), ...(m[3] === undefined ? {} : { leaf: Number(m[3]) }) } : undefined;
};

/** What is wrong with saved fronts, each as a sentence naming the bad value and what is allowed. `bays` is the cabinet's
 * bay count, when known. */
export function frontsProblems(fronts: DesignFronts, bays?: number): string[] {
  const problems: string[] = [], list = (keys: readonly (string | number)[]) => keys.join(', ');
  const style = frontStyle(fronts.style ?? DEFAULT_FRONT.style);
  if (!style) problems.push(`Unknown front style "${fronts.style}": use ${list(FRONT_STYLES.map(s => s.key))}.`);
  if (fronts.overlay !== undefined && !frontOverlay(fronts.overlay)) problems.push(`Unknown front overlay "${fronts.overlay}": use ${list(FRONT_OVERLAYS.map(o => o.key))}.`);
  else if (style && !style.overlays.includes(fronts.overlay ?? style.overlays[0]!)) problems.push(`A ${style.name.toLowerCase()} front cannot be hung ${fronts.overlay}: use ${list(style.overlays)}.`);
  if (fronts.reveal !== undefined && !isFrontReveal(fronts.reveal)) problems.push(`A reveal of ${fronts.reveal} mm is not offered: use ${list(FRONT_REVEALS_MM)} mm.`);
  for (const [key, leaf] of Object.entries(fronts.leaves ?? {})) {
    const at = parseLeafKey(key);
    if (!at) { problems.push(`"${key}" is not a door opening: write bay.row (0.0 is the bottom opening of the left bay), or bay.row.leaf.`); continue; }
    if (bays !== undefined && at.bay >= bays) problems.push(`"${key}": the cabinet has no bay ${at.bay}; its bays are 0 to ${bays - 1}.`);
    if (leaf.leaves !== undefined) {
      if (at.leaf !== undefined) problems.push(`"${key}": set the number of leaves on the opening (${leafKey(at.bay, at.row)}), not on one leaf.`);
      if (!Number.isInteger(leaf.leaves) || leaf.leaves < 1 || leaf.leaves > MAX_LEAVES) problems.push(`"${key}": an opening has 1 to ${MAX_LEAVES} leaves.`);
    }
    if (at.leaf !== undefined && at.leaf >= MAX_LEAVES) problems.push(`"${key}": an opening has at most ${MAX_LEAVES} leaves.`);
    if (leaf.hingeKind !== undefined && !HINGE_KINDS.includes(leaf.hingeKind)) problems.push(`"${key}": unknown hinge "${leaf.hingeKind}": use ${list(HINGE_KINDS)}.`);
    if (leaf.decor !== undefined) {
      const decor = decorCatalog.find(d => d.id === leaf.decor);
      if (!decor || !decor.allowedZones.includes('fronts')) problems.push(`"${key}": "${leaf.decor}" is not a front decor.`);
      else if (style && !(style.decors as readonly string[]).includes(decor.category)) problems.push(`"${key}": a ${style.name.toLowerCase()} front cannot be made in ${decor.name}.`);
    }
  }
  return problems;
}

/** The fronts as they are saved: defaults left out, and nothing at all when everything is the default. */
export function savedFronts(fronts: DesignFronts | undefined): DesignFronts | undefined {
  if (!fronts) return undefined;
  const leaves = Object.fromEntries(Object.entries(fronts.leaves ?? {})
    .map(([key, leaf]) => [key, Object.fromEntries(Object.entries(leaf).filter(([, v]) => v !== undefined))] as const)
    .filter(([, leaf]) => Object.keys(leaf).length > 0).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  const style = fronts.style === undefined || fronts.style === DEFAULT_FRONT.style ? undefined : fronts.style;
  const firstOverlay = frontStyle(style ?? DEFAULT_FRONT.style)?.overlays[0];
  const saved = {
    ...(style ? { style } : {}),
    ...(fronts.overlay === undefined || fronts.overlay === firstOverlay ? {} : { overlay: fronts.overlay }),
    ...(fronts.reveal === undefined || fronts.reveal === DEFAULT_FRONT.revealMm ? {} : { reveal: fronts.reveal }),
    ...(Object.keys(leaves).length ? { leaves } : {}),
  };
  return Object.keys(saved).length ? saved : undefined;
}

/** A design's fronts with every default filled in. A design saved before styles keeps the style its materials name. */
export function resolveFronts(design: { fronts?: DesignFronts | undefined; materials?: { frontProfile?: string | undefined } | undefined }) {
  const fronts = design.fronts ?? {}, profile = design.materials?.frontProfile;
  const style = fronts.style ?? (FRONT_STYLES as readonly FrontStyleDef[]).find(s => profile && s.materialProfile === profile)?.key as FrontStyle | undefined ?? DEFAULT_FRONT.style;
  return { style, overlay: fronts.overlay ?? frontStyle(style)!.overlays[0]! as FrontOverlay, reveal: fronts.reveal ?? DEFAULT_FRONT.revealMm as FrontRevealMm, leaves: fronts.leaves ?? {} };
}

/** The style a door leaf is made in: the cabinet's, when its decor (the leaf's own, else the fronts') is one that style is
 * made in; else a slab. The 3D view, the hardware list and Make all ask this, so a handle-rail door has no handle anywhere. */
export function madeStyle(design: { fronts?: DesignFronts | undefined; materials?: { frontProfile?: string | undefined; frontDecorId?: string | undefined } | undefined; doors?: string | undefined },
  decorId?: string | undefined): FrontStyleDef {
  const style = frontStyle(resolveFronts(design).style)!, id = decorId ?? design.materials?.frontDecorId;
  const decor = id === undefined ? undefined : decorCatalog.find(d => d.id === id);
  return design.doors !== 'glass' && decor && (style.decors as readonly string[]).includes(decor.category) ? style : frontStyle(DEFAULT_FRONT.style)!;
}
