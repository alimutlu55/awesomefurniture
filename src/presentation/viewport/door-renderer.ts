import { resolveMaterials } from '../../domain/materials/configured-materials';
import { Group } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder, PrismBuilder } from './frame-geometry';
import { panelBuilder } from './frame-geometry';
import { barPull } from './hardware';
import type { createViewportResources } from './viewport-resources.js';
import { cabinetDoorAreas, DOOR, doorHingeSide, doorThickness } from '../../domain/wardrobe/door-layout';
import { outerPolyline, resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
/** Doors follow structural compartments and the wardrobe's outer profile. */
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, prism: PrismBuilder, resources: Pick<ReturnType<typeof createViewportResources>, 'M'>, panel: Material, hardware: Material): Group[] {
    const pivots: Group[] = [];
    if (design.doors === 'none')
        return pivots;
    const shape = resolveShape(design), build = panelBuilder(box, prism);
    const material = design.doors === 'glass' ? resources.M('#a9d4f0', { transparent: true, opacity: .28, roughness: .1 }) : panel;
    cabinetDoorAreas(design, widths).forEach(area => {
        const w = area.x1 - area.x0, left = doorHingeSide(area, design) === 'left', pivot = new Group();
        const ax = area.x0, top = outerPolyline(shape, ax, area.x1).map(p => ({ x: p.x - ax, y: Math.min(p.y - DOOR.topGap, area.y1) }));
        const hingeX = (left ? area.x0 : area.x1) - design.w / 2, base = area.y0;
        pivot.position.set(hingeX, 0, design.d / 2 + DOOR.standoff);
        // Door outline in pivot space: x runs away from the hinge.
        const outline = [{ x: 0, y: base }, { x: w, y: base }, ...top.slice().reverse()].map(p => ({ x: left ? p.x : p.x - w, y: p.y }));
        build(outline, doorThickness(design), 0, material, pivot);
        const edge = left ? w : 0, edgeTop = top[left ? top.length - 1 : 0]!.y, handleY = Math.min((base + edgeTop) / 2, base + 120);
        if (resolveMaterials(design).handleFinish !== 'handleless_tip_on') {
            const pull = barPull(Math.min(24, Math.max(4, edgeTop - base - 8)), hardware, true);
            pull.position.set(left ? edge - 4 : -w + 4, handleY, doorThickness(design) / 2);
            pivot.add(pull);
        }
        pivot.userData.t = left ? -1.6 : 1.6;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
    });
    return pivots;
}
