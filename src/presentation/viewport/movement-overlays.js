import * as THREE from "three";
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { fittingDepth } from '../../domain/wardrobe/carcass';
import { measureNumber, unitSuffix } from '../editor/editor-format.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
/** @param {Pick<import('./cabinet-renderer.ports').CreateCabinetRendererPorts, 'dom' | 'renderState' | 'resources' | 'interactionState'> & { getRenderDesign(): import('../../domain/wardrobe/editor-design').EditorDesign & { sel: number; item: number; divider: number; open: boolean; space?: any } } & { callbacks: Pick<ReturnType<typeof import('./cabinet-renderer.js').createCabinetRenderer>, 'label' | 'dimensionStroke' | 'bindRuler'> } & { geometry: ReturnType<typeof createWardrobeGeometry> }} ports */
export function createMovementOverlays({ dom, geometry, callbacks, renderState, resources, interactionState, getRenderDesign }) {
    const { $, document } = dom;
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
    function drawClearances(plan, it, keep) {
        const ws = geometry.widths(), i = plan.to, q = plan.layouts[i]?.[plan.index];
        if (!q) {
            return;
        }
        const left = -getRenderDesign().w / 2 + PANEL + ws.slice(0, i).reduce((a, b) => a + b + PANEL, 0), bw = ws[i], zf = getRenderDesign().d / 2 + 4, f = measureNumber, x0 = left + q.x0, x1 = left + q.x1, midY = (q.y0 + q.y1) / 2, bar = (w, h, x, y) => {
            const horizontal = w > h;
            callbacks.dimensionStroke([new THREE.Vector3(x - (horizontal ? w / 2 : 0), y - (horizontal ? 0 : h / 2), zf), new THREE.Vector3(x + (horizontal ? w / 2 : 0), y + (horizontal ? 0 : h / 2), zf)], renderState.previewGroup, 22);
        }, lab = (key, x, y, text, cls = 'lbl dim clearance preview') => {
            keep.add(key);
            setPreviewLabel(key, new THREE.Vector3(x, y, zf), text, cls);
        }, vert = (key, ya, yb, mid) => {
            if (yb - ya > .1) {
                bar(.6, yb - ya, mid, (ya + yb) / 2);
                bar(5, .6, mid, ya);
                bar(5, .6, mid, yb);
                lab(key, mid, (ya + yb) / 2, f(yb - ya) + unitSuffix(), 'lbl dim clearance net preview');
            }
            else {
                lab(key, mid, ya + (ya >= getRenderDesign().h / 2 ? 6 : -6), '0' + unitSuffix(), 'lbl dim clearance net preview');
            }
        }, side = (key, xa, xb) => {
            if (xb - xa > .1) {
                bar(xb - xa, .6, (xa + xb) / 2, midY);
                bar(.6, 5, xa, midY);
                bar(.6, 5, xb, midY);
                lab(key, (xa + xb) / 2, midY, f(xb - xa) + unitSuffix());
            }
            else {
                lab(key, key === 'left' ? xa - 6 : xb + 6, midY, '0' + unitSuffix());
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
            keep.add(key);
            setPreviewLabel(key, a.clone().add(b).multiplyScalar(.5), text, 'lbl dim space-ruler item-dimension preview');
            callbacks.bindRuler(renderState.prevLab[key].el, a, b, key);
        };
        ruler('width', new THREE.Vector3(x0, q.y0, zf), new THREE.Vector3(x1, q.y0, zf), 'W ' + f(q.w) + unitSuffix());
        ruler('height', new THREE.Vector3(x1, q.y0, zf), new THREE.Vector3(x1, q.y1, zf), 'H ' + f(it.h) + unitSuffix());
        const fd = fittingDepth(getRenderDesign().d), back = -getRenderDesign().d / 2;
        ruler('depth', new THREE.Vector3(x0, q.y0, back + fd.z0), new THREE.Vector3(x0, q.y0, back + fd.z1), 'D ' + f(fd.depth) + unitSuffix());
    }
    function clearPreview(hide = true) {
        if (hide) {
            dropPreviewLabels();
        }
        if (renderState.previewGroup) {
            resources.scene.remove(renderState.previewGroup);
            renderState.previewGroup.traverse(o => {
                o.geometry?.dispose();
                o.material?.dispose();
            });
            renderState.previewGroup = null;
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
    return { holdOverlay, setPreviewLabel, dropPreviewLabels, drawClearances, clearPreview, clearSettling, drawSnapGuides };
}
