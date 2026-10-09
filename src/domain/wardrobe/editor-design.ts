import type { ItemKind, StoragePurpose, WardrobePreferences } from './wardrobe';

/** Serializable layout intent: distinguishes stacked/full-width items from
 * pinned coordinates and retains divider travel regions. No camera or selection. */
export interface EditorItem {
  id?: string | undefined;
  k: ItemKind; h: number; f?: 'Oak' | 'White' | 'Walnut' | 'Graphite' | 'Sage' | null | undefined; purpose?: StoragePurpose | undefined;
  w?: number | undefined; x?: number | undefined; y?: number | undefined; ax?: 'l' | 'c' | 'r' | undefined; front?: boolean | undefined; boxes?: number | undefined;
}
export interface EditorDivider {
  id?: string | undefined;
  i: number; orientation: 'horizontal' | 'vertical';
  x?: number | undefined; y?: number | undefined; x0?: number | undefined; x1?: number | undefined; y0?: number | undefined; y1?: number | undefined;
  area?: { x0: number; x1: number; y0: number; y1: number } | undefined;
}
export type EditorProfile = { -readonly [K in keyof Omit<WardrobePreferences, 'budget'>]: Omit<WardrobePreferences, 'budget'>[K] } & { reachStd?: number | undefined; engaged?: boolean | undefined };
export interface EditorLayout {
  cabinetId: number;
  weights: number[];
  reachStd?: number | undefined;
  engaged?: boolean | undefined;
  reachLine?: boolean | undefined;
  proposal: { title: string; summary: string } | null;
}
export interface EditorDesign {
  w: number; h: number; d: number; n: number; wt: number[];
  secs: EditorItem[][]; dividers: EditorDivider[];
  fin: 'Oak' | 'White' | 'Walnut' | 'Graphite' | 'Sage'; doors: 'none' | 'hinged' | 'glass';
  profile: EditorProfile; proposal: EditorLayout['proposal']; reachLine?: boolean | undefined;
}
