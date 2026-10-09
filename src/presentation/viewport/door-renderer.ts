import { Group } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder } from './frame-geometry';
import type { createViewportResources } from './viewport-resources.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, resources: Pick<ReturnType<typeof createViewportResources>, 'M'>, panel: Material, hardware: Material): Group[] {
    const pivots: Group[] = [];
    if (design.doors === 'none')
        return pivots;
    let x = -design.w / 2;
    const material = design.doors === 'glass' ? resources.M('#a9d4f0', { transparent: true, opacity: .28, roughness: .1 }) : panel;
    widths.forEach((width, index) => {
        const w = width + PANEL - .2, left = index < design.n / 2, h = design.h - PLINTH - .4, pivot = new Group();
        pivot.position.set(left ? x + .1 : x + width + PANEL - .1, PLINTH + .2 + h / 2, design.d / 2 + 1.2);
        box(w, h, 1.6, left ? w / 2 : -w / 2, 0, 0, material, pivot);
        box(1.2, 18, 1.6, left ? w - 4 : -w + 4, 0, 1.4, hardware, pivot);
        pivot.userData.t = left ? -1.6 : 1.6;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
        x += width + PANEL;
    });
    return pivots;
}
