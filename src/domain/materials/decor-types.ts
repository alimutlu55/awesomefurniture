export type BoardManufacturer = 'Egger' | 'Kronospan' | 'Swiss Krono' | 'Fenix' | 'Pfleiderer' | 'Cleaf' | 'AGC Glass' | 'ALPI';
export type DecorCategory = 'wood_melamine' | 'natural_veneer' | 'unicolor_matte' | 'high_gloss'
  | 'textile_leather' | 'stone_mineral' | 'metallic_brushed' | 'glass_mirror';
export type TargetZone = 'carcass' | 'fronts' | 'worktop' | 'backing' | 'drawers' | 'backsplash';
export interface BoardDecorSKU {
  readonly id: string;
  readonly manufacturer: BoardManufacturer;
  readonly code: string;
  readonly surfaceStructure: string;
  readonly name: string;
  readonly category: DecorCategory;
  readonly allowedZones: readonly TargetZone[];
  /** Configurator's finished stock/assembly thickness, not the raw laminate/veneer sheet. */
  readonly thicknessMm: number;
  readonly edgeBandingSpec: string;
  readonly grainDirection: 'vertical' | 'horizontal' | 'none';
  readonly construction?: 'melamine' | 'lacquered_mdf' | 'laminate_on_mdf' | 'veneered_mdf' | 'compact_hpl' | 'glass' | 'mirror';
  readonly glassStyle?: 'smoked' | 'fluted' | 'silver_mirror' | 'bronze_mirror';
  readonly pbr: {
    readonly baseHex: string; readonly roughness: number; readonly metalness: number;
    readonly transmission?: number; readonly clearcoat?: number; readonly clearcoatRoughness?: number;
    readonly ior?: number; readonly thickness?: number;
    readonly textureUrl?: string; readonly swatchUrl?: string;
    readonly textureSizeCm?: readonly [number, number]; readonly textureGrainAxis?: 'u' | 'v';
    readonly relief?: 'weave' | 'leather' | 'pores' | 'brushed' | 'fluted';
  };
  readonly aiPromptDescriptor: string;
  readonly sourceUrl: string;
}

export const MATERIAL_FAMILIES: Readonly<Record<DecorCategory, string>> = {
  wood_melamine: 'Woodgrains', natural_veneer: 'Real wood veneers', unicolor_matte: 'Unicolor mattes', high_gloss: 'High gloss',
  textile_leather: 'Linen & leather', stone_mineral: 'Stone & marble', metallic_brushed: 'Brushed metals', glass_mirror: 'Glass & mirror',
};
