import { resolveMaterials } from '../../domain/materials/configured-materials';
import { BufferGeometry, Group, LineBasicMaterial, LineLoop, MeshBasicMaterial, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder, PrismBuilder } from './frame-geometry';
import { panelBuilder } from './frame-geometry';
import { handleMesh } from './hardware';
import { handlePlacement, resolveHandle } from '../../domain/wardrobe/handles';
import { createDecorMaterial } from './cabinet-materials';
import { getDecor } from '../../domain/materials/decor-catalog';
import { cabinetDoorLeaves, doorFit, doorTop, leafThickness } from '../../domain/wardrobe/door-layout';
import { leafKey } from '../../domain/wardrobe/front-styles';
import { decorateFront } from './front-surface';
import { chosenLeaf, type createSelectionState } from '../editor/selection-state.js';
/** Doors follow structural compartments and the wardrobe's outer profile. Each leaf's pivot names it (`leaf`:
 * bay.row.leaf, `bay`) so a tap can choose it; the chosen leaf (selection-state chosenLeaf) of the `picked` wardrobe wears the selection look a
 * chosen fitting has. */
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, prism: PrismBuilder, resources: Parameters<typeof createDecorMaterial>[0], panel: Material, hardware: Material,
    picked?: { selection: ReturnType<typeof createSelectionState>; wardrobe: number | undefined }): Group[] {
    const pivots: Group[] = [];
    if (design.doors === 'none')
        return pivots;
    const build = panelBuilder(box, prism), fit = doorFit(design), chosen = picked ? chosenLeaf(picked.selection, picked.wardrobe, design) : null;
    const material = design.doors === 'glass' && !panel.userData.glassStyle ? resources.M('#a9d4f0', { transparent: true, opacity: .28, roughness: .1 }) : panel;
    // A leaf in its own decor (a glass or mirror leaf among wood ones): one material per decor, owned by the group.
    const own = new Map<string, Material>();
    const leafMaterial = (id: string | undefined) => {
        if (!id) return material;
        let m = own.get(id);
        if (!m) { m = createDecorMaterial(resources, getDecor(id)); own.set(id, m); ((group.userData.ownedMaterials ??= []) as Material[]).push(m); }
        return m;
    };
    // The reveal round each leaf as it reads: the leaf's banded front edge in shadow. A line is a pixel wide at any
    // distance, so the gap between leaves (2 to 4 mm, under a pixel at the default framing) shows as an unbroken dark
    // line by day and by night instead of flickering in and out between pixels.
    const reveal = new LineBasicMaterial({ color: 0x0c0907, transparent: true, opacity: .8 });
    ((group.userData.ownedMaterials ??= []) as Material[]).push(reveal);
    cabinetDoorLeaves(design, widths).forEach(area => {
        const w = area.x1 - area.x0, left = area.hinge === 'left', pivot = new Group();
        const ax = area.x0, top = doorTop(design, ax, area.x1).map(p => ({ x: p.x - ax, y: Math.min(p.y, area.y1) }));
        const hingeX = (left ? area.x0 : area.x1) - design.w / 2, base = area.y0;
        pivot.position.set(hingeX, 0, design.d / 2 + fit.standoff);
        // Door outline in pivot space: x runs away from the hinge.
        const outline = [{ x: 0, y: base }, { x: w, y: base }, ...top.slice().reverse()].map(p => ({ x: left ? p.x : p.x - w, y: p.y }));
        const t = leafThickness(design, area), face = leafMaterial(area.decorId);
        build(outline, t, 0, face, pivot);
        decorateFront(outline, t, 0, face, pivot);
        const edge = new LineLoop(new BufferGeometry().setFromPoints(outline.map(p => new Vector3(p.x, p.y, t / 2 + .02))), reveal);
        edge.userData.reveal = true;
        pivot.add(edge);
        pivot.userData.leaf = leafKey(area.bay, area.row, area.leaf);
        pivot.userData.bay = area.bay;
        if (pivot.userData.leaf === chosen) {
            // The chosen fitting's look (cabinet-layout-renderer), laid over the door's face so it swings with it.
            const look = new MeshBasicMaterial({ color: 0xfff3d9, transparent: true, opacity: .22, depthWrite: false });
            ((group.userData.ownedMaterials ??= []) as Material[]).push(look);
            const glow = build(outline, .15, t / 2 + .1, look, pivot);
            glow.castShadow = glow.receiveShadow = false;
            glow.renderOrder = 9;
        }
        // The design's handle where handlePlacement puts it (Make drills it there), in pivot space.
        const edgeTop = top[left ? top.length - 1 : 0]!.y, handle = resolveHandle(resolveMaterials(design));
        const pull = handleMesh(handle, edgeTop - base, hardware, true), at = handlePlacement({ x0: area.x0, x1: area.x1, y0: base, y1: edgeTop, door: true, hinge: area.hinge }, handle);
        if (pull) {
            pull.position.set(at.x - (left ? area.x0 : area.x1), at.y, t / 2);
            pivot.add(pull);
        }
        pivot.userData.t = left ? -1.6 : 1.6;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
    });
    return pivots;
}
