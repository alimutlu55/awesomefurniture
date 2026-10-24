import { loftGeometry } from './loft-geometry';
import { sizeCanvasAdd } from './canvas-add-sizing';
import { scrubberBottom } from './dimension-scrubber-label';
import { shapeHandleVisible } from './shape-handle-visibility';
import { createStudioRenderer } from './studio-renderer';
import { studioBounds } from '../../domain/studio/studio';
import { createStudioOverlay } from './studio-overlay';
import { createWardrobeOcclusion, syncFurnitureTransparency } from './wardrobe-occlusion';
import { createWardrobeAssist, SIZE_SIDES } from './assist-overlay';
import * as THREE from "three";
import { boardBox, boardSeed, boardUVs } from './board-geometry';
import { disposeCabinetGroup } from './render-disposal';
import { createCabinetLayoutRenderer } from './cabinet-layout-renderer.js';
import { createViewportHandles } from './viewport-handles.js';
import { createFrameRenderer } from './frame-renderer.js';
import { createMovementOverlays } from './movement-overlays.js';
import { createDimensionRenderer } from './dimension-renderer.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { fittingDepth } from '../../domain/wardrobe/carcass';
import { measureNumber, unitSuffix } from '../editor/editor-format.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { createGarmentRenderer } from './garment-renderer';
import { createHandbagRenderer } from './handbag-renderer';
import { createTrouserRenderer } from './trouser-renderer';
import { createKitchenRunRenderer } from './kitchen-run-renderer';
import { deconflictLabels } from './label-deconflict';
import { createCabinetBuildCache, sceneGeometryFingerprint, wardrobeDesignFingerprint, createCvRectCache, createLabelDimMeasurer } from './cabinet-build-cache.js';
import { createLabelLayout } from './label-layout.js';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./cabinet-renderer.ports').CreateCabinetRendererPorts} ports */
export function createCabinetRenderer({ dom, camera, interactions, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, resources, model, commands, settings, lifetime,
    shapeInspector, studioEditor, kitchenArray }) {
    const { $, document } = dom;
    let renderDesign = model.activeCabinet().state;
    const geometry = createWardrobeGeometry(() => renderDesign, () => settings.budget);
    const { addRotationIndicator, addWardrobeActions, updateMoveIcons, addWardrobeMoveHandles, updateItemResizeHandles } = createViewportHandles({ dom, geometry, callbacks: { get dimensionStroke() {
                return dimensionStroke;
            }, get drawSnapGuides() {
                return drawSnapGuides;
            } }, model, renderState, interactionState, interactions, shell, inspector, resources, selectionState, getRenderDesign: () => renderDesign });
    // The room around the wardrobes: rebuilt with them when it changes; its walls fade every frame.
    // Optional: renderer tests build this without a 3D scene.
    const studio = resources?.scene ? createStudioRenderer(resources.scene) : null;
    if (studio) lifetime.cleanup(() => studio.dispose());
    // Kitchen runs: the worktop, plinth, sinks and hobs that neighbouring kitchen units share.
    const kitchenRuns = resources?.scene ? createKitchenRunRenderer(resources.scene, resources) : null;
    if (kitchenRuns) lifetime.cleanup(() => kitchenRuns.dispose());
    // Another wardrobe between the camera and the selected one steps aside, leaving an outline.
    const occlusion = resources?.scene ? createWardrobeOcclusion(resources.scene) : null;
    if (occlusion) lifetime.cleanup(() => occlusion.dispose());
    /** What the sun's shadows depend on; they are redrawn only when it changes, not as the camera moves. */
    const shadowKey = () => {
        let k = renderState.buildStamp + '|' + renderState.settling.length + '|' + (studio?.shadowKey() ?? '');
        for (const g of renderState.wardrobeGroups) k += '|' + g.visible + g.position.x.toFixed(1) + ',' + g.position.y.toFixed(1) + ',' + g.position.z.toFixed(1) + ',' + g.rotation.y.toFixed(3);
        for (const p of renderState.pivots) k += '|' + p.rotation.y.toFixed(3);
        return k;
    };
    const syncWallGhosting = () => {
        const sel = studioEditor?.valid() ?? selectionState.room ?? null;
        syncFurnitureTransparency(renderState.wardrobeGroups, sel?.kind === 'wall' || sel?.kind === 'opening', resources?.scene);
    };
    const sceneFrame = { shadowKey, frame: (cam, dt) => {
        studio?.frame(cam, dt); kitchenRuns?.sync(model.scene.wardrobes); syncWallGhosting();
        occlusion?.frame(cam, model.scene.wardrobes, renderState.wardrobeGroups, selectionState.focusOn ? model.scene.activeWardrobe : null, dt);
        // Which wardrobes stepped aside, for assistive tools and checks (no visible label shows it).
        const hidden = occlusion?.hiddenIds().join(' ') ?? '', view = $('#view');
        if (view && view.dataset.hiddenWardrobes !== hidden) view.dataset.hiddenWardrobes = hidden;
    } };
    // Room editing: handles, rulers and guides for the selected wall or opening.
    const overlay = studio && studioEditor ? createStudioOverlay({ document, labels: () => $('#labels'), scene: resources.scene, camera: resources.cam, canvas: resources.cv, renderState,
        label: (p, t, c) => label(p, t, c), bindRuler: (e, a, b, x) => bindRuler(e, a, b, x), editor: studioEditor }) : null;
    if (overlay) lifetime.cleanup(() => overlay.dispose());
    // The measuring assistant: gaps to the walls, neighbours and ceiling while a wardrobe moves or is resized.
    const wardrobeAssist = resources?.scene ? createWardrobeAssist({ document, labels: () => $('#labels'), scene: resources.scene, renderState }) : null;
    if (wardrobeAssist) lifetime.cleanup(() => wardrobeAssist.dispose());
    /** @param {import('../../domain/studio/scene-gaps').GapSide[] | null} sides @param {'move' | 'size'} [mode] */
    const assist = (sides, mode = 'move') => wardrobeAssist?.show(model.scene, model.scene.wardrobes.length ? model.activeCabinet() : null, sides, mode, selectionState.editingSize);
    /** Where the wardrobes stand, so the room leaves out door and window trim hidden behind one. */
    const wardrobeFootprints = () => model.scene.wardrobes.map(c => ({ x: c.x, z: c.z, angle: c.angle, w: c.state.w, d: c.state.d }));
    /** Redraws only the room and its handles: a wall drag never rebuilds the wardrobes. */
    function redrawStudio() {
        studio?.sync(model.scene.studio, wardrobeFootprints());
        studio?.select(studioEditor?.valid() ?? null);
        syncWallGhosting();
        overlay?.draw();
        positionLabels();
    }
    const { loop } = createFrameRenderer({ dom, lifetime, renderState, camera, resources, cameraState, interactionState, picking, interactions, shellState, studio: sceneFrame, callbacks: { get positionLabels() {
                return positionLabels;
            } } });
    const {
        holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances,
        updatePreviewOutlines, clearPreview, clearSettling, drawSnapGuides
    } = createMovementOverlays({ dom, geometry, callbacks: { get label() {
                return label;
            }, get dimensionStroke() {
                return dimensionStroke;
            }, get bindRuler() {
                return bindRuler;
            } }, renderState, resources, interactionState, getRenderDesign: () => renderDesign });
    const { rulerScreenPlacement, bindRuler, drawScreenRuler, finishScreenRuler, dimensionStroke, label } = createDimensionRenderer({ dom, renderState, resources });
    function theme() {
        const c = getComputedStyle(document.documentElement);
        resources.R.setClearColor(c.getPropertyValue('--scene').trim(), 0);
    }
    function box(w, h, d, x, y, z, m, g) {
        // Wood boards: eased edges and veneer at true scale, grain along the board.
        const board = m?.userData?.board;
        const geo = board ? boardUVs(boardBox(w, h, d), boardSeed(x, y, z), m.userData.grainDirection, m.userData.boardMapping) : new THREE.BoxGeometry(w, h, d);
        const o = new THREE.Mesh(geo, m);
        o.position.set(x, y, z);
        o.castShadow = o.receiveShadow = true;
        (g || renderState.Gr).add(o);
        return o;
    }
    /** Extruded front-elevation outline for angled or notched panels. UVs span the
     * panel like a box face so wood grain keeps its scale. */
    function prism(points, depth, z, m, g, back) {
        const geo = loftGeometry(points, depth, z, back);
        if (m?.userData?.board) boardUVs(geo, boardSeed(points[0].x, points[0].y, z), m.userData.grainDirection, m.userData.boardMapping);
        else planarUVs(geo);
        const o = new THREE.Mesh(geo, m);
        o.castShadow = o.receiveShadow = true;
        (g || renderState.Gr).add(o);
        return o;
    }
    function planarUVs(geo) {
        geo.computeBoundingBox();
        const b = geo.boundingBox, pos = geo.attributes.position, uv = geo.attributes.uv, W = Math.max(1e-6, b.max.x - b.min.x), H = Math.max(1e-6, b.max.y - b.min.y);
        for (let k = 0; k < pos.count; k++) {
            uv.setXY(k, (pos.getX(k) - b.min.x) / W, (pos.getY(k) - b.min.y) / H);
        }
        uv.needsUpdate = true;
    }
    /** Flat translucent outline (highlights and AO) clipped to a polygon. */
    function flatShape(points, material) {
        const geo = new THREE.ShapeGeometry(new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.y))));
        planarUVs(geo);
        return new THREE.Mesh(geo, material);
    }
    const clothes = createGarmentRenderer({ resources, renderState });
    const { garment } = clothes;
    const bags = createHandbagRenderer();
    const { handbag } = bags;
    const trousers = createTrouserRenderer(resources?.cv?.ownerDocument);
    const { trouserPullOut } = trousers;
    lifetime?.cleanup(() => { clothes.dispose(); bags.dispose(); trousers.dispose(); });
    const sharedMaterials = () => new Set([resources.HM, ...clothes.sharedMaterials, ...bags.sharedMaterials, ...trousers.sharedMaterials]);
    const sharedGeometries = () => new Set([...clothes.sharedGeometries, ...bags.sharedGeometries, ...trousers.sharedGeometries]);
    const buildCache = createCabinetBuildCache({ resources, clothes, bags, trousers });
    lifetime?.cleanup(() => buildCache.disposeAll(sharedMaterials(), sharedGeometries()));
    const getCvRect = createCvRectCache(resources?.cv);
    const labelDim = createLabelDimMeasurer();
    let lastSceneFingerprint = '', cachedActiveRenderMap = new Map();
    /** Keeps the sun's shadows sharp: its shadow camera covers the room and the wardrobes, no more. */
    function fitLight() {
        const room = model.scene.studio && studioBounds(model.scene.studio), xs = [], zs = [];
        let h = 230;
        for (const w of model.scene.wardrobes) {
            const r = Math.hypot(w.state.w, w.state.d) / 2;
            xs.push(w.x - r, w.x + r); zs.push(w.z - r, w.z + r); h = Math.max(h, w.state.h + (w.y || 0));
        }
        if (room) { xs.push(room.x0, room.x1); zs.push(room.z0, room.z1); h = Math.max(h, room.height); }
        if (!xs.length) xs.push(-100, 100), zs.push(-100, 100);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        resources.lighting?.fit({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h });
        // In a room its own floor takes the shadows; the open ground outside it would show the walls' shadows.
        if (resources.ground) resources.ground.visible = !room;
        resources.stage?.fit((x0 + x1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0));
    }
    /** @returns {[import('three').Vector3,import('three').Vector3,number][]} */
    function dividerClearancePoints(index, baseX) {
        const m = geometry.dividerMeasurements(index), V = THREE.Vector3, front = fittingDepth(renderDesign.d).z1 - renderDesign.d / 2;
        const midX = baseX + (m.x0 + m.x1) / 2, midY = geometry.interiorFloor() + (m.y0 + m.y1) / 2;
        return m.hor ? [[new V(midX, geometry.interiorFloor() + m.low, front), new V(midX, geometry.interiorFloor() + m.y0, front), m.before],
            [new V(midX, geometry.interiorFloor() + m.y1, front), new V(midX, geometry.interiorFloor() + m.high, front), m.after]]
            : [[new V(baseX + m.low, midY, front), new V(baseX + m.x0, midY, front), m.before],
            [new V(baseX + m.x1, midY, front), new V(baseX + m.high, midY, front), m.after]];
    }
    function clearanceSegments(a, b) {
        const tick = Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? new THREE.Vector3(2, 0, 0) : new THREE.Vector3(0, 2, 0);
        return [a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)];
    }
    function createDividerClearances(index, baseX) {
        return dividerClearancePoints(index, baseX).map(([a, b, value], j) => {
            const el = label(a.clone().add(b).multiplyScalar(.5), measureNumber(value) + unitSuffix(), 'lbl dim clearance divider-clearance');
            const entry = renderState.labs[renderState.labs.length - 1];
            bindRuler(el, a, b, Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? 'height-left' : 'width');
            entry.visible = value > .1;
            inspector.editableDividerClearance(el, index, j === 0 ? 'before' : 'after');
            return { entry };
        });
    }
    function refreshDividerVisual(index) {
        const d = renderDesign.dividers?.[index], v = renderState.dividerVisuals[index];
        if (!d || !v) return;
        if (!v.panel || renderDesign.shape || renderDesign.doors !== 'none') { build(); return; }
        const r = geometry.dividerRect(d), pos = new THREE.Vector3(v.baseX + (r.x0 + r.x1) / 2, geometry.interiorFloor() + (r.y0 + r.y1) / 2, -.5);
        const delta = pos.clone().sub(v.panel.position);
        v.panel.position.copy(pos); v.hit.position.x = pos.x; v.hit.position.y = pos.y; v.outline.position.add(delta);
        for (const entry of [v.sizeEntry, v.depthEntry]) {
            entry.p.add(delta);
            if (entry.ruler) { entry.ruler.a.add(delta); entry.ruler.b.add(delta); }
        }
        dividerClearancePoints(index, v.baseX).forEach(([a, b, value], j) => {
            const q = v.clearances[j];
            q.entry.ruler.a.copy(a); q.entry.ruler.b.copy(b);
            q.entry.visible = value > .1;
            q.entry.p.copy(a).add(b).multiplyScalar(.5);
            q.entry.el.textContent = measureNumber(value) + unitSuffix();
            inspector.editableDividerClearance(q.entry.el, index, j === 0 ? 'before' : 'after');
        });
        positionLabels();
        inspector.dividerUI();
    }
    const { buildCabinet, moveSplitHandles } = createCabinetLayoutRenderer({ maxReach: () => model.scene.maxReach, dom, createDividerClearances, renderState,
        geometry, resources, getRenderDesign: () => renderDesign, box, prism, flatShape, shapeInspector, picking, label, garment, handbag,
        trouserPullOut, bindRuler, dimensionStroke, inspector, selectionState, interactions, commands, interactionState });

    function build() {
        if (!model.scene.wardrobes.length) selectionState.shapeEditing = false;
        studio?.sync(model.scene.studio, wardrobeFootprints());
        fitLight();
        studio?.select(studioEditor?.valid() ?? null);
        const selected = model.activeCabinet(), currentFingerprint = sceneGeometryFingerprint(model.scene, selectionState, interactionState), activeId = model.scene.activeWardrobe;

        if (currentFingerprint && currentFingerprint === lastSceneFingerprint && buildCache.get(selected.id)) {
            for (const wardrobe of model.scene.wardrobes) {
                const cached = buildCache.get(wardrobe.id);
                if (cached) {
                    cached.Gr.position.set(wardrobe.x, wardrobe.y || 0, wardrobe.z);
                    cached.Gr.rotation.y = wardrobe.angle * Math.PI / 180;
                    cached.Gr.children.forEach(o => { if (o.userData.floorShadow) o.position.y = .12 - (wardrobe.y || 0); });
                    cached.Gr.updateMatrixWorld(true);
                }
            }
            renderDesign = selected.state;
            const activeRender = cachedActiveRenderMap.get(selected.id) || { Gr: new THREE.Group(), hits: [], outs: [], ihits: [], itemGroups: [] };
            ({ Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups } = activeRender);
            renderState.labs = renderState.labs.filter(l => {
                if (l.el.matches('.ground-rotate,.wardrobe-actions')) { l.el.remove(); return false; }
                return true;
            });
            if (selectionState.focusOn && model.scene.wardrobes.length && !selectionState.shapeEditing && !inspector.inside()) {
                addRotationIndicator(); addWardrobeActions(); addWardrobeMoveHandles(); kitchenArray?.place();
            }
            for (const h of renderState.allItemHits) {
                if (h.userData.o) {
                    const isel = (h.userData.wardrobe === activeId) && h.userData.i === renderDesign.sel && h.userData.j === renderDesign.item;
                    h.userData.o.visible = isel; h.userData.s = isel;
                }
            }
            for (let j = 0; j < renderState.outs.length; j++) {
                renderState.outs[j].visible = j === renderDesign.sel && (!selectionState.focusOn || j !== renderDesign.sel);
            }
            if (renderState.dividerVisuals) {
                for (let j = 0; j < renderState.dividerVisuals.length; j++) {
                    const v = renderState.dividerVisuals[j];
                    if (v?.outline) v.outline.visible = (renderDesign.divider === j);
                    if (v?.clearances) v.clearances.forEach(c => c.entry.visible = renderDesign.divider === j && c.entry.ruler.a.distanceTo(c.entry.ruler.b) > .1);
                }
            }
            inspector.crumbUI(); syncWallGhosting(); overlay?.draw();
            if (!interactionState.wardrobeGesture) assist(selectionState.editingSize ? SIZE_SIDES[selectionState.editingSize] : null, 'size');
            moveSplitHandles();
            positionLabels();
            return;
        }

        lastSceneFingerprint = currentFingerprint;
        const previousShapeHandles = renderState.labs.filter(l => l.el.classList.contains('shape-handle') && !l.el.classList.contains('room-handle'));
        renderState.dividerVisuals = [];
        renderState.labs.forEach(l => {
            if (!l.el.classList.contains('shape-handle') && !l.el.classList.contains('array-grip')) l.el.remove();
            l.rulerNode?.remove();
        });
        kitchenArray?.beginBuild();
        buildCache.pruneExcept(model.scene.wardrobes.map(w => w.id), sharedMaterials(), sharedGeometries());
        renderState.wardrobeGroups = []; renderState.allHits = []; renderState.allItemHits = []; renderState.garments = [];
        clothes.beginBuild(); bags.beginBuild(); trousers.beginBuild();
        const combinedLabs = [], combinedPivots = [];
        let activeRender;
        cachedActiveRenderMap.clear();

        for (const wardrobe of model.scene.wardrobes) {
            const wKey = wardrobeDesignFingerprint(wardrobe, model.scene.activeWardrobe, selectionState, interactionState);
            let cached = buildCache.get(wardrobe.id);
            if (!cached || cached.key !== wKey) {
                if (cached) buildCache.disposeWardrobe(wardrobe.id, sharedMaterials(), sharedGeometries());
                renderDesign = wardrobe.state;
                renderState.renderCabinet = wardrobe;
                renderState.renderActive = wardrobe.id === model.scene.activeWardrobe;
                buildCabinet();
                cached = { key: wKey, Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits,
                    itemGroups: renderState.itemGroups, pivots: renderState.pivots, garments: renderState.garments ? [...renderState.garments] : [],
                    dividerVisuals: renderState.dividerVisuals ? [...renderState.dividerVisuals] : [], labs: [...renderState.labs] };
                buildCache.set(wardrobe.id, cached);
            } else {
                buildCache.retainAssets(wardrobe.id);
                cached.labs?.forEach(l => {
                    if (l.el && !l.el.isConnected) $('#labels').appendChild(l.el);
                });
            }

            cached.Gr.position.set(wardrobe.x, wardrobe.y || 0, wardrobe.z);
            cached.Gr.rotation.y = wardrobe.angle * Math.PI / 180;
            cached.Gr.updateMatrixWorld(true);
            cached.Gr.userData.wardrobe = wardrobe.id;
            cached.hits.forEach(h => h.userData.wardrobe = wardrobe.id);
            cached.ihits.forEach(h => h.userData.wardrobe = wardrobe.id);
            cached.pivots.forEach(p => p.userData.state = wardrobe.state);

            renderState.wardrobeGroups.push(cached.Gr);
            renderState.allHits.push(...cached.hits);
            renderState.allItemHits.push(...cached.ihits);
            if (cached.garments) renderState.garments.push(...cached.garments);
            combinedLabs.push(...cached.labs);
            combinedPivots.push(...cached.pivots);

            const renderInfo = { Gr: cached.Gr, hits: cached.hits, outs: cached.outs, ihits: cached.ihits, itemGroups: cached.itemGroups };
            cachedActiveRenderMap.set(wardrobe.id, renderInfo);
            if (wardrobe.id === model.scene.activeWardrobe) activeRender = renderInfo;
        }
        clothes.endBuild(); bags.endBuild(); trousers.endBuild(); kitchenRuns?.sync(model.scene.wardrobes);

        activeRender ??= { Gr: new THREE.Group(), hits: [], outs: [], ihits: [], itemGroups: [] };
        renderDesign = selected.state;
        ({ Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups } = activeRender);
        renderState.labs = combinedLabs;

        const usedLabels = new Set(combinedLabs.map(l => l.el));
        previousShapeHandles.forEach(l => { if (!usedLabels.has(l.el)) l.el.remove(); });
        renderState.pivots = combinedPivots;
        renderState.renderActive = true;
        renderState.moveIcons = [];
        dom.$('#app').toggleAttribute('data-no-wardrobe', !model.scene.wardrobes.length);
        if (selectionState.focusOn && model.scene.wardrobes.length && !selectionState.shapeEditing && !inspector.inside()) {
            addRotationIndicator(); addWardrobeActions(); addWardrobeMoveHandles(); kitchenArray?.place();
        }
        WardrobePlanner.configure(geometry.plannerConfig());
        inspector.crumbUI();
        resources.contact.visible = false;
        syncWallGhosting();
        overlay?.draw();
        if (!interactionState.wardrobeGesture) assist(selectionState.editingSize ? SIZE_SIDES[selectionState.editingSize] : null, 'size');
        positionLabels();
    }
    const positionLabels = createLabelLayout({
        dom, renderState, resources, shapeInspector, selectionState,
        drawScreenRuler, finishScreenRuler, overlay, inspector, updateItemResizeHandles,
        updateMoveIcons, getCvRect, labelDim
    });
    return {
        assist, redrawStudio, studioPickables: () => studio?.pickables() ?? [], wallGuide: segment => studio?.guide(segment),
        theme, box, prism, flatShape, label, rulerScreenPlacement, bindRuler, drawScreenRuler, dimensionStroke,
        garment, build, buildCabinet, dividerClearancePoints, clearanceSegments, createDividerClearances,
        refreshDividerVisual, holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances, updatePreviewOutlines,
        clearPreview, clearSettling, positionLabels, loop, addRotationIndicator, updateMoveIcons,
        addWardrobeMoveHandles, drawSnapGuides, updateItemResizeHandles
    };
}
