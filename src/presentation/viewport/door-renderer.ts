import { Group } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder, PrismBuilder } from './frame-geometry';
import { panelBuilder } from './frame-geometry';
import { barPull } from './hardware';
import type { createViewportResources } from './viewport-resources.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { outerPolyline, resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
/** One door per section; its top edge follows the wardrobe's outer profile. */
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, prism: PrismBuilder, resources: Pick<ReturnType<typeof createViewportResources>, 'M'>, panel: Material, hardware: Material): Group[] {
    const pivots: Group[] = [];
    if (design.doors === 'none')
        return pivots;
    const shape = resolveShape(design), build = panelBuilder(box, prism);
    let x = -design.w / 2;
    const material = design.doors === 'glass' ? resources.M('#a9d4f0', { transparent: true, opacity: .28, roughness: .1 }) : panel;
    widths.forEach((width, index) => {
        const w = width + PANEL - .2, left = index < design.n / 2, pivot = new Group();
        const ax = x + .1 + design.w / 2, top = outerPolyline(shape, ax, ax + w).map(p => ({ x: p.x - ax, y: p.y - .2 }));
        const hingeX = left ? x + .1 : x + width + PANEL - .1, base = PLINTH + .2;
        pivot.position.set(hingeX, 0, design.d / 2 + 1.2);
        // Door outline in pivot space: x runs away from the hinge.
        const outline = [{ x: 0, y: base }, { x: w, y: base }, ...top.slice().reverse()].map(p => ({ x: left ? p.x : p.x - w, y: p.y }));
        build(outline, 1.6, 0, material, pivot);
        const edge = left ? w : 0, edgeTop = top[left ? top.length - 1 : 0]!.y, handleY = Math.min((base + edgeTop) / 2, base + 120);
        const pull = barPull(Math.min(24, Math.max(4, edgeTop - base - 8)), hardware, true);
        pull.position.set(left ? edge - 4 : -w + 4, handleY, .8);
        pivot.add(pull);
        pivot.userData.t = left ? -1.6 : 1.6;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
        x += width + PANEL;
    });
    return pivots;
}
