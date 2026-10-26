import { getDecor, type TargetZone } from './decor-catalog';

export const HANDLE_FINISHES = ['matte_black', 'brushed_brass', 'anodized_champagne', 'handleless_tip_on'] as const;
export type HandleFinish = typeof HANDLE_FINISHES[number];
export const ACCESSORY_FINISHES = ['matte_black', 'brushed_steel', 'anodized_champagne'] as const;
export type AccessoryFinish = typeof ACCESSORY_FINISHES[number];
export interface ConfiguredMaterialsState {
  carcassDecorId: string;
  frontDecorId: string;
  handleFinish: HandleFinish;
  internalAccessoryFinish: AccessoryFinish;
  worktopDecorId?: string | undefined;
  backingDecorId?: string | undefined;
  drawerDecorId?: string | undefined;
  backsplashDecorId?: string | undefined;
  frontProfile?: 'slab' | 'micro_shaker' | undefined;
  integratedLed?: boolean | undefined;
  linkedDecors?: boolean | undefined;
}

export const materialZoneFields = {
  carcass: 'carcassDecorId', fronts: 'frontDecorId', worktop: 'worktopDecorId', backing: 'backingDecorId',
  drawers: 'drawerDecorId', backsplash: 'backsplashDecorId',
} as const;

const legacyDecors = { Oak: 'egger-h1318-st10', White: 'egger-w1100-st9', Walnut: 'egger-h3734-st9',
  Graphite: 'egger-u963-st9', Sage: 'egger-u638-st9' } as const;
export type LegacyFinish = keyof typeof legacyDecors;
export function defaultMaterials(finish: LegacyFinish = 'Oak'): ConfiguredMaterialsState {
  return { carcassDecorId: legacyDecors[finish], frontDecorId: legacyDecors[finish], handleFinish: 'brushed_brass',
    internalAccessoryFinish: 'anodized_champagne', linkedDecors: true };
}
/** Missing materials is the version-1 legacy format. Once selected, IDs exclusively own the appearance. */
export function resolveMaterials(design: { materials?: ConfiguredMaterialsState | undefined; fin?: LegacyFinish; finish?: LegacyFinish }): ConfiguredMaterialsState {
  return design.materials ?? defaultMaterials(design.fin ?? design.finish ?? 'Oak');
}
export function assertDecorZone(id: string, zone: TargetZone) {
  if (!getDecor(id).allowedZones.includes(zone)) throw new Error(`Board decor ${id} is not allowed for ${zone}`);
}
export const hardwareDescription = (finish: HandleFinish) => finish === 'handleless_tip_on'
  ? 'Flush handleless push-to-open fronts with clean 2mm shadow gaps (zero visible handles)'
  : `${finish.replaceAll('_', ' ')} pulls; preserve configured positions and orientation`;
export const accessoryDescription = (finish: AccessoryFinish) => finish.replaceAll('_', ' ');

/** Unselected legacy worktops keep their original 40mm geometry. */
export const worktopThickness = (design: { materials?: ConfiguredMaterialsState | undefined; worktopThickness?: number | undefined }) =>
  design.worktopThickness ?? (design.materials?.worktopDecorId ? getDecor(design.materials.worktopDecorId).thicknessMm / 10 : 4);
