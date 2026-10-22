import { decorCode, getDecor } from '../../domain/materials/decor-catalog';
import { defaultMaterials } from '../../domain/materials/configured-materials';
import { fitting, type FittingKind } from '../../domain/wardrobe/fittings';
import type { Wardrobe } from '../../domain/wardrobe/wardrobe';
import type { RenderPromptConfig } from './design-image';
import type { ConfiguredMaterialsState } from '../../domain/materials/configured-materials';
import { serializeConfiguredDecorManifest } from './decor-prompt-manifest';

type Finish = Wardrobe['finish'];
export interface ConfigurationForImage {
  design: {
    furniture: readonly {
      name: string;
      product?: 'kitchen' | undefined;
      finish: Finish;
      materials?: ConfiguredMaterialsState | undefined;
      doors: Wardrobe['doors'];
      dimensions: Wardrobe['dimensions'];
      position: Wardrobe['position'];
      rotation: number;
      sections: readonly {
        width: number;
        items: readonly {
          kind: FittingKind; width: number; height: number; x: number; y: number; boxes: number | null;
          purpose?: string | undefined; frontFacing?: boolean | undefined;
          editorItem?: { f?: Finish | null | undefined } | undefined;
        }[];
        dividers: readonly { orientation: 'horizontal' | 'vertical'; x: number; y: number; length: number }[];
      }[];
    }[];
    studio?: { walls: readonly { id: string; color?: string | undefined; finish?: string | undefined }[] } | undefined;
  };
}

export function renderCategory(specification: ConfigurationForImage): RenderPromptConfig['category'] {
  return specification.design.furniture.some(piece => piece.product === 'kitchen') ? 'kitchen' : 'wardrobe';
}

const cm = (n: number) => Math.round(n * 10) / 10;
const finishDescription = (finish: Finish) => {
  const sku = getDecor(defaultMaterials(finish).carcassDecorId);
  return `${decorCode(sku)} (${sku.name}, Grain: ${sku.grainDirection}; ${sku.aiPromptDescriptor})`;
};
const label = (text: string) => text.replace(/\s+/g, ' ').trim();
const fittingName = (kind: FittingKind) => {
  const definition = fitting(kind)!;
  return definition.itemName ?? definition.menu?.label ?? definition.name;
};

/** Serialize selected values only; palette entries, drawing primitives and editing metadata never enter the prompt. */
export function serializeConfigurationSummary(specification: ConfigurationForImage): string {
  const finishes: string[] = [], modules: string[] = [];
  for (const [index, piece] of specification.design.furniture.entries()) {
    // Use the configured name and pose rather than guessing left/right from a supporting camera.
    const wing = `Wing/module ${index + 1} (${label(piece.name)})`;
    const overrides = new Set(piece.sections.flatMap(section => section.items.flatMap(item => item.editorItem?.f ? [item.editorItem.f] : [])));
    const accessories = new Set(piece.sections.flatMap(section => section.items
      .filter(item => item.kind !== 'void').map(item => fittingName(item.kind))));
    finishes.push(serializeConfiguredDecorManifest(piece, wing) + '\n'
      + `Fitting finish overrides: ${[...overrides].map(finishDescription).join(', ') || 'none'}; `
      + `Internal accessories: ${[...accessories].join(', ') || 'none'}.`);
    const bays = piece.sections.map((section, bay) => {
      const items = [...section.items].sort((a, b) => b.y - a.y || a.x - b.x).map(item => {
        const boxes = item.boxes === null ? '' : ` with ${item.boxes} storage boxes`;
        const finish = item.editorItem?.f ? `, finish ${finishDescription(item.editorItem.f)}` : '';
        const purpose = item.purpose ? `, purpose ${item.purpose}` : '';
        const orientation = item.frontFacing ? ', front-facing' : '';
        return `${fittingName(item.kind)}${boxes} [${cm(item.width)}×${cm(item.height)}cm `
          + `at x=${cm(item.x)}, y=${cm(item.y)}${finish}${purpose}${orientation}]`;
      });
      const dividers = section.dividers.map(divider => `${divider.orientation} divider at x=${cm(divider.x)}, y=${cm(divider.y)}, length=${cm(divider.length)}cm`);
      return `Bay ${bay + 1} (${cm(section.width)}cm wide, top to bottom): ${items.join(', ') || 'empty open bay'}`
        + (dividers.length ? `; ${dividers.join(', ')}` : '');
    });
    const { width, height, depth } = piece.dimensions, { x, y, z } = piece.position;
    const doors = piece.doors === 'none' ? 'no outer doors (open bays)' : `${piece.doors} outer doors; preserve reference leaf divisions`;
    modules.push(`${wing}: ${cm(width)}×${cm(height)}×${cm(depth)}cm (W×H×D), position (${cm(x)}, ${cm(y)}, ${cm(z)})cm, `
      + `rotation ${cm(piece.rotation)}°; ${doors}. ${bays.join('; ')}.`);
  }
  const walls = specification.design.studio?.walls.filter(wall => wall.color || wall.finish)
    .map(wall => `${label(wall.id)}: ${wall.color ?? 'reference color'}, ${wall.finish ?? 'reference finish'}`) ?? [];
  return [
    '- TIER 1 Locked Finishes — Configured Finishes (Tier 1):',
    ...finishes.map(text => `  - ${text}`),
    ...(walls.length ? [`  - Selected wall finishes: ${walls.join('; ')}.`] : []),
    '- TIER 1 Module Breakdown — Wing/Module Breakdown (Tier 1):',
    ...modules.map(text => `  - ${text}`),
  ].join('\n');
}
