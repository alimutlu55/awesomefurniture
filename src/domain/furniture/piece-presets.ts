import type { PossessionKey } from '../wardrobe/possessions';
import { POSSESSION_KEYS } from '../wardrobe/possessions';
import type { EditorProfile } from '../wardrobe/editor-design';
import type { FittingKind } from '../wardrobe/fittings';
import type { FurnitureCategoryId } from './furniture-taxonomy';

/**
 * Empty storage furniture. Each preset supplies the carcass size, fittings offered in Add, and the demand
 * shown when the user opens Auto design.
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
  readonly fittings: readonly FittingKind[];
  readonly smallItemsLabel?: string;
  readonly doors: 'none' | 'hinged';
  /** How its card is drawn: rows of drawers, or a pair of doors. */
  readonly look: 'drawers' | 'doors';
}

export const PIECE_PRESETS = [
  {
    id: 'chest', category: 'chests', name: 'Chest of drawers', description: 'Drawers for a bedroom, 80 × 90 cm',
    size: { w: 80, h: 90, d: 45 }, holds: { folded: 24, small: 30 },
    fittings: ['drawer', 'sdrawer', 'folded', 'shelf'], doors: 'none', look: 'drawers',
  },
  {
    id: 'sideboard', category: 'sideboards', name: 'Sideboard', description: 'Low and wide, for a living or dining room, 180 × 75 cm',
    size: { w: 180, h: 75, d: 45 }, holds: { small: 30 }, smallItemsLabel: 'Small items',
    fittings: ['shelf', 'drawer', 'sdrawer'], doors: 'none', look: 'drawers',
  },
  {
    id: 'tv-unit', category: 'sideboards', name: 'TV unit', description: 'Low under a screen, 200 × 50 cm',
    size: { w: 200, h: 50, d: 40 }, holds: { small: 24 }, smallItemsLabel: 'Small items',
    fittings: ['shelf', 'drawer', 'sdrawer'], doors: 'none', look: 'drawers',
  },
  {
    id: 'shoe-cabinet', category: 'shoe-cabinets', name: 'Shoe cabinet', description: 'For the hallway, 80 × 120 cm, 35 cm deep',
    size: { w: 80, h: 120, d: 35 }, holds: { shoes: 16 },
    fittings: ['shoe', 'shelf'], doors: 'hinged', look: 'doors',
  },
] as const satisfies readonly PiecePreset[];

export type PiecePresetId = typeof PIECE_PRESETS[number]['id'];
export const PIECE_PRESET_IDS = PIECE_PRESETS.map(p => p.id);

export function piecePreset(id: string | undefined): (PiecePreset & { id: PiecePresetId }) | undefined {
  return PIECE_PRESETS.find(p => p.id === id);
}

/** The needs a preset is planned for, every possession named (those it does not hold are zero). */
export function presetNeeds(preset: PiecePreset, needs = preset.holds): Record<PossessionKey, number> {
  return Object.fromEntries(POSSESSION_KEYS.map(k => [k, k in preset.holds ? needs[k] ?? 0 : 0])) as Record<PossessionKey, number>;
}

export function presetProfile(profile: EditorProfile, preset: PiecePreset): EditorProfile {
  return { ...profile, needs: presetNeeds(preset), jackets: 0, coats: 0, upper: 'none' };
}

export function allowsPresetFitting(preset: PiecePreset | undefined, kind: string): boolean {
  return !preset || kind === 'void' || preset.fittings.some(fitting => fitting === kind);
}

/** The size to add a piece at, with the preset named so the new piece is made that kind; empty for no preset. */
export function presetSize(id: string | undefined): { w?: number; h?: number; d?: number; preset?: string } {
  const preset = id ? piecePreset(id) : undefined;
  return preset ? { ...preset.size, preset: preset.id } : {};
}
