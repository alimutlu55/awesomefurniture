import { getDecor } from '../materials/decor-catalog';
import { resolveMaterials } from '../materials/configured-materials';
import type { EditorDesign } from './editor-design';
import { PANEL, PLINTH } from './catalog.js';
import { HINGE_ENTRY } from '../hardware/hinges-hardware';
import { DOOR, fittingDepth, backFaceOf } from './carcass';
import { ceilingMin, ceilingPieces, ceilingPolyline, outerPolyline, resolveShape } from './shape/wardrobe-shape';
import { MAX_LEAVES, frontOverlay, leafKey, resolveFronts } from './front-styles';
import type { HingeKind } from './hinges';

/** The largest hinged door leaf that hangs true on its hinges (decision D1): wider or taller leaves sag. Centimetres. */
export const DOOR_LIMITS = {
  width: (HINGE_ENTRY.rules.maxLeafMm?.width ?? 600) / 10,
  height: (HINGE_ENTRY.rules.maxLeafMm?.height ?? 2400) / 10,
} as const;

/** A leaf's front decor: its own (set per leaf), else the cabinet's. */
export const leafDecorId = (design: Pick<EditorDesign, 'materials'>, leaf: { readonly decorId?: string | undefined }) =>
  leaf.decorId ?? resolveMaterials(design).frontDecorId;
/** A glass or mirror leaf: one in a glass decor, or every leaf of a cabinet whose doors are glass. Nothing is drilled in
 * it; it hangs on clamp hinges. */
export const leafGlass = (design: Pick<EditorDesign, 'materials' | 'doors'>, leaf: { readonly decorId?: string | undefined }) =>
  design.doors === 'glass' || getDecor(leafDecorId(design, leaf)).category === 'glass_mirror';
/** A leaf's thickness: its own decor's, else the cabinet's doors'. Cm. */
export const leafThickness = (design: Pick<EditorDesign, 'materials' | 'doors'>, leaf: { readonly decorId?: string | undefined }) =>
  leaf.decorId ? getDecor(leaf.decorId).thicknessMm / 10 : doorThickness(design);

export const doorThickness = (design: Pick<EditorDesign, 'materials' | 'doors'>) =>
  design.materials && (design.doors !== 'glass' || getDecor(design.materials.frontDecorId).category === 'glass_mirror') ? getDecor(design.materials.frontDecorId).thicknessMm / 10 : DOOR.thickness;

/** How a cabinet's door leaves sit on it, from its fronts' overlay and reveal (front-styles.ts). Centimetres. */
export interface DoorFit {
    /** The gap between neighbouring leaves, and between a leaf and the plinth or the top. */
    readonly reveal: number;
    /** Leaves sit between the carcass faces, their faces flush with its front edges. */
    readonly inset: boolean;
    /** How much of an outer board's front edge shows beside a leaf: none under a full overlay, half a board under half. */
    readonly showing: number;
    /** How far a leaf's middle stands in front of the carcass's front edges (behind them when negative). */
    readonly standoff: number;
    /** Depth the closed leaves take from inside the carcass: shelves, fittings and drawer fronts stop this much further
     * back. Only inset leaves take any. */
    readonly inside: number;
}
export function doorFit(design: Pick<EditorDesign, 'materials' | 'doors' | 'fronts' | 'product'>): DoorFit {
    const fronts = resolveFronts(design), overlay = frontOverlay(fronts.overlay)!, t = doorThickness(design);
    const inset = overlay.inset && design.doors !== 'none' && design.product !== 'kitchen';
    return { reveal: fronts.reveal / 10, inset, showing: inset ? PANEL : PANEL * (1 - overlay.cover),
        standoff: inset ? -t / 2 : DOOR.standoff, inside: inset ? t : 0 };
}
/** Depth a design's closed doors take from inside its carcass (see DoorFit.inside). */
export const frontInside = (design: Pick<EditorDesign, 'materials' | 'doors' | 'fronts' | 'product'>) => doorFit(design).inside;
/** The depth shelves and fittings may use in a design: behind the carcass front, and behind inset doors. */
export const fittingDepthOf = (design: Pick<EditorDesign, 'd' | 'materials' | 'doors' | 'fronts' | 'product' | 'construction'>) => fittingDepth(design.d, frontInside(design), backFaceOf(design));

