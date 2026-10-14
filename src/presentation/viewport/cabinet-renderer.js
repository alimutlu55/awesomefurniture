import { loftGeometry } from './loft-geometry';
import { createStudioRenderer } from './studio-renderer';
import { studioBounds } from '../../domain/studio/studio';
import { createStudioOverlay } from './studio-overlay';
import { createWardrobeOcclusion } from './wardrobe-occlusion';
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
import { measureNumber } from '../editor/editor-format.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { createGarmentRenderer } from './garment-renderer';
import { createHandbagRenderer } from './handbag-renderer';
import { createTrouserRenderer } from './trouser-renderer';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./cabinet-renderer.ports').CreateCabinetRendererPorts} ports */
export function createCabinetRenderer({ dom, camera, interactions, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, resources, model, commands, settings, lifetime,
    shapeInspector, studioEditor }) {
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
    const sceneFrame = { shadowKey, frame: (cam, dt) => {
        studio?.frame(cam, dt);
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
        overlay?.draw();
        positionLabels();
    }
    const { loop } = createFrameRenderer({ dom, lifetime, renderState, camera, resources, cameraState, interactionState, picking, interactions, shellState, studio: sceneFrame, callbacks: { get positionLabels() {
                return positionLabels;
            } } });
    const { holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances, clearPreview, clearSettling, drawSnapGuides } = createMovementOverlays({ dom, geometry, callbacks: { get label() {
                return label;
            }, get dimensionStroke() {
                return dimensionStroke;
            }, get bindRuler() {
                return bindRuler;
            } }, renderState, resources, interactionState, getRenderDesign: () => renderDesign });
    const { rulerScreenPlacement, bindRuler, drawScreenRuler, dimensionStroke, label } = createDimensionRenderer({ dom, renderState, resources });
    function theme() {
        const c = getComputedStyle(document.documentElement);
        resources.R.setClearColor(c.getPropertyValue('--scene').trim(), 0);
    }
    function box(w, h, d, x, y, z, m, g) {
        // Wood boards: eased edges and veneer at true scale, grain along the board.
        const board = m?.userData?.board, geo = board ? boardUVs(boardBox(w, h, d), boardSeed(x, y, z)) : new THREE.BoxGeometry(w, h, d);
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
        if (m?.userData?.board) boardUVs(geo, boardSeed(points[0].x, points[0].y, z));
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
    function build() {
        if (!model.scene.wardrobes.length) selectionState.shapeEditing = false;
        studio?.sync(model.scene.studio, wardrobeFootprints());
        fitLight();
        studio?.select(studioEditor?.valid() ?? null);
        const selected = model.activeCabinet();
        const previousShapeHandles = renderState.labs.filter(l => l.el.classList.contains('shape-handle') && !l.el.classList.contains('room-handle'));
        renderState.dividerVisuals = [];
        renderState.labs.forEach(l => {
            // Pooled handles survive rebuilds so an active drag keeps its pointer capture.
            if (l.el !== renderState.dividerMoveHandle && !l.el.classList.contains('shape-handle')) {
                l.el.remove();
            }
            l.rulerNode?.remove();
        });
        renderState.wardrobeGroups.forEach(g => {
            resources.scene.remove(g);
            disposeCabinetGroup(g, new Set([resources.HM, ...clothes.sharedMaterials, ...bags.sharedMaterials, ...trousers.sharedMaterials]), new Set([...clothes.sharedGeometries, ...bags.sharedGeometries, ...trousers.sharedGeometries]));
        });
        renderState.wardrobeGroups = [];
        renderState.allHits = [];
        renderState.allItemHits = [];
        renderState.garments = [];
        clothes.beginBuild();
        bags.beginBuild();
        trousers.beginBuild();
        const combinedLabs = [], combinedPivots = [];
        let activeRender;
        for (const wardrobe of model.scene.wardrobes) {
            renderDesign = wardrobe.state;
            renderState.renderCabinet = wardrobe;
            renderState.renderActive = wardrobe.id === model.scene.activeWardrobe;
            buildCabinet();
            renderState.Gr.position.set(wardrobe.x, wardrobe.y || 0, wardrobe.z);
            renderState.Gr.rotation.y = wardrobe.angle * Math.PI / 180;
            renderState.Gr.updateMatrixWorld(true);
            renderState.wardrobeGroups.push(renderState.Gr);
            renderState.hits.forEach(h => h.userData.wardrobe = wardrobe.id);
            renderState.ihits.forEach(h => h.userData.wardrobe = wardrobe.id);
            renderState.pivots.forEach(p => p.userData.state = renderDesign);
            renderState.allHits.push(...renderState.hits);
            renderState.allItemHits.push(...renderState.ihits);
            combinedLabs.push(...renderState.labs);
            combinedPivots.push(...renderState.pivots);
            if (renderState.renderActive) {
                activeRender = { Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups };
            }
        }
        clothes.endBuild();
        bags.endBuild();
        trousers.endBuild();
        // Every wardrobe removed: an empty stand-in keeps the active-wardrobe handles pointing at nothing.
        activeRender ??= { Gr: new THREE.Group(), hits: [], outs: [], ihits: [], itemGroups: [] };
        renderDesign = selected.state;
        ({ Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups } = activeRender);
        renderState.labs = combinedLabs;
        // Prune wardrobe handles only; the studio overlay owns room handles and their active pointer capture.
        const usedLabels = new Set(combinedLabs.map(l => l.el));
        previousShapeHandles.forEach(l => { if (!usedLabels.has(l.el)) l.el.remove(); });
        renderState.pivots = combinedPivots;
        renderState.renderActive = true;
        renderState.moveIcons = [];
        dom.$('#app').toggleAttribute('data-no-wardrobe', !model.scene.wardrobes.length);
        if (selectionState.focusOn && model.scene.wardrobes.length) {
            if (!inspector.inside() || (dom.width <= 900 && dom.$('#app').dataset.toolbarMode === 'move')) {
                addRotationIndicator();
                addWardrobeActions();
                addWardrobeMoveHandles();
            }
        }
        WardrobePlanner.configure(geometry.plannerConfig());
        inspector.crumbUI();
        resources.contact.visible = false;
        overlay?.draw();
        if (!interactionState.wardrobeGesture) assist(selectionState.editingSize ? SIZE_SIDES[selectionState.editingSize] : null, 'size');
        if (renderState.dividerMoveHandle && !renderState.labs.some(l => l.el === renderState.dividerMoveHandle)) {
            renderState.dividerMoveHandle.remove();
        }
        positionLabels();
    }
    const { buildCabinet } = createCabinetLayoutRenderer({ dom, createDividerClearances, renderState, geometry, resources, getRenderDesign: () => renderDesign, box, prism, flatShape, shapeInspector, picking, label, garment, handbag, trouserPullOut, bindRuler, dimensionStroke, inspector, selectionState, interactions, commands, interactionState });
    /** @returns {[import('three').Vector3,import('three').Vector3,number][]} */
    function dividerClearancePoints(index, baseX) {
        const m = geometry.dividerMeasurements(index), V = THREE.Vector3, front = renderDesign.d / 2 + 4, midX = baseX + (m.x0 + m.x1) / 2, midY = PLINTH + PANEL + (m.y0 + m.y1) / 2;
        return m.hor ? [[new V(midX, PLINTH + PANEL + m.low, front), new V(midX, PLINTH + PANEL + m.y0, front), m.before], [new V(midX, PLINTH + PANEL + m.y1, front), new V(midX, PLINTH + PANEL + m.high, front), m.after]] : [[new V(baseX + m.low, midY, front), new V(baseX + m.x0, midY, front), m.before], [new V(baseX + m.x1, midY, front), new V(baseX + m.high, midY, front), m.after]];
    }
    function clearanceSegments(a, b) {
        const tick = Math.abs(b.y - a.y) > Math.abs(b.x - a.x) ? new THREE.Vector3(2, 0, 0) : new THREE.Vector3(0, 2, 0);
        return [a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)];
    }
    function createDividerClearances(index, baseX) {
        return dividerClearancePoints(index, baseX).map(([a, b, value], j) => {
            const line = dimensionStroke(clearanceSegments(a, b));
            line.visible = value > .1;
            const el = label(a.clone().add(b).multiplyScalar(.5), measureNumber(value) + ' cm', 'lbl dim clearance divider-clearance'), entry = renderState.labs[renderState.labs.length - 1];
            inspector.editableDividerClearance(el, index, j === 0 ? 'before' : 'after');
            return { line, entry };
        });
    }
    function refreshDividerVisual(index) {
        const d = renderDesign.dividers?.[index], v = renderState.dividerVisuals[index];
        if (!d || !v) {
            return;
        }
        // Shaped boards and divider-aligned door leaves change geometry as the board moves.
        if (!v.panel || renderDesign.shape || renderDesign.doors !== 'none') {
            build();
            return;
        }
        const r = geometry.dividerRect(d), pos = new THREE.Vector3(v.baseX + (r.x0 + r.x1) / 2, PLINTH + PANEL + (r.y0 + r.y1) / 2, -.5), delta = pos.clone().sub(v.panel.position);
        v.panel.position.copy(pos);
        v.hit.position.x = pos.x;
        v.hit.position.y = pos.y;
        v.outline.position.add(delta);
        for (const entry of [v.sizeEntry, v.depthEntry, v.handleEntry]) {
            entry.p.add(delta);
            if (entry.ruler) {
                entry.ruler.a.add(delta);
                entry.ruler.b.add(delta);
            }
        }
        dividerClearancePoints(index, v.baseX).forEach(([a, b, value], j) => {
            const q = v.clearances[j];
            q.line.geometry.setFromPoints(clearanceSegments(a, b));
            q.line.visible = value > .1;
            q.entry.p.copy(a).add(b).multiplyScalar(.5);
            q.entry.el.textContent = measureNumber(value) + ' cm';
        });
        positionLabels();
        inspector.dividerUI();
    }
    function positionLabels() {
        inspector.updateItemBar();
        overlay?.orient();
        const r = resources.cv.getBoundingClientRect();
        updateItemResizeHandles();
        updateMoveIcons();
        const resizeOccupied = [...document.querySelectorAll('.item-resize-handle:not([hidden])')].map(el => {
            const b = el.getBoundingClientRect();
            return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, w: b.width, h: b.height };
        });
        const shapePlaced = [];
        const measurementPanel = document.querySelector('#pop2.show'), leftLimit = dom.width > 900 ? $('#left').getBoundingClientRect().right - r.left + 10 : 6, rightLimit = dom.width > 900 && measurementPanel ? measurementPanel.getBoundingClientRect().left - r.left - 10 : r.width - 6, placed = renderState.labs.filter(l => l.el.matches('.wardrobe-actions,.ground-rotate,.wardrobe-move,.wardrobe-name,.lbl.add')).map(l => {
            const q = l.p.clone();
            if (l.owner) {
                l.owner.localToWorld(q);
            }
            q.project(resources.cam);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height, w: l.el.offsetWidth, h: l.el.offsetHeight };
        }).concat(resizeOccupied);
        // Handles place first and stay on their points; other shape text makes room around them.
        const rank = l => (l.el.classList.contains('shape-handle') ? 2 : 0) + (l.el.classList.contains('reach-dimension') ? 1 : 0);
        renderState.labs.sort((a, b) => rank(b) - rank(a)).forEach(l => {
            renderState.pv.copy(l.p);
            if (l.owner) {
                l.owner.localToWorld(renderState.pv);
            }
            renderState.pv.project(resources.cam);
            // Labels of a wardrobe hidden because it blocks the view are hidden with it.
            const visible = renderState.pv.z < 1 && l.owner?.visible !== false && (!l.el.classList.contains('hover-dim') || l.el.dataset.active === 'true');
            l.el.style.display = visible ? (l.el.classList.contains('wardrobe-actions') ? 'flex' : 'block') : 'none';
            if (!visible) {
                if (l.rulerNode) {
                    l.rulerNode.style.display = 'none';
                }
                return;
            }
            let x = (renderState.pv.x * .5 + .5) * r.width, y = (-renderState.pv.y * .5 + .5) * r.height;
            const ew = l.el.offsetWidth, eh = l.el.offsetHeight;
            if (l.reachFrom) {
                renderState.pv2.copy(l.reachFrom);
                if (l.owner) {
                    l.owner.localToWorld(renderState.pv2);
                }
                renderState.pv2.project(resources.cam);
                const ax = (renderState.pv2.x * .5 + .5) * r.width, ay = (-renderState.pv2.y * .5 + .5) * r.height;
                let dx = x - ax, dy = y - ay;
                const len = Math.hypot(dx, dy);
                if (len < 1) {
                    dx = 1;
                    dy = 0;
                }
                else {
                    dx /= len;
                    dy /= len;
                }
                // Distance along the line direction that moves the label's box fully clear of the line's end point.
                const gap = 8, t = Math.min(Math.abs(dx) > .001 ? (ew / 2 + gap) / Math.abs(dx) : Infinity, Math.abs(dy) > .001 ? (eh / 2 + gap) / Math.abs(dy) : Infinity), bx = x + dx * t, by = y + dy * t, ox = ax - dx * t, oy = ay - dy * t, fits = (cx, c) => cx - ew / 2 >= leftLimit && cx + ew / 2 <= rightLimit;
                if (fits(bx)) {
                    x = bx;
                    y = by;
                }
                else if (fits(ox)) {
                    x = ox;
                    y = oy;
                }
                else {
                    if (dom.width <= 900) {
                        // A close mobile view has no margin for text: keep the guide,
                        // but never clamp its label back over the wardrobe.
                        l.el.style.display = 'none';
                        return;
                    }
                    x = bx;
                    y = by;
                }
                if (dom.width <= 900) {
                    l.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
                    return;
                }
            }
            if (l.ruler) {
                const q = drawScreenRuler(l, r, ew, eh, { left: leftLimit, right: rightLimit, bottom: r.height - 56 });
                x = q.x;
                y = q.y;
            }
            else if (l.el.classList.contains('dim') && !l.el.classList.contains('space-ruler') && !l.el.classList.contains('clearance')) {
                x = Math.max(leftLimit + ew / 2, Math.min(rightLimit - ew / 2, x));
                y = Math.max(eh / 2 + 6, Math.min(r.height - eh / 2 - 56, y));
                for (let n = 0; n < 8 && !l.el.classList.contains('space-ruler') && placed.some(q => Math.abs(x - q.x) < (ew + q.w) / 2 + 4 && Math.abs(y - q.y) < (eh + q.h) / 2 + 3); n++) {
                    y += eh + 5;
                }
                placed.push({ x, y, w: ew, h: eh });
            }
            // Shape text (measurements, guides, coordinates) never sits on another label or a handle.
            if (l.el.classList.contains('shape-handle')) {
                shapePlaced.push({ x, y, w: ew, h: eh, r: 9 });
            }
            else if (['shape-measure', 'shape-guide', 'shape-coord', 'shape-reason'].some(c => l.el.classList.contains(c))) {
                const clear = (cx, cy) => shapePlaced.every(q => Math.abs(cx - q.x) >= (ew + q.w) / 2 + 3 || Math.abs(cy - q.y) >= (eh + q.h) / 2 + 3);
                // Stay beside the line: a label only moves one or two steps along its own side of it,
                // and keeps its place when no free spot is that close.
                const along = l.ruler?.axis === 'height' ? [ew + 4, 0] : l.ruler ? [0, -(eh + 4)] : [0, -(eh + 4)];
                const options = [[0, 0], along, [along[0] * 2, along[1] * 2]];
                const spot = options.map(([dx, dy]) => [x + dx, y + dy]).find(([cx, cy]) => clear(cx, cy) && cx - ew / 2 >= leftLimit && cx + ew / 2 <= rightLimit && cy - eh / 2 >= 6 && cy + eh / 2 <= r.height - 56);
                if (spot) { x = spot[0]; y = spot[1]; }
                shapePlaced.push({ x, y, w: ew, h: eh });
            }
            l.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
        });
    }
    return { assist, redrawStudio, studioPickables: () => studio?.pickables() ?? [], wallGuide: segment => studio?.guide(segment), theme, box, prism, flatShape, label, rulerScreenPlacement, bindRuler, drawScreenRuler, dimensionStroke, garment, build, buildCabinet, dividerClearancePoints, clearanceSegments, createDividerClearances, refreshDividerVisual, holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances, clearPreview, clearSettling, positionLabels, loop, addRotationIndicator, updateMoveIcons, addWardrobeMoveHandles, drawSnapGuides, updateItemResizeHandles };
}
