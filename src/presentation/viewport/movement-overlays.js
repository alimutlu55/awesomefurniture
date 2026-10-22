import * as THREE from "three";
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { fittingDepth } from '../../domain/wardrobe/carcass';
import { measureNumber, unitSuffix } from '../editor/editor-format.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
/** @param {Pick<import('./cabinet-renderer.ports').CreateCabinetRendererPorts, 'dom' | 'renderState' | 'resources' | 'interactionState'>
 *   & { getRenderDesign(): import('../../domain/wardrobe/editor-design').EditorDesign & { sel: number; item: number; divider: number; open: boolean; space?: any } }
 *   & { callbacks: Pick<ReturnType<typeof import('./cabinet-renderer.js').createCabinetRenderer>, 'label' | 'dimensionStroke' | 'bindRuler'> }
 *   & { geometry: ReturnType<typeof createWardrobeGeometry> }} ports */
export function createMovementOverlays({ dom, geometry, callbacks, renderState, resources, interactionState, getRenderDesign }) {
    const { $, document } = dom;
    const boxPool = [];
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vMid = new THREE.Vector3();
    let unitBoxEdges = null, previewMaterials = null;

    function getUnitBoxEdges() {
        if (!unitBoxEdges) {
            const box = new THREE.BoxGeometry(1, 1, 1);
            unitBoxEdges = new THREE.EdgesGeometry(box);
            box.dispose();
        }
        return unitBoxEdges;
    }

    function getPreviewMaterials() {
        if (!previewMaterials) {
            previewMaterials = {
                green: new THREE.LineBasicMaterial({ color: 0x1f9d6b, transparent: true, opacity: 1, depthTest: false }),
                blue: new THREE.LineBasicMaterial({ color: 0x2f5bea, transparent: true, opacity: 0.65, depthTest: false }),
                orange: new THREE.LineBasicMaterial({ color: 0xe5a000, transparent: true, opacity: 0.65, depthTest: false }),
                red: new THREE.LineBasicMaterial({ color: 0xd6383a, transparent: true, opacity: 1, depthTest: false }),
            };
        }
        return previewMaterials;
    }

    function ensurePreviewGroup() {
        if (!renderState.previewGroup) {
            renderState.previewGroup = new THREE.Group();
            renderState.previewGroup.visible = false;
            resources.scene?.add(renderState.previewGroup);
        }
        return renderState.previewGroup;
    }

    function holdOverlay(on) {
        if (on === renderState.overlayHeld) {
            return;
        }
        renderState.overlayHeld = on;
        renderState.selMarks.forEach(m => m.visible = !on);
        document.querySelectorAll('#labels .item-dimension:not(.preview),#labels .clearance:not(.preview)').forEach(el => el.classList.toggle('held', on));
    }

    function setPreviewLabel(key, pos, text, cls) {
        let r = renderState.prevLab[key];
        if (!r || !renderState.labs.includes(r.entry)) {
            if (r) {
                r.el.remove();
            }
            const n = renderState.labs.length, el = callbacks.label(pos.clone(), text, cls);
            if (renderState.labs.length === n) {
                el.remove();
                return;
            }
            el.style.display = 'none';
            r = renderState.prevLab[key] = { el, entry: renderState.labs[renderState.labs.length - 1] };
        }
        else {
            r.entry.p.copy(pos);
        }
        if (r.el.textContent !== text) {
            r.el.textContent = text;
        }
        if (r.el.className !== cls) {
            r.el.className = cls;
        }
    }

    function dropPreviewLabels(keep) {
        for (const k of Object.keys(renderState.prevLab)) {
            if (keep && keep.has(k)) {
                continue;
            }
            const r = renderState.prevLab[k], at = renderState.labs.indexOf(r.entry);
            if (at >= 0) {
                renderState.labs.splice(at, 1);
            }
            r.el.remove();
            r.entry.rulerNode?.remove();
            delete renderState.prevLab[k];
        }
    }

    function updatePreviewOutlines({ plan, it, to, px, py, ws, xL, xR, yB, yT, offsetX, offsetY, itemWidth }) {
        if (!resources?.scene) return;
        const group = ensurePreviewGroup();
        if (renderState.Gr) {
            group.position.copy(renderState.Gr.position);
            group.rotation.copy(renderState.Gr.rotation);
        }
        group.visible = true;
        let boxCount = 0;
        const placeBox = (cx, cy, cz, w, h, d, matKey) => {
            let m = boxPool[boxCount];
            if (!m) {
                m = new THREE.LineSegments(getUnitBoxEdges(), getPreviewMaterials()[matKey]);
                m.renderOrder = 20;
                group.add(m);
                boxPool.push(m);
            } else {
                m.material = getPreviewMaterials()[matKey];
            }
            m.position.set(cx, cy, cz);
            m.scale.set(w, h, d);
            m.visible = true;
            boxCount++;
        };
        const d = getRenderDesign().d;
        if (plan.valid) {
            for (const [iStr, lay] of Object.entries(plan.layouts)) {
                const i = +iStr, old = geometry.computeLayout(i);
                const left = -getRenderDesign().w / 2 + PANEL + ws.slice(0, i).reduce((a, b) => a + b + PANEL, 0);
                lay.forEach((q, j) => {
                    const isTarget = i === plan.to && j === plan.index;
                    const isChanged = !old[j] || Math.abs(old[j].y0 - q.y0) > .01 || Math.abs(old[j].x0 - q.x0) > .01;
                    if (isTarget) {
                        placeBox(left + (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 0, q.w, q.h || q.y1 - q.y0, d + 1, 'green');
                    } else if (isChanged) {
                        placeBox(left + (q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2, 0, q.w, q.h || q.y1 - q.y0, d + 1, plan.swap ? 'orange' : 'blue');
                    }
                });
            }
        } else if (to >= 0) {
            const hw = itemWidth / 2, hh = it.h / 2;
            const cl = (v, a, b) => a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v));
            const posX = cl(px - offsetX, xL + hw, xR - hw);
            const posY = cl(py - offsetY, yB + hh, yT - hh);
            placeBox(posX, posY, d + 3, itemWidth, it.h, d, 'red');
        }
        for (let k = boxCount; k < boxPool.length; k++) {
            boxPool[k].visible = false;
        }
    }

    function drawClearances(plan, it, keep) {
        const ws = geometry.widths(), i = plan.to, q = plan.layouts[i]?.[plan.index];
        if (!q) {
            return;
        }
        const left = -getRenderDesign().w / 2 + PANEL + ws.slice(0, i).reduce((a, b) => a + b + PANEL, 0), bw = ws[i];
        const zf = fittingDepth(getRenderDesign().d).z1 - getRenderDesign().d / 2, f = measureNumber;
        const x0 = left + q.x0, x1 = left + q.x1, midY = (q.y0 + q.y1) / 2;
        const lab = (key, x, y, text, cls = 'lbl dim clearance preview') => {
            keep.add(key);
            vMid.set(x, y, zf);
            setPreviewLabel(key, vMid, text, cls);
            return renderState.prevLab[key];
        }, gap = (key, a, b, cls, axis) => {
            const r = lab(key, (a.x + b.x) / 2, (a.y + b.y) / 2, f(a.distanceTo(b)) + unitSuffix(), cls);
            if (r) callbacks.bindRuler(r.el, a, b, axis);
        }, zero = (key, x, y, cls) => {
            const r = lab(key, x, y, '0' + unitSuffix(), cls);
            if (r) { delete r.entry.ruler; r.entry.rulerNode?.remove(); }
        }, vert = (key, ya, yb, mid) => {
            if (yb - ya > .1) {
                gap(key, new THREE.Vector3(mid, ya, zf), new THREE.Vector3(mid, yb, zf), 'lbl dim clearance net preview', 'height-left');
            }
            else {
                zero(key, mid, ya + (ya >= getRenderDesign().h / 2 ? 6 : -6), 'lbl dim clearance net preview');
            }
        }, side = (key, xa, xb) => {
            if (xb - xa > .1) {
                gap(key, new THREE.Vector3(xa, midY, zf), new THREE.Vector3(xb, midY, zf), 'lbl dim clearance preview', 'width');
            }
            else {
                zero(key, key === 'left' ? xa - 6 : xb + 6, midY, 'lbl dim clearance preview');
            }
        };
        // Net gaps where the fitting would land: to the fitting, board or top really above it and to what it would
        // stand on, never through them and never to the flat outer height (wrong under a sloped top).
        const others = geometry.sectionObstacles(i, plan.layouts[i]).filter((_, k) => k !== plan.index);
        const { above, below } = geometry.gapsAround(i, { x0: q.x0, x1: q.x1, y0: q.y0, y1: q.y1 }, others);
        vert('top', q.y1, above.y, left + above.x);
        vert('bottom', below.y, q.y0, left + below.x);
        if (bw - q.w > .1) {
            side('left', left, x0);
            side('right', x1, left + bw);
        }
        const ruler = (key, a, b, text) => {
            if (a.distanceTo(b) < .05) return;
            keep.add(key);
            vMid.copy(a).add(b).multiplyScalar(.5);
            setPreviewLabel(key, vMid, text, 'lbl dim space-ruler item-dimension preview');
            callbacks.bindRuler(renderState.prevLab[key].el, a, b, key);
        };
        vA.set(x0, q.y0, zf); vB.set(x1, q.y0, zf);
        ruler('width', vA, vB, 'W ' + f(q.w) + unitSuffix());
        vA.set(x1, q.y0, zf); vB.set(x1, q.y1, zf);
        ruler('height', vA, vB, 'H ' + f(it.h) + unitSuffix());
        const fd = fittingDepth(getRenderDesign().d), back = -getRenderDesign().d / 2;
        vA.set(x0, q.y0, back + fd.z0); vB.set(x0, q.y0, back + fd.z1);
        ruler('depth', vA, vB, 'D ' + f(fd.depth) + unitSuffix());
    }

    function clearPreview(hide = true) {
        if (hide) {
            dropPreviewLabels();
        }
        for (let i = 0; i < boxPool.length; i++) {
            boxPool[i].visible = false;
        }
        if (renderState.previewGroup) {
            renderState.previewGroup.visible = false;
        }
        interactionState.previewPlan = null;
        if (hide) {
            $('#move-status').hidden = true;
        }
    }

    function clearSettling() {
        renderState.settling.forEach(a => a.group.position.set(0, 0, 0));
        renderState.settling = [];
    }

    function drawSnapGuides() {
        let layer = document.getElementById('snap-layer');
        if (!layer) {
            layer = document.createElement('div');
            dom.setId(layer, 'snap-layer');
            layer.innerHTML = '<i class="snap-line"></i>';
            $('#item-resize-handles').appendChild(layer);
        }
        const a = interactionState.itemEdgeGesture, gd = a?.guide;
        if (!gd || !renderState.Gr) {
            layer.classList.remove('on');
            return;
        }
        const g = a.g, z = getRenderDesign().d / 2 + 1, r = resources.cv.getBoundingClientRect(), toS = (x, y) => {
            const q = renderState.Gr.localToWorld(new THREE.Vector3(x - getRenderDesign().w / 2, y, z)).project(resources.cam);
            return { x: (q.x * .5 + .5) * r.width, y: (-q.y * .5 + .5) * r.height };
        }, ext = gd.src && gd.kind !== 'size' ? gd.src : null;
        let A, B;
        if (gd.orient === 'v') {
            const ys = [g.y0, g.y1];
            if (ext) {
                ys.push(ext.y0, ext.y1);
            }
            A = toS(gd.pos, Math.max(...ys) + 3);
            B = toS(gd.pos, Math.min(...ys) - 3);
        }
        else {
            const xs = [g.x0, g.x1];
            if (ext) {
                xs.push(ext.bayL + ext.x0, ext.bayL + ext.x1);
            }
            A = toS(Math.min(...xs) - 3, gd.pos);
            B = toS(Math.max(...xs) + 3, gd.pos);
        }
        const len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x), line = /** @type {HTMLElement} */ (layer.firstChild);
        line.style.width = len + 'px';
        line.style.transform = 'translate(' + A.x + 'px,' + A.y + 'px) rotate(' + ang + 'rad)';
        layer.classList.add('on');
    }

    return { holdOverlay, setPreviewLabel, dropPreviewLabels, updatePreviewOutlines, drawClearances, clearPreview, clearSettling, drawSnapGuides };
}