/** A door leaf's top edge between x0 and x1 (from the left outer face), left to right: one reveal under the outer top
 * plus any board an overlay leaves showing, or for an inset leaf one reveal under the top boards' underside. It follows a
 * sloped or stepped top. */
export function doorTop(design: EditorDesign, x0: number, x1: number): { x: number; y: number }[] {
    const fit = doorFit(design), shape = resolveShape(design);
    return fit.inset ? ceilingPolyline(ceilingPieces(shape), x0, x1).map(p => ({ x: p.x, y: p.y - fit.reveal }))
        : outerPolyline(shape, x0, x1).map(p => ({ x: p.x, y: p.y - fit.showing - fit.reveal }));
}

/** Front coordinates, measured from the left outer face and the floor.
 * An infinite cap means the leaf follows the outer roof profile. */
export interface DoorArea { x0: number; x1: number; y0: number; y1: number }
/** A door opening: its bay (from the left) and row (its place in the bay, from the bottom, then from the left). */
export interface DoorOpening extends DoorArea { bay: number; row: number }
/** One leaf hung in an opening: which of how many it is (from the left), and the side it hinges on. */
export interface DoorLeaf extends DoorOpening { leaf: number; of: number; hinge: 'left' | 'right'; hingeKind?: HingeKind | undefined; decorId?: string | undefined }
export type DoorHang = 'auto' | 'left' | 'right';

/** Which side a wardrobe door leaf hinges on: the cabinet's chosen hang ('left' puts the handle on the right;
 * 'right' on the left), or by default the side nearer the wardrobe's end so handles meet towards the middle. */
export function doorHingeSide(area: Pick<DoorArea, 'x0' | 'x1'>, design: Pick<EditorDesign, 'w' | 'doorHang'>): 'left' | 'right' {
    if (design.doorHang === 'left' || design.doorHang === 'right') return design.doorHang;
    return (area.x0 + area.x1) / 2 <= design.w / 2 ? 'left' : 'right';
}

/** Only structural boards that span a compartment divide its doors. Ordinary
 * fittings do not, and a free-standing partial divider cannot support a seam.
 * Clear bounds follow board faces; front bounds meet at board centre lines (partitions between bays included) and
 * stop half a reveal inside the outer faces. */
