import { FURNITURE, furnitureKind } from '../furniture/furniture';
import { PIECE_PRESETS } from '../furniture/piece-presets';
import { KITCHEN_PRESETS } from '../kitchen/kitchen-design';
import { KITCHEN_UNITS, kitchenUnit, type KitchenUnitDef } from '../kitchen/kitchen-units';
import { FIXTURES, type FixtureKind } from '../studio/fixtures/fixture-kinds';
import { FURNISHINGS, type FurnishingKind } from '../studio/furnishings/furnishing-kinds';
import type { CabinetData } from './cabinet-piece';
import type { Mobility, Needs } from './piece-model';

export function kitchenMobility(unit: KitchenUnitDef): Mobility {
  if (unit.elevation <= 0) return 'floor';
  return unit.fixture && unit.fixture !== 'shelf' ? 'on-worktop' : 'on-wall';
}

const cabinetNeeds: Needs = { front: 60, sides: 0 };

const modules = FURNITURE.map(source => ({
  family: 'cabinet' as const, id: source.key, source, mobility: 'floor' as const, placing: 'wall' as const, blocks: true, needs: cabinetNeeds,
}));
const presets = PIECE_PRESETS.map(source => ({
  family: 'cabinet' as const, id: source.id, source, mobility: 'floor' as const, placing: 'wall' as const, blocks: true, needs: cabinetNeeds,
}));
const units = (KITCHEN_UNITS as readonly KitchenUnitDef[]).map(source => ({
  family: 'cabinet' as const, id: source.key, source, mobility: kitchenMobility(source),
  placing: kitchenMobility(source) === 'on-worktop' ? 'worktop' as const : 'wall' as const, blocks: true, needs: cabinetNeeds,
}));
const kitchenPresets = KITCHEN_PRESETS.filter(source => source.key !== source.unit).map(source => {
  const unit = units.find(entry => entry.id === source.unit)!;
  return { ...unit, id: source.key, source };
});
const fixtures = (FIXTURES as readonly FixtureKind[]).map(source => ({
  family: 'fixture' as const, id: source.key, source, mobility: 'along-wall' as const, placing: 'wall' as const,
  blocks: true, needs: { front: source.use, sides: 0 },
}));
const furnishings = (FURNISHINGS as readonly FurnishingKind[]).map(source => ({
  family: 'furnishing' as const, id: source.key, source, mobility: 'floor' as const, placing: source.placing, blocks: !source.flat, needs: source.use,
}));

/** Every room-piece kind, derived from the catalogues that own its sizes, variants and finishes. */
export const PIECE_KINDS = {
  cabinet: [...modules, ...presets, ...units, ...kitchenPresets],
  fixture: fixtures,
  furnishing: furnishings,
} as const;
export type PieceKind<F extends keyof typeof PIECE_KINDS> = typeof PIECE_KINDS[F][number];
export const fixturePieceKind = (id: string) => fixtures.find(entry => entry.id === id);
export const furnishingPieceKind = (id: string) => furnishings.find(entry => entry.id === id);

export function cabinetPieceKind(state: CabinetData['state']): PieceKind<'cabinet'> {
  const product = furnitureKind(state);
  if (product === 'kitchen') return units.find(entry => entry.id === kitchenUnit(state.unit).key)!;
  return presets.find(entry => entry.id === state.piecePreset) ?? modules.find(entry => entry.id === product) ?? modules[0]!;
}
