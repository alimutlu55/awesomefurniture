import * as THREE from "three";
import { createCabinetMaterials } from './cabinet-materials';
import { renderCabinetFrame, boardUnderTop, panelBuilder } from './frame-geometry';
import { resolveShape, isRegularShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { renderCabinetDoors } from './door-renderer';
import { createFittingRenderer } from './fitting-renderer.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { measureNumber } from '../editor/editor-format.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { fittingPanels } from '../../domain/geometry/shared-board-spans';
export function createCabinetLayoutRenderer({ dom, createDividerClearances, renderState, geometry, resources, getRenderDesign, box, prism, flatShape, shapeInspector, label, garment, bindRuler, dimensionStroke, inspector, selectionState, interactions, commands, interactionState }) {
    const { $, document } = dom;
    /** Break-point handles are pooled: rebuilding during a drag reuses the
     * captured element instead of replacing it. */
    const shapeHandlePool = [];
    function shapeHandle(n) {
        let el = shapeHandlePool[n];
        if (!el) {
            el = document.createElement('button');
            el.type = 'button';
            el.className = 'lbl shape-handle';
            el.onpointerdown = e => shapeInspector.beginHandleDrag(e, +el.dataset.index, el);
            el.onpointermove = e => shapeInspector.moveHandleDrag(e);
            el.onpointerup = () => shapeInspector.endHandleDrag();
            el.onpointercancel = () => shapeInspector.endHandleDrag(true);
            el.onkeydown = e => {
                const step = e.shiftKey ? .5 : 1, dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0, dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                if (dx || dy) {
                    e.preventDefault();
                    shapeInspector.nudge(+el.dataset.index, el.classList.contains('fixed-x') ? 0 : dx, dy);
                }
            };
            shapeHandlePool[n] = el;
        }
        return el;
    }
    function placeShapeHandles() {
        if (!renderState.renderActive) {
            return;
        }
        const handles = !inspector.inside() ? shapeInspector.handles() : [], d = getRenderDesign().d;
        handles.forEach((q, n) => {
            const el = shapeHandle(n);
            el.dataset.index = String(q.index);
            el.textContent = q.label;
            el.classList.toggle('fixed-x', !q.movesX);
            el.setAttribute('aria-label', 'Break point ' + (q.index + 1) + ', ' + q.label + ' cm high. Drag or use arrow keys to ' + (q.movesX ? 'move it' : 'change the height'));
            el.title = q.movesX ? 'Drag to move this break point' : 'Drag up or down to change this side height';
            if (!el.isConnected) $('#labels').appendChild(el);
            renderState.labs.push({ p: new THREE.Vector3(q.x, q.y, d / 2 + 2), el, owner: renderState.Gr });
        });
        shapeHandlePool.slice(handles.length).forEach(el => el.remove());
    }
    function buildCabinet() {
        renderState.buildStamp++;
        WardrobePlanner.configure(geometry.plannerConfig());
        $('#pill-menu').hidden = true;
        renderState.labs = [];
        renderState.hits = [];
        renderState.pivots = [];
        renderState.outs = [];
        renderState.ihits = [];
        renderState.itemGroups = [];
        renderState.settling = [];
        renderState.Gr = new THREE.Group();
        resources.scene.add(renderState.Gr);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(getRenderDesign().w * 1.45, getRenderDesign().d * 2.7), resources.contact.material.clone());
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = .12 - (renderState.renderCabinet.y || 0);
        shadow.userData.floorShadow = true;
        renderState.Gr.add(shadow);
        const { w, h, d, n } = getRenderDesign(), materials = createCabinetMaterials(resources, getRenderDesign().fin), { panel: mp, back: md, hardware: mh } = materials, ws = geometry.widths(), iy = PLINTH + PANEL, V = THREE.Vector3, panel = panelBuilder(box, prism), shaped = !isRegularShape(getRenderDesign().shape);
        renderState.Gr.userData.ownedMaterials = materials.owned;
        renderCabinetFrame(getRenderDesign(), box, prism, materials);
        /** Section-local outline of a span under the top, in cabinet-centred coordinates. */
        const sectionOutline = (i, sx, x0, x1, y0 = 0) => [{ x: sx + x0, y: iy + y0 }, { x: sx + x1, y: iy + y0 }, ...geometry.ceilingOutline(i, x0, x1).reverse().map(p => ({ x: sx + p.x, y: iy + p.y }))];
        const lp = [], spaceRulerPoints = [], dimLine = (a, b, txt, cls = 'lbl dim', points = lp) => {
            points.push(a, b);
            const vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x), tick = new V(vertical ? 2 : 0, vertical ? 0 : 2, 0);
            for (const p of [a, b]) {
                points.push(p.clone().sub(tick), p.clone().add(tick));
            }
            if (txt) {
                label(a.clone().add(b).multiplyScalar(.5), txt, cls);
            }
        };
        const { mod } = createFittingRenderer({ resources, mp, md, geometry, h, box, d, mh, group: renderState.Gr, getRenderDesign, garment });
        const itemDims = (i, j) => {
            const g = geometry.itemMeasurements(i, j);
            if (!g) {
                return;
            }
            renderState.selMarks = [];
            const zf = d / 2 + 4, Pt = (x, y, z = zf) => new V(-w / 2 + x, y, z), mid = (g.x0 + g.x1) / 2, f = measureNumber;
            // Individual size rulers use the same fine lines as selected free spaces.
            const ruler = (a, b, text, axis) => {
                const el = label(a.clone().add(b).multiplyScalar(.5), text, 'lbl dim space-ruler item-dimension');
                bindRuler(el, a, b, axis);
            };
            ruler(Pt(g.x0, g.y0), Pt(g.x1, g.y0), 'W ' + f(g.w) + ' cm', 'width');
            ruler(Pt(g.x1, g.y0), Pt(g.x1, g.y1), 'H ' + f(g.h) + ' cm', 'height');
            ruler(Pt(g.x0, g.y0, -d / 2 + .5), Pt(g.x0, g.y0, d / 2 - 1.5), 'D ' + f(g.dep) + ' cm', 'depth');
            // Selected item and clearances use the same fine strokes as the wardrobe rulers.
            const fz = d / 2 + .6, A = Pt(g.x0, g.y0, fz), B = Pt(g.x1, g.y0, fz), C = Pt(g.x1, g.y1, fz), D = Pt(g.x0, g.y1, fz);
            renderState.selMarks.push(dimensionStroke([A, B, B, C, C, D, D, A], renderState.Gr, 14));
            const clear = (y0, y1, txt, side) => {
                let el;
                if (y1 - y0 > .1) {
                    const a = Pt(mid, y0), b = Pt(mid, y1), tick = new V(2, 0, 0);
                    renderState.selMarks.push(dimensionStroke([a, b, a.clone().sub(tick), a.clone().add(tick), b.clone().sub(tick), b.clone().add(tick)]));
                    el = label(Pt(mid, (y0 + y1) / 2), txt + ' cm', 'lbl dim clearance');
                }
                else {
                    el = label(Pt(mid, y0 + (y0 >= h / 2 ? 6 : -6)), '0 cm', 'lbl dim clearance');
                }
                inspector.editableItemClearance(el, i, j, side);
            };
            clear(g.y1, g.y1 + g.top, f(g.top), 'top');
            clear(PLINTH + PANEL, g.y0, f(g.bottom), 'bottom');
        };
        let x = -w / 2 + PANEL;
        ws.forEach((sw, i) => {
            const cx = x + sw / 2, sel = renderState.renderActive && selectionState.focusOn && inspector.inside() && i === getRenderDesign().sel, H = geometry.ih(i), outline = sectionOutline(i, x, 0, sw);
            const aoMaterial = new THREE.MeshBasicMaterial({ map: resources.aoTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
            const ao = shaped ? flatShape(outline, aoMaterial) : new THREE.Mesh(new THREE.PlaneGeometry(sw, H), aoMaterial);
            if (shaped) ao.position.z = -d / 2 + .9;
            else ao.position.set(cx, iy + H / 2, -d / 2 + .9);
            renderState.Gr.add(ao);
            let hb;
            if (shaped) {
                hb = prism(outline, d, 0, resources.HM);
                hb.castShadow = hb.receiveShadow = false;
            }
            else {
                hb = new THREE.Mesh(new THREE.BoxGeometry(sw, H, d), resources.HM);
                hb.position.set(cx, iy + H / 2, 0);
                renderState.Gr.add(hb);
            }
            hb.userData.i = i;
            renderState.hits.push(hb);
            const ho = shaped ? flatShape(sectionOutline(i, x, .25, sw - .25, .25), new THREE.MeshBasicMaterial({ color: 0xfff3d9, transparent: true, opacity: .045, depthWrite: false })) : resources.softArea(sw - .5, H - .5, .15, .045);
            if (shaped) ho.position.z = d / 2 + .1;
            else ho.position.set(cx, iy + H / 2, d / 2 + .1);
            ho.visible = false;
            ho.renderOrder = 9;
            renderState.Gr.add(ho);
            renderState.outs[i] = ho;
            const lay = geometry.computeLayout(i);
            const sharedBoards = geometry.sectionDividers(i).filter(q=>q.orientation==='horizontal').map(q=>{
                const r=geometry.dividerRect(q);
                return {...r,y0:r.y0+iy,y1:r.y1+iy};
            });
            const panels = fittingPanels(lay, iy, (x0, x1) => iy + geometry.ceilingTop(i, x0, x1), sharedBoards);
            getRenderDesign().secs[i].forEach((it, j) => {
                const hh = it.h, isel = sel && getRenderDesign().item === j, pos = lay[j] || { y0: iy, w: WardrobePlanner.itemWidth(it, sw), off: undefined };
                const iwd = pos.w, iy0 = pos.y0, ix = cx - sw / 2 + (pos.off !== undefined ? pos.off : (sw - iwd) / 2) + iwd / 2, start = renderState.Gr.children.length;
                const localX = ix - x - iwd / 2;
                const local = span => ({...span,x0:span.x0-localX,x1:span.x1-localX});
                mod(it, ix, iy0, iwd, geometry.boxSupported(i, j, lay, iy), geometry.boxCapped(i, j, lay), panels[j].top.map(local), panels[j].bottom.map(local), panels[j].support.map(local), pos.x0 === undefined ? undefined : iy + geometry.ceilingTop(i, pos.x0, pos.x1));
                const group = new THREE.Group(), parts = renderState.Gr.children.slice(start);
                parts.forEach(o => group.add(o));
                renderState.Gr.add(group);
                renderState.itemGroups.push({ it, i, j, group, x: ix, y: iy0 });
                const im = new THREE.Mesh(new THREE.BoxGeometry(iwd, hh, d), resources.HM);
                im.position.set(ix, iy0 + hh / 2, 0);
                im.userData = { i, j };
                renderState.Gr.add(im);
                renderState.ihits.push(im);
                const io = resources.softArea(iwd - .4, hh - .4, .15, isel ? .22 : .04);
                io.position.set(ix, iy0 + hh / 2, d / 2 + .2);
                io.visible = isel;
                io.userData.s = isel;
                io.renderOrder = 13;
                renderState.Gr.add(io);
                im.userData.o = io;
                if (isel) {
                    itemDims(i, j);
                }
            });
            geometry.sectionDividers(i).forEach(q => {
                const j = getRenderDesign().dividers.indexOf(q), r = geometry.dividerRect(q), cx = x + (r.x0 + r.x1) / 2, cy = iy + (r.y0 + r.y1) / 2, panel = box(r.x1 - r.x0, r.y1 - r.y0, d - 2, cx, cy, -.5, mp), hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(5, r.x1 - r.x0), Math.max(5, r.y1 - r.y0), d), resources.HM);
                hit.position.set(cx, cy, 0);
                hit.userData = { i, divider: j };
                renderState.Gr.add(hit);
                renderState.ihits.push(hit);
                if (renderState.renderActive && selectionState.focusOn && getRenderDesign().divider === j) {
                    const front = d / 2 + 4, a = new V(x + r.x0, iy + r.y0, front), b = new V(x + r.x1, iy + r.y1, front), outline = dimensionStroke([a, new V(b.x, a.y, front), new V(b.x, a.y, front), b, b, new V(a.x, b.y, front), new V(a.x, b.y, front), a]);
                    const hor = q.orientation === 'horizontal', ra = hor ? new V(x + r.x0, iy + r.y0, front) : new V(x + r.x1, iy + r.y0, front), rb = hor ? new V(x + r.x1, iy + r.y0, front) : new V(x + r.x1, iy + r.y1, front), el = label(ra.clone().add(rb).multiplyScalar(.5), (hor ? 'W ' : 'H ') + measureNumber(hor ? r.x1 - r.x0 : r.y1 - r.y0) + ' cm', 'lbl dim space-ruler item-dimension');
                    bindRuler(el, ra, rb, hor ? 'width' : 'height');
                    const sizeEntry = renderState.labs[renderState.labs.length - 1], da = new V(x + r.x0, iy + r.y0, -d / 2 + .5), db = new V(x + r.x0, iy + r.y0, d / 2 - 1.5), depthLabel = label(da.clone().add(db).multiplyScalar(.5), 'D ' + measureNumber(d - 2) + ' cm', 'lbl dim space-ruler item-dimension');
                    bindRuler(depthLabel, da, db, 'depth');
                    const depthEntry = renderState.labs[renderState.labs.length - 1], handle = renderState.dividerMoveHandle || (renderState.dividerMoveHandle = document.createElement('button'));
                    handle.type = 'button';
                    handle.className = 'lbl wardrobe-move';
                    handle.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="' + (hor ? 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4' : 'M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4') + '"/></svg>';
                    handle.setAttribute('aria-label', hor ? 'Move shelf up or down' : 'Move divider left or right');
                    handle.onpointerdown = e => {
                        e.preventDefault();
                        e.stopPropagation();
                        interactions.beginDividerDrag(e, j, handle);
                    };
                    handle.onkeydown = e => {
                        const step = e.shiftKey ? .5 : 1, dir = hor ? (e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0) : (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
                        if (dir) {
                            e.preventDefault();
                            commands.run(() => commands.moveDividerTo(j, (hor ? q.y : q.x) + dir * step));
                        }
                    };
                    $('#labels').appendChild(handle);
                    renderState.labs.push({ p: new V(hor ? x + r.x1 : cx, cy, front), el: handle, owner: renderState.Gr });
                    const handleEntry = renderState.labs[renderState.labs.length - 1], clearances = createDividerClearances(j, x);
                    renderState.dividerVisuals[j] = { panel, hit, outline, sizeEntry, depthEntry, handleEntry, clearances, baseX: x };
                }
            });
            if (sel && getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0)) {
                const space = geometry.sectionSpaceMeasurements(i), sx = x + space.x0, ex = x + space.x1, zf = d / 2 + 3, cls = 'lbl dim space-ruler';
                dimLine(new V(sx, space.y0 + 3, zf), new V(ex, space.y0 + 3, zf), measureNumber(space.w) + ' cm', cls, spaceRulerPoints);
                dimLine(new V(ex - 4, space.y0, zf), new V(ex - 4, space.y1, zf), measureNumber(space.h) + ' cm', cls, spaceRulerPoints);
                dimLine(new V(sx + 5, space.y0 + 5, -d / 2 + .5), new V(sx + 5, space.y0 + 5, d / 2 - 1.5), measureNumber(space.dep) + ' cm', cls, spaceRulerPoints);
            }
            else if (!sel && getRenderDesign().item < 0) {
                ho.userData.label = label(new V(cx, iy + H + PANEL + 8, d / 2), sw.toFixed(1) + ' cm', 'lbl dim hover-dim');
            }
            if (selectionState.pillOn && sel && getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0) && !interactionState.moveMode && geometry.sectionSpaceMeasurements(i).h >= 15) {
                const ab = document.createElement('button');
                ab.type = 'button';
                ab.className = 'lbl add compact';
                ab.innerHTML = '<span class="add-plus">+</span>Add item<small>Shelf · Rail · Drawer</small>';
                ab.setAttribute('aria-label', 'Add item to section ' + (i + 1));
                let pressed = false;
                ab.onpointerdown = () => { pressed = true; };
                ab.onclick = ev => {
                    ev.stopPropagation();
                    // A selection release can create this button beneath the finger.
                    // Only accept a pointer click that actually began on this button.
                    if (dom.width <= 900 && ev.isTrusted && ev.detail > 0 && !pressed) return;
                    pressed = false;
                    inspector.openPillMenu(ab);
                };
                $('#labels').appendChild(ab);
                const space = geometry.sectionSpaceMeasurements(i);
                renderState.labs.push({ p: new V(x + (space.x0 + space.x1) / 2, (space.y0 + space.y1) / 2, d / 2), el: ab, owner: renderState.Gr });
            }
            if (sel && getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0)) {
                const space = geometry.sectionSpaceMeasurements(i);
                let glow;
                if (space.sloped) {
                    // A space under a slope glows only where it is actually clear.
                    const y0 = space.y0 - iy + .4, top = geometry.ceilingOutline(i, space.x0 + .4, space.x1 - .4).map(p => ({ x: x + p.x, y: iy + Math.min(p.y, space.y1 - iy) - .4 })).reverse();
                    glow = flatShape([{ x: x + space.x0 + .4, y: iy + y0 }, { x: x + space.x1 - .4, y: iy + y0 }, ...top], new THREE.MeshBasicMaterial({ color: 0xfff3d9, transparent: true, opacity: .075, depthWrite: false }));
                    glow.position.z = d / 2 + .15;
                }
                else {
                    glow = resources.softArea(Math.max(.1, space.w - .8), Math.max(.1, space.h - .8), .1, .075);
                    glow.position.set(x + (space.x0 + space.x1) / 2, (space.y0 + space.y1) / 2, d / 2 + .15);
                }
                renderState.Gr.add(glow);
            }
            x += sw;
            if (i < n - 1) {
                // Partitions run from the base board up to the top's underside.
                panel(boardUnderTop(getRenderDesign(), x + w / 2, x + w / 2 + PANEL, iy), d - 1, 0, mp);
                x += PANEL;
            }
        });
        if (renderState.renderActive && ((selectionState.showDimensions && getRenderDesign().item < 0 && !inspector.inside()) || selectionState.editingSize)) {
            dimLine(new V(-w / 2, -4, d / 2 + 8), new V(w / 2, -4, d / 2 + 8), 'W ' + w + ' cm');
            const top = resolveShape(getRenderDesign()).top, left = top[0].y, right = top[top.length - 1].y, f = measureNumber;
            dimLine(new V(-w / 2 - 9, 0, d / 2 + 2), new V(-w / 2 - 9, left, d / 2 + 2), 'H ' + f(left) + ' cm');
            if (Math.abs(right - left) > .05) {
                dimLine(new V(w / 2 + 9, 0, d / 2 + 2), new V(w / 2 + 9, right, d / 2 + 2), 'H ' + f(right) + ' cm');
            }
            // The wardrobe depth remains available on the model alongside width and height.
            dimLine(new V(w / 2 + 9, 0, -d / 2), new V(w / 2 + 9, 0, d / 2), 'D ' + d + ' cm');
        }
        if (renderState.renderActive && (getRenderDesign().reachLine ?? getRenderDesign().profile.engaged)) {
            const reachGeo = new THREE.BufferGeometry().setFromPoints([new V(-w / 2 - 5, getRenderDesign().profile.reach, d / 2 + 5), new V(w / 2 + 5, getRenderDesign().profile.reach, d / 2 + 5)]), reachLine = new THREE.Line(reachGeo, new THREE.LineDashedMaterial({ color: new THREE.Color(dom.width <= 900 ? '#75664f' : '#8d7d65').convertSRGBToLinear(), toneMapped: false, dashSize: 3, gapSize: dom.width <= 900 ? 2 : 3, transparent: true, opacity: dom.width <= 900 ? .9 : .7, depthTest: false }));
            reachLine.computeLineDistances();
            reachLine.renderOrder = 15;
            renderState.Gr.add(reachLine);
            label(new V(w / 2 + 5, getRenderDesign().profile.reach, d / 2 + 5), 'Reach ' + measureNumber(getRenderDesign().profile.reach) + ' cm', 'lbl dim reach-dimension');
            renderState.labs[renderState.labs.length - 1].reachFrom = new V(-w / 2 - 5, getRenderDesign().profile.reach, d / 2 + 5);
        }
        const lg = new THREE.BufferGeometry().setFromPoints(lp), ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color('#8d7d65').convertSRGBToLinear(), toneMapped: false, transparent: true, opacity: .65, depthTest: false }));
        ls.renderOrder = 10;
        renderState.Gr.add(ls);
        if (spaceRulerPoints.length) {
            dimensionStroke(spaceRulerPoints, renderState.Gr, 11);
        }
        renderState.pivots = renderCabinetDoors(getRenderDesign(), ws, renderState.Gr, box, prism, resources, mp, mh);
        placeShapeHandles();
        renderState.Gr.updateMatrixWorld(true);
    }
    return { buildCabinet };
}
