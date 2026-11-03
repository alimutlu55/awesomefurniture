import { resolveMaterials } from '../../domain/materials/configured-materials';
import { BufferGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Path, Shape, ShapeGeometry, Vector2, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import type { EditorState } from '../../application/projects/editor-scene';
import type { BoxBuilder, PrismBuilder } from './frame-geometry';
import { panelBuilder } from './frame-geometry';
import { handleMesh } from './hardware';
import { handlePlacement, resolveHandle } from '../../domain/wardrobe/handles';
import { createDecorMaterial } from './cabinet-materials';
import { getDecor } from '../../domain/materials/decor-catalog';
import { cabinetDoorLeaves, doorFit, doorTop, leafGlass, leafThickness } from '../../domain/wardrobe/door-layout';
import { hinge, hingeFor } from '../../domain/wardrobe/hinges';
import { hasTrait } from '../../domain/wardrobe/fittings';
import { drawerPull } from '../../domain/make/make-hardware';
import { leafKey, madeStyle } from '../../domain/wardrobe/front-styles';
import { styledFrontGeometry, styleLines } from './front-style-geometry';
import { boardSeed, boardUVs } from './board-geometry';
import { decorateFront } from './front-surface';
import { chosenLeaf, type createSelectionState } from '../editor/selection-state.js';
/** Doors follow structural compartments and the wardrobe's outer profile. Each leaf's pivot names it (`leaf`:
 * bay.row.leaf, `bay`) so a tap can choose it; the chosen leaf (selection-state chosenLeaf) of the `picked` wardrobe wears the selection look a
 * chosen fitting has. Opened, a leaf swings to its hinge's angle (`userData.t`, radians); the pull-out fittings among
 * `items` (drawers) are returned with them, to slide out by Make's drawer pull (`userData.slide`, cm) when the piece is
 * shown open. */
export function renderCabinetDoors(design: EditorState, widths: readonly number[], group: Object3D, box: BoxBuilder, prism: PrismBuilder, resources: Parameters<typeof createDecorMaterial>[0], panel: Material, hardware: Material,
    picked?: { selection: ReturnType<typeof createSelectionState>; wardrobe: number | undefined },
    items: readonly { readonly it: { readonly k: string }; readonly group: Object3D }[] = []): Object3D[] {
    const pivots: Object3D[] = [];
    for (const { group: drawer } of items.filter(x => hasTrait(x.it.k, 'pullout'))) {
        drawer.userData.slide = drawerPull(design.d);
        drawer.userData.rest = drawer.position.z;
        pivots.push(drawer);
    }
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
        // The cabinet's door style (Shaker, profiled edge, handle rail) as one mesh, in a decor it is made in; else a slab.
        const style = madeStyle({ ...design, materials: resolveMaterials(design) }, area.decorId), shaped = styledFrontGeometry(outline, t, style);
        if (shaped) {
            if (face.userData.board) boardUVs(shaped, boardSeed(hingeX, base, 0), face.userData.grainDirection, face.userData.boardMapping);
            const leafMesh = new Mesh(shaped, face);
            leafMesh.castShadow = leafMesh.receiveShadow = true;
            pivot.add(leafMesh);
        } else {
            build(outline, t, 0, face, pivot);
            decorateFront(outline, t, 0, face, pivot);
        }
        // The reveal round the leaf, and a styled leaf's own shadow lines (its frame, moulding or grip), as one line.
        const detail = shaped ? styleLines(outline, style) : { loops: [], runs: [] }, z = t / 2 + .02;
        const loop = (pts: readonly { x: number; y: number }[]) => pts.flatMap((p, k) => { const q = pts[(k + 1) % pts.length]!; return [new Vector3(p.x, p.y, z), new Vector3(q.x, q.y, z)]; });
        const edge = new LineSegments(new BufferGeometry().setFromPoints([...loop(outline), ...detail.loops.flatMap(loop),
            ...detail.runs.flatMap(r => r.slice(1).flatMap((q, k) => [new Vector3(r[k]!.x, r[k]!.y, z), new Vector3(q.x, q.y, z)]))]), reveal);
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
            // And framed: a border just inside its edge, so which door is chosen reads at a glance, on a phone too.
            const xs = outline.map(p => p.x), ys = outline.map(p => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            const band = Math.min(2.4, (Math.max(...xs) - Math.min(...xs)) / 7), ring = new Shape(outline.map(p => new Vector2(p.x, p.y)));
            ring.holes.push(new Path(outline.map(p => new Vector2(p.x + (p.x < cx ? band : -band), p.y + (p.y < cy ? band : -band))).reverse()));
            const frameLook = new MeshBasicMaterial({ color: 0x2a2520, transparent: true, opacity: .72, depthWrite: false });
            ((group.userData.ownedMaterials ??= []) as Material[]).push(frameLook);
            const frame = new Mesh(new ShapeGeometry(ring), frameLook);
            frame.position.z = t / 2 + .25; frame.renderOrder = 10;
            pivot.add(frame);
        }
        // The design's handle where handlePlacement puts it (Make drills it there), in pivot space.
        const edgeTop = top[left ? top.length - 1 : 0]!.y, handle = resolveHandle(resolveMaterials(design));
        const pull = handleMesh(handle, edgeTop - base, hardware, true), at = handlePlacement({ x0: area.x0, x1: area.x1, y0: base, y1: Math.max(...top.map(p => p.y)), outline: [{ x: area.x0, y: base }, { x: area.x1, y: base }, ...top.slice().reverse().map(p => ({ x: p.x + ax, y: p.y }))], door: true, hinge: area.hinge }, handle);
        // A handle-rail door is its own grip: no handle.
        if (pull && !(shaped && style.grip)) {
            pull.position.set(at.x - (left ? area.x0 : area.x1), at.y, t / 2);
            pivot.add(pull);
        }
        pivot.userData.t = (left ? -1 : 1) * hinge(hingeFor(area, design, leafGlass(design, area))).angle * Math.PI / 180;
        pivot.rotation.y = design.open ? pivot.userData.t : 0;
        group.add(pivot);
        pivots.push(pivot);
    });
    return pivots;
}
