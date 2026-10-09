import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { FIN } from '../../domain/wardrobe/catalog.js';
import type { createViewportResources } from './viewport-resources.js';
export function createCabinetMaterials(resources: Pick<ReturnType<typeof createViewportResources>, 'wood' | 'shade' | 'M'>, finish: EditorDesign['fin']) {
    const color = String(FIN[finish][0]);
    const panel = resources.wood(color), back = resources.wood(resources.shade(color, .92)), plinth = resources.wood(resources.shade(color, .72)), hardware = resources.M('#c2a878', { metalness: .8, roughness: .3 });
    return { panel, back, plinth, hardware, owned: [panel, back, plinth, hardware] };
}
