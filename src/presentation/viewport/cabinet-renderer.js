import * as THREE from "three";
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
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./cabinet-renderer.ports').CreateCabinetRendererPorts} ports */
export function createCabinetRenderer({ dom, camera, interactions, inspector, shell, picking, cameraState, interactionState, renderState, selectionState, shellState, resources, model, commands, settings, lifetime }) {
    const { $, document } = dom;
    let renderDesign = model.activeCabinet().state;
    const geometry = createWardrobeGeometry(() => renderDesign, () => settings.budget);
    const { addRotationIndicator, updateMoveIcons, addWardrobeMoveHandles, updateItemResizeHandles } = createViewportHandles({ dom, geometry, callbacks: { get dimensionStroke() {
                return dimensionStroke;
            }, get drawSnapGuides() {
                return drawSnapGuides;
            } }, model, renderState, interactionState, interactions, shell, inspector, resources, selectionState, getRenderDesign: () => renderDesign });
    const { loop } = createFrameRenderer({ dom, lifetime, renderState, camera, resources, cameraState, interactionState, picking, interactions, shellState, callbacks: { get positionLabels() {
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
        const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        o.position.set(x, y, z);
        o.castShadow = o.receiveShadow = true;
        (g || renderState.Gr).add(o);
        return o;
    }
    function garment(cx, top, z, height, depth, color, front = false) {
        const sh = new THREE.Shape();
        sh.moveTo(-depth * .13, 0);
        sh.lineTo(depth * .13, 0);
        sh.quadraticCurveTo(depth * .25, -3, depth * .43, -7);
        sh.lineTo(depth * .48, -height * .91);
        sh.quadraticCurveTo(0, -height * 1.03, -depth * .48, -height * .95);
        sh.lineTo(-depth * .43, -7);
        sh.quadraticCurveTo(-depth * .25, -3, -depth * .13, 0);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: true, bevelThickness: .35, bevelSize: .6, bevelSegments: 2, steps: 1, curveSegments: 6 }), mesh = new THREE.Mesh(geo, resources.M(color));
        if (!front) {
            mesh.rotation.y = Math.PI / 2;
        }
        mesh.position.set(cx, top, z);
        mesh.castShadow = mesh.receiveShadow = true;
        renderState.Gr.add(mesh);
    }
    function build() {
        const selected = model.activeCabinet();
        renderState.dividerVisuals = [];
        renderState.labs.forEach(l => {
            if (l.el !== renderState.dividerMoveHandle) {
                l.el.remove();
            }
            l.rulerNode?.remove();
        });
        renderState.wardrobeGroups.forEach(g => {
            resources.scene.remove(g);
            disposeCabinetGroup(g, new Set([resources.HM]));
        });
        renderState.wardrobeGroups = [];
        renderState.allHits = [];
        renderState.allItemHits = [];
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
            if (model.scene.wardrobes.length > 1) {
                const owner = renderState.Gr, name = document.createElement('button');
                name.className = 'lbl wardrobe-name';
                name.textContent = wardrobe.name;
                name.onclick = () => inspector.selectCabinet(wardrobe.id);
                $('#labels').appendChild(name);
                combinedLabs.push({ p: new THREE.Vector3(0, renderDesign.h + 24, 0), el: name, owner });
            }
            if (renderState.renderActive) {
                activeRender = { Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups };
            }
        }
        renderDesign = selected.state;
        ({ Gr: renderState.Gr, hits: renderState.hits, outs: renderState.outs, ihits: renderState.ihits, itemGroups: renderState.itemGroups } = activeRender);
        renderState.labs = combinedLabs;
        renderState.pivots = combinedPivots;
        renderState.renderActive = true;
        renderState.moveIcons = [];
        if (selectionState.focusOn || dom.width <= 900) {
            if (!inspector.inside()) {
                addRotationIndicator();
                addWardrobeMoveHandles();
            }
        }
        WardrobePlanner.configure(geometry.plannerConfig());
        inspector.crumbUI();
        resources.contact.visible = false;
        if (renderState.dividerMoveHandle && !renderState.labs.some(l => l.el === renderState.dividerMoveHandle)) {
            renderState.dividerMoveHandle.remove();
        }
        positionLabels();
    }
    const { buildCabinet } = createCabinetLayoutRenderer({ dom, createDividerClearances, renderState, geometry, resources, getRenderDesign: () => renderDesign, box, label, garment, bindRuler, dimensionStroke, inspector, selectionState, interactions, commands, interactionState });
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
        const r = resources.cv.getBoundingClientRect();
        updateItemResizeHandles();
        updateMoveIcons();
        const resizeOccupied = [...document.querySelectorAll('.item-resize-handle:not([hidden])')].map(el => {
            const b = el.getBoundingClientRect();
            return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, w: b.width, h: b.height };
        });
        const measurementPanel = document.querySelector('#pop2.show'), leftLimit = dom.width > 900 ? $('#left').getBoundingClientRect().right - r.left + 10 : 6, rightLimit = dom.width > 900 && measurementPanel ? measurementPanel.getBoundingClientRect().left - r.left - 10 : r.width - 6, placed = renderState.labs.filter(l => l.el.matches('.ground-rotate,.wardrobe-move,.wardrobe-name,.lbl.add')).map(l => {
            if (dom.width <= 900 && !$('#app').classList.contains('props-open') && !$('#app').classList.contains('inspecting') && l.el.matches('.ground-rotate,.wardrobe-move')) {
                const b = l.el.getBoundingClientRect();
                return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, w: b.width, h: b.height };
            }
            const q = l.p.clone();
            if (l.owner) {
                l.owner.localToWorld(q);
            }
            q.project(resources.cam);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height, w: l.el.offsetWidth, h: l.el.offsetHeight };
        }).concat(resizeOccupied);
        renderState.labs.sort((a, b) => Number(b.el.classList.contains('reach-dimension')) - Number(a.el.classList.contains('reach-dimension'))).forEach(l => {
            renderState.pv.copy(l.p);
            if (l.owner) {
                l.owner.localToWorld(renderState.pv);
            }
            renderState.pv.project(resources.cam);
            const visible = renderState.pv.z < 1 && (!l.el.classList.contains('hover-dim') || l.el.dataset.active === 'true');
            l.el.style.display = visible ? 'block' : 'none';
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
                    x = bx;
                    y = by;
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
            l.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
        });
    }
    return { theme, box, label, rulerScreenPlacement, bindRuler, drawScreenRuler, dimensionStroke, garment, build, buildCabinet, dividerClearancePoints, clearanceSegments, createDividerClearances, refreshDividerVisual, holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances, clearPreview, clearSettling, positionLabels, loop, addRotationIndicator, updateMoveIcons, addWardrobeMoveHandles, drawSnapGuides, updateItemResizeHandles };
}