export function cabinetDoorAreas(design: EditorDesign, widths: readonly number[]): DoorOpening[] {
    const pieces = ceilingPieces(resolveShape(design)), result: DoorOpening[] = [], fit = doorFit(design);
    // Where a leaf edge stands from a board: inside an outer face by what the overlay leaves showing and half a reveal
    // (a whole reveal from an inset leaf to the board); either side of a board between two leaves by half a reveal from
    // its centre line (a whole reveal from its face when inset).
    const outer = fit.showing + (fit.inset ? fit.reveal : fit.reveal / 2), seam = fit.inset ? PANEL / 2 + fit.reveal : fit.reveal / 2;
    let origin = PANEL;
    widths.forEach((width, section) => {
        const boards = design.dividers.filter(d => d.i === section), bay: DoorArea[] = [];
        type Clear = { x0: number; x1: number; y0: number; y1: number };
        const visit = (clear: Clear, front: DoorArea, remaining: typeof boards): void => {
            const index = remaining.findIndex(d => {
                if (d.orientation === 'horizontal') {
                    return d.y !== undefined && d.x0 !== undefined && d.x1 !== undefined
                        && d.x0 <= clear.x0 + .02 && d.x1 >= clear.x1 - .02
                        && d.y - PANEL / 2 > clear.y0 + .02
                        && d.y + PANEL / 2 < Math.min(clear.y1, ceilingMin(pieces, origin + clear.x0, origin + clear.x1) - PLINTH - PANEL) - .02;
                }
                if (d.x === undefined || d.y0 === undefined || d.y1 === undefined) return false;
                const roof = ceilingMin(pieces, origin + d.x - PANEL / 2, origin + d.x + PANEL / 2) - PLINTH - PANEL;
                return d.x - PANEL / 2 > clear.x0 + .02 && d.x + PANEL / 2 < clear.x1 - .02
                    && d.y0 <= clear.y0 + .02 && (d.want ?? d.y1) >= Math.min(clear.y1, roof) - .02;
            });
            if (index < 0) { bay.push(front); return; }
            const board = remaining[index]!, rest = remaining.filter((_, i) => i !== index);
            if (board.orientation === 'vertical') {
                const x = board.x!, at = origin + x;
                visit({ ...clear, x1: x - PANEL / 2 }, { ...front, x1: at - seam }, rest);
                visit({ ...clear, x0: x + PANEL / 2 }, { ...front, x0: at + seam }, rest);
            } else {
                const y = board.y!, at = PLINTH + PANEL + y;
                visit({ ...clear, y1: y - PANEL / 2 }, { ...front, y1: at - seam }, rest);
                visit({ ...clear, y0: y + PANEL / 2 }, { ...front, y0: at + seam }, rest);
            }
        };
        // A leaf covers the outer sides (as its overlay says) and half of each partition: neighbours meet on its centre line.
        const x0 = section === 0 ? outer : origin - PANEL / 2 + seam, x1 = section === widths.length - 1 ? origin + width + PANEL - outer : origin + width + PANEL / 2 - seam;
        visit({ x0: 0, x1: width, y0: 0, y1: Infinity }, { x0, x1, y0: PLINTH + fit.showing + fit.reveal, y1: Infinity }, boards);
        bay.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).forEach((area, row) => result.push({ ...area, bay: section, row }));
        origin += width + PANEL;
    });
    return result;
}

/** How many leaves an opening `width` wide gets (D8): the fewest equal leaves, a reveal apart, each within DOOR_LIMITS,
 * and at most MAX_LEAVES so every leaf hinges on a board (a wider opening needs a partition: the leaf-size rule says so).
 * Centimetres. */
export function autoLeafCount(width: number, reveal: number): number {
    let n = 1;
    while (n < MAX_LEAVES && (width - (n - 1) * reveal) / n > DOOR_LIMITS.width + 1e-9) n++;
    return n;
}

/** The leaves hung in a cabinet's door openings: each opening split into its leaf count (set per opening in its fronts,
 * else automatic), equal leaves a reveal apart. A single leaf hinges as set, or as the cabinet hangs its doors
 * (doorHingeSide); a pair hinges outward and meets in the middle, so the handles meet there too. */
export function cabinetDoorLeaves(design: EditorDesign, widths: readonly number[]): DoorLeaf[] {
    const fit = doorFit(design), { leaves: settings } = resolveFronts(design);
    return cabinetDoorAreas(design, widths).flatMap(opening => {
        const key = leafKey(opening.bay, opening.row), width = opening.x1 - opening.x0;
        const of = settings[key]?.leaves ?? autoLeafCount(width, fit.reveal), each = (width - (of - 1) * fit.reveal) / of;
        return Array.from({ length: of }, (_, leaf): DoorLeaf => {
            const x0 = opening.x0 + leaf * (each + fit.reveal), x1 = leaf === of - 1 ? opening.x1 : x0 + each;
            const set = settings[leafKey(opening.bay, opening.row, leaf)]?.hinge ?? (of === 1 ? settings[key]?.hinge : undefined);
            const hinge = set ?? (of === 1 ? doorHingeSide(opening, design) : leaf < of / 2 ? 'left' : 'right');
            const own = settings[leafKey(opening.bay, opening.row, leaf)], hingeKind = own?.hingeKind ?? settings[key]?.hingeKind, decorId = own?.decor ?? settings[key]?.decor;
            return { ...opening, x0, x1, leaf, of, hinge, ...(hingeKind ? { hingeKind } : {}), ...(decorId ? { decorId } : {}) };
        });
    });
}
