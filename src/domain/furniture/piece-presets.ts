import type { PossessionKey } from '../wardrobe/possessions';
import { POSSESSION_KEYS } from '../wardrobe/possessions';
import type { FurnitureCategoryId } from './furniture-taxonomy';

/**
 * Storage furniture people build that is not a wardrobe: a size, what it is for, and the fronts it starts with. Auto
 * design plans its inside from `holds`, so a new kind of piece is one entry here and needs no planner, Make or drawing
 * code. Before these existed, people squeezed a wardrobe down to a chest (60 × 75 × 40) or a sideboard (200 × 62 × 60),
 * and Auto design gave them nothing (analytics, November 2026).
 */
export interface PiecePreset {
  readonly id: string;
  /** Where the Add sheet files it (furniture-taxonomy.ts). */
  readonly category: FurnitureCategoryId;
  readonly name: string;
  readonly description: string;
  /** Outer size, centimetres. */
  readonly size: { readonly w: number; readonly h: number; readonly d: number };
  /** What it is planned for: counts by possession; the rest is zero. */
  readonly holds: Partial<Readonly<Record<PossessionKey, number>>>;
  readonly doors: 'none' | 'hinged';
  /** How its card is drawn: rows of drawers, or a pair of doors. */
  readonly look: 'drawers' | 'doors';
}

export const PIECE_PRESETS = [
  {
    id: 'chest', category: 'chests', name: 'Chest of drawers', description: 'Drawers for a bedroom, 80 × 90 cm',
    size: { w: 80, h: 90, d: 45 }, holds: { folded: 24, small: 30 }, doors: 'none', look: 'drawers',
  },
  {
    id: 'sideboard', category: 'sideboards', name: 'Sideboard', description: 'Low and wide, for a living or dining room, 180 × 75 cm',
    size: { w: 180, h: 75, d: 45 }, holds: { folded: 30, small: 30, shoes: 6 }, doors: 'none', look: 'drawers',
  },
  {
    id: 'tv-unit', category: 'sideboards', name: 'TV unit', description: 'Low under a screen, 200 × 50 cm',
    size: { w: 200, h: 50, d: 40 }, holds: { small: 40, folded: 12 }, doors: 'none', look: 'drawers',
  },
  {
    id: 'shoe-cabinet', category: 'shoe-cabinets', name: 'Shoe cabinet', description: 'For the hallway, 80 × 120 cm, 35 cm deep',
    size: { w: 80, h: 120, d: 35 }, holds: { shoes: 16 }, doors: 'hinged', look: 'doors',
  },
] as const satisfies readonly PiecePreset[];

export type PiecePresetId = typeof PIECE_PRESETS[number]['id'];

export function piecePreset(id: string): PiecePreset | undefined {
  return (PIECE_PRESETS as readonly PiecePreset[]).find(p => p.id === id);
}

/** The needs a preset is planned for, every possession named (those it does not hold are zero). */
export function presetNeeds(preset: PiecePreset): Record<PossessionKey, number> {
  return Object.fromEntries(POSSESSION_KEYS.map(k => [k, preset.holds[k] ?? 0])) as Record<PossessionKey, number>;
}

/** The size to add a piece at, with the preset named so the new piece is made that kind; empty for no preset. */
export function presetSize(id: string | undefined): { w?: number; h?: number; d?: number; preset?: string } {
  const preset = id ? piecePreset(id) : undefined;
  return preset ? { ...preset.size, preset: preset.id } : {};
}
