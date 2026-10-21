import type { EditorDesign } from '../../domain/wardrobe/editor-design';
import { FIN } from '../../domain/wardrobe/catalog.js';
import type { createViewportResources } from './viewport-resources.js';
export function createCabinetMaterials(resources: Pick<ReturnType<typeof createViewportResources>, 'wood' | 'shade' | 'M'>, finish: EditorDesign['fin']) {
    const color = String(FIN[finish][0]);
    const panel = resources.wood(color), back = resources.wood(resources.shade(color, .92)), plinth = resources.wood(resources.shade(color, .72)), hardware = resources.M('#c2a878', { metalness: .8, roughness: .3 });
    // The editor darkens recesses for depth; reference captures must show the configured finish without that shading.
    back.userData.referenceColor = plinth.userData.referenceColor = panel.color.clone();
    return { panel, back, plinth, hardware, owned: [panel, back, plinth, hardware] };
}
