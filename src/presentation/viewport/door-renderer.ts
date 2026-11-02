import { resolveMaterials } from '../../domain/materials/configured-materials';
import { Group } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder, PrismBuilder } from './frame-geometry';
import { panelBuilder } from './frame-geometry';
import { handleMesh } from './hardware';
import { handlePlacement, resolveHandle } from '../../domain/wardrobe/handles';
import type { createViewportResources } from './viewport-resources.js';
import { cabinetDoorLeaves, doorFit, doorThickness, doorTop } from '../../domain/wardrobe/door-layout';
import { decorateFront } from './front-surface';
/** Doors follow structural compartments and the wardrobe's outer profile. */
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, prism: PrismBuilder, resources: Pick<ReturnType<typeof createViewportResources>, 'M'>, panel: Material, hardware: Material): Group[] {
    const pivots: Group[] = [];
    if (design.doors === 'none')
        return pivots;
    const build = panelBuilder(box, prism), fit = doorFit(design);
    const material = design.doors === 'glass' && !panel.userData.glassStyle ? resources.M('#a9d4f0', { transparent: true, opacity: .28, roughness: .1 }) : panel;
    cabinetDoorLeaves(design, widths).forEach(area => {
        const w = area.x1 - area.x0, left = area.hinge === 'left', pivot = new Group();
        const ax = area.x0, top = doorTop(design, ax, area.x1).map(p => ({ x: p.x - ax, y: Math.min(p.y, area.y1) }));
        const hingeX = (left ? area.x0 : area.x1) - design.w / 2, base = area.y0;
        pivot.position.set(hingeX, 0, design.d / 2 + fit.standoff);
        // Door outline in pivot space: x runs away from the hinge.
        const outline = [{ x: 0, y: base }, { x: w, y: base }, ...top.slice().reverse()].map(p => ({ x: left ? p.x : p.x - w, y: p.y }));
        build(outline, doorThickness(design), 0, material, pivot);
        decorateFront(outline, doorThickness(design), 0, material, pivot);
        // The design's handle where handlePlacement puts it (Make drills it there), in pivot space.
        const edgeTop = top[left ? top.length - 1 : 0]!.y, handle = resolveHandle(resolveMaterials(design));
        const pull = handleMesh(handle, edgeTop - base, hardware, true), at = handlePlacement({ x0: area.x0, x1: area.x1, y0: base, y1: edgeTop, door: true, hinge: area.hinge }, handle);
        if (pull) {
            pull.position.set(at.x - (left ? area.x0 : area.x1), at.y, doorThickness(design) / 2);
            pivot.add(pull);
        }
        pivot.userData.t = left ? -1.6 : 1.6;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
    });
    return pivots;
}
