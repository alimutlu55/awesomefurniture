import type { Board } from '../../drawings/cabinet-boards';
import { createWardrobeGeometry } from '../../geometry/wardrobe-geometry.js';
import { PANEL } from '../../wardrobe/catalog.js';
import { FITTING_HARDWARE_KEYS, fitting, hasTrait } from '../../wardrobe/fittings';
import type { EditorDesign } from '../../wardrobe/editor-design';
import { purposeDef } from '../../wardrobe/purposes';
import { storedMass } from '../../wardrobe/storage-load';

/**
 * What is kept in a piece and what carries it: every fitting's contents (from its purpose's load in the registry), and
 * the boards, rail, pull-out or runners its weight rests on. Centimetres in the piece's frame (x from its left face,
 * y up from the floor, z from its back), kilograms. Pure: it reads the design and the board list, nothing else.
 */

/** A board's share of what stands on it. */
export interface BoardShare { readonly board: number; readonly kg: number }

export type Carrier =
  /** Stands on boards: a shelf, the base, a cupboard's adjustable shelves. */
  | { readonly kind: 'boards'; readonly shares: readonly BoardShare[] }
  /** Hangs from a rail or a pull-out across the bay, `spanCm` between its ends. */
  | { readonly kind: 'rail'; readonly spanCm: number; readonly hardware: string | undefined }
  /** In a box on runners. */
  | { readonly kind: 'drawer'; readonly hardware: string | undefined };

export interface Content {
  readonly bay: number;
  readonly item: number;
  readonly fitting: string;
  readonly purpose: string;
  readonly kg: number;
  readonly carried: Carrier;
  /** Where the fitting is, in the piece's frame. */
  readonly box: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
}

/** A board lying across a space (shelf, base) rather than standing in it. */
export const lying = (b: Board) => !b.outline && b.y1 - b.y0 <= Math.min(b.x1 - b.x0, b.z1 - b.z0) + .01;
/** Boards that carry what stands on them. A top carries nothing kept inside; a drawer box carries its own contents. */
const carries = (b: Board) => (b.name === 'Shelf' || b.name === 'Base') && lying(b);

/** Within this of a fitting's bottom, a board's top face is what the fitting stands on. Centimetres. */
const SEAT = 2.5;
/** A drawer's inside is about this much narrower and shallower than its opening (sides, back, front). Centimetres. */
const DRAWER_INSET = { w: 5, d: 10 } as const;

/** The registry key of the first hardware a fitting is built with (its rail, lift, runners), if any. */
function hardwareKeyOf(kind: string): string | undefined {
  const first = fitting(kind)?.hardware?.[0];
  return first ? FITTING_HARDWARE_KEYS[first] : undefined;
}

/** Where each bay starts, from the piece's left face, and how wide it is inside. Centimetres. */
export function bayExtents(design: EditorDesign): { x0: number; x1: number }[] {
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, widths: number[] = createWardrobeGeometry(() => editing).widths();
  let x = PANEL;
  return widths.map(w => { const bay = { x0: x, x1: x + w }; x += w + PANEL; return bay; });
}

/** The bay a point `x` across the piece is in (from 0 on the left), or -1 when it is on no bay (a side, a partition). */
export const bayAt = (design: EditorDesign, x: number) => bayExtents(design).findIndex(b => x >= b.x0 - .01 && x <= b.x1 + .01);

/** Everything kept in `design`, fitting by fitting, with what carries it. `boards` is the piece's board list. */
export function piecesContents(design: EditorDesign, boards: readonly Board[]): Content[] {
  if (!design.secs?.length) return [];
  const editing = { ...design, sel: 0, item: -1, divider: -1, space: null }, geometry = createWardrobeGeometry(() => editing);
  const widths: number[] = geometry.widths(), out: Content[] = [];
  // Bays start after the left side and each partition, as cabinetBoards lays them.
  let bayL = PANEL;
  widths.forEach((sw, i) => {
    const items = design.secs[i] ?? [];
    geometry.computeLayout(i).forEach((pos: { y0: number; y1: number; off: number; w: number }, j: number) => {
      const it = items[j];
      if (!it || hasTrait(it.k, 'appliance')) return;
      const purpose = it.purpose ?? fitting(it.k)?.purpose ?? 'free', load = purposeDef(purpose)?.load;
      if (!load) return;
      const box = { x0: bayL + pos.off, x1: bayL + pos.off + pos.w, y0: pos.y0, y1: pos.y1 }, base = { bay: i, item: j, fitting: it.k, purpose, box };
      if (hasTrait(it.k, 'hanging') || hasTrait(it.k, 'pullout') && !hasTrait(it.k, 'drawerBox')) {
        const kg = storedMass(load, pos.w * design.d / 1e4, pos.w / 100);
        out.push({ ...base, kg, carried: { kind: 'rail', spanCm: pos.w, hardware: hardwareKeyOf(it.k) } });
        return;
      }
      if (hasTrait(it.k, 'drawerBox')) {
        const area = Math.max(0, pos.w - DRAWER_INSET.w) * Math.max(0, design.d - DRAWER_INSET.d) / 1e4;
        out.push({ ...base, kg: storedMass(load, area, pos.w / 100), carried: { kind: 'drawer', hardware: hardwareKeyOf(it.k) } });
        return;
      }
      const shares: BoardShare[] = [];
      boards.forEach((b, k) => {
        if (!carries(b) || b.y1 < pos.y0 - SEAT || b.y1 > pos.y1 - SEAT) return;
        const across = Math.min(b.x1, box.x1) - Math.max(b.x0, box.x0);
        if (across < 5) return;
        shares.push({ board: k, kg: storedMass(load, across * (b.z1 - b.z0) / 1e4, across / 100) });
      });
      out.push({ ...base, kg: shares.reduce((s, q) => s + q.kg, 0), carried: { kind: 'boards', shares } });
    });
    bayL += sw + PANEL;
  });
  return out;
}
