import { roofDividerMesh } from './roof-divider-mesh';
import { MIN_CABINET_DEPTH } from '../../domain/wardrobe/cabinet-limits';
import * as THREE from "three";
import { sceneMeasurementBadge } from '../editor/scene-measurement-badge';
import { createShapeHandleButtons } from './shape-handle-buttons';
import { createCabinetMaterials } from './cabinet-materials';
import { renderCabinetFrame, renderUpright, panelBuilder } from './frame-geometry';
import { resolveShape, isRegularShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { renderCabinetDoors } from './door-renderer';
import { createFittingRenderer } from './fitting-renderer.js';
import { PANEL, PLINTH } from '../../domain/wardrobe/catalog.js';
import { fittingDepth, interiorFloorOf, partitionDepth, plinthOf } from '../../domain/wardrobe/carcass';
import { measureNumber, unitSuffix } from '../editor/editor-format.js';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { fittingPanels } from '../../domain/geometry/shared-board-spans';
import { createItemDimensions } from './item-dimensions.js';
import { isKitchen } from '../../domain/furniture/furniture';
import { kitchenUnit as kitchenUnitDef } from '../../domain/kitchen/kitchen-units';
import { drawKitchenFixture } from './kitchen-fixture-renderer';
export function createCabinetLayoutRenderer({ maxReach = () => undefined, dom, createDividerClearances, renderState, geometry, resources, getRenderDesign, box, prism, flatShape, shapeInspector, picking, label, garment, handbag, trouserPullOut, bindRuler, dimensionStroke, inspector, selectionState, interactions, commands, interactionState }) {
    const drawItemDims = createItemDimensions({ geometry, renderState, interactionState, inspector, label, bindRuler, dimensionStroke });
    const { $, document } = dom;
    const { shapeHandle, splitHandle, shapeHandlePool, splitPool } = createShapeHandleButtons({ document, shapeInspector });
    /** Takes a handle off the model. A focused one is blurred first: its blur handler rebuilds the model, which may
     * already have removed it. */
    const dropHandle = el => {
        if (el.getRootNode?.().activeElement === el) el.blur();
        if (el.isConnected !== false) el.remove();
    };
    /** Handles belong to an explicit shape session. */
    const shapeSheetOpen = () => !!selectionState.shapeEditing;
    function placeShapeHandles() {
        if (!renderState.renderActive) {
            return;
        }
        const editing = getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0) && shapeSheetOpen(), handles = editing ? shapeInspector.handles() : [], splits = editing ? shapeInspector.splitMarkers() : [], d = getRenderDesign().d;
        splits.forEach((q, n) => {
            const el = splitHandle(n);
            el.dataset.index = String(q.index);
            el.dataset.side = q.side;
            el.title = 'Drag along the top to choose where; tap to add a point';
            el.setAttribute('aria-label', 'Add a wardrobe shape point here. Drag along the edge to choose where; tap to divide');
            if (!el.isConnected) $('#labels').appendChild(el);
            renderState.labs.push({ p: new THREE.Vector3(q.x, q.y, q.z ?? d / 2 + 2), el, owner: renderState.Gr });
        });
        splitPool.slice(splits.length).forEach(dropHandle);
        if (editing) {
            // Tolerance is in screen pixels: convert with the current zoom.
            const near = renderState.Gr.localToWorld(new THREE.Vector3(0, 100, d / 2 + 3)), far = renderState.Gr.localToWorld(new THREE.Vector3(10, 100, d / 2 + 3));
            const A = picking.screenPoint(near), B = picking.screenPoint(far);
            shapeInspector.setScale(Math.hypot(B.x - A.x, B.y - A.y) / 10);
            const w = getRenderDesign().w, h = getRenderDesign().h, z = (shapeInspector.profileSide() === 'rear' ? -1 : 1) * (d / 2 + 4);
            const pv = shapeInspector.pivot();
            if (pv) {
                label(new THREE.Vector3(pv.x, pv.y, z), '', 'lbl pivot-dot');
            }
            const why = shapeInspector.dragReason();
            if (why) {
                // Say why the point stopped short of the pointer, beside the point.
                label(new THREE.Vector3(why.x, why.y + 12, z), why.text, 'lbl shape-reason');
            }
            for (const q of shapeInspector.dragRulers()) {
                const a = new THREE.Vector3(q.a.x, q.a.y, z), b = new THREE.Vector3(q.b.x, q.b.y, z);
                const el = label(a.clone().add(b).multiplyScalar(.5), q.text, 'lbl dim space-ruler item-dimension shape-coord');
                bindRuler(el, a, b, q.axis);
            }
            for (const g of shapeInspector.guides()) {
                // A guide across the model: horizontal for a shared height, vertical for a shared position.
                const pts = g.orient === 'h'
                    ? [new THREE.Vector3(-w / 2, g.pos, z), new THREE.Vector3(w / 2, g.pos, z)]
                    : [new THREE.Vector3(g.pos - w / 2, 0, z), new THREE.Vector3(g.pos - w / 2, h, z)];
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: new THREE.Color('#5f9f78').convertSRGBToLinear(), toneMapped: false, dashSize: 4, gapSize: 3, transparent: true, opacity: .9, depthTest: false }));
                line.computeLineDistances();
                line.renderOrder = 16;
                renderState.Gr.add(line);

            }
            // While a point is dragged only its own rulers and guides show, so nothing competes for space.
            // While a point is dragged, its own panels show live length and angle; otherwise every panel shows.

            for (const q of shapeInspector.dragging() ? shapeInspector.dragMeasures() : shapeInspector.focusMeasures(true)) {
                const a = new THREE.Vector3(q.a.x, q.a.y, z), b = new THREE.Vector3(q.b.x, q.b.y, z);
                const el = label(a.clone().add(b).multiplyScalar(.5), q.text, 'lbl dim space-ruler item-dimension shape-measure');
                bindRuler(el, a, b, q.axis);
            }
        }
        handles.forEach((q, n) => {
            const el = shapeHandle(n);
            el.dataset.index = String(q.index);
            el.dataset.side = q.side;
            el.classList.toggle('rear', q.side === 'rear');
            // The handle is a plain dot; its position is read from the live rulers while dragging.
            el.textContent = '';
            el.classList.toggle('fixed-x', !q.movesX);
            el.setAttribute('aria-label', (q.side === 'rear' ? 'Rear break point ' : 'Break point ') + (q.index + 1) + ', ' + q.label + unitSuffix() + ' high. Drag or use arrow keys to move it');
            el.title = 'Drag up/down for height; left/right to ' + (q.index === 0 || q.index === handles.length / 2 - 1 ? 'change width' : 'move the break point');
            if (!el.isConnected) $('#labels').appendChild(el);
            renderState.labs.push({ p: new THREE.Vector3(q.x, q.y, q.z ?? d / 2 + 2), el, owner: renderState.Gr });
        });
        shapeHandlePool.slice(handles.length).forEach(dropHandle);
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
        // A sink or hob placed on its own is just the fixture: no carcass, sections or shadow.
        const owned = [], focused = renderState.renderActive && selectionState.focusOn;
        const own = isKitchen(getRenderDesign()) && kitchenUnitDef(getRenderDesign().unit).fixture === 'shelf' ? createCabinetMaterials(resources, getRenderDesign()) : null;
        if (own) owned.push(...own.owned);
        const measure = focused ? { format: v => measureNumber(v) + unitSuffix(), label: (p, text, cls) => label(p, text, cls), stroke: dimensionStroke } : null;
        if (drawKitchenFixture({ group: renderState.Gr, design: getRenderDesign(), hitMaterial: resources.HM, panel: own?.panel, M: resources.M, owned, hits: renderState.hits, measure })) {
            renderState.Gr.userData.ownedMaterials = owned;
            renderState.Gr.updateMatrixWorld(true);
            return;
        }
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(getRenderDesign().w * 1.45, getRenderDesign().d * 2.7), resources.contact.material.clone());
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = .12 - (renderState.renderCabinet.y || 0);
        shadow.userData.floorShadow = true;
        renderState.Gr.add(shadow);
        const { w, h, d, n } = getRenderDesign(), fd = fittingDepth(d), pd = partitionDepth(d), materials = createCabinetMaterials(resources, getRenderDesign()), { panel: mp, back: md, hardware: mh } = materials, ws = geometry.widths(), iy = interiorFloorOf(getRenderDesign()), V = THREE.Vector3, panel = panelBuilder(box, prism), shaped = !isRegularShape(getRenderDesign().shape);
        const mf = materials.front, ma = materials.accessory;
        renderState.Gr.userData.ownedMaterials = materials.owned;
        // A kitchen unit stands on its run's plinth (wall units hang with a light rail under them).
        const kitchenUnit = isKitchen(getRenderDesign()) ? kitchenUnitDef(getRenderDesign().unit) : null;
        // A wall unit has a solid bottom down to its lower edge.
        renderCabinetFrame(getRenderDesign(), box, prism, materials, kitchenUnit ? { sidesFrom: kitchenUnit.plinth ? PLINTH : 0, plinth: false, base: plinthOf(getRenderDesign()) } : {});
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
        const { mod } = createFittingRenderer({ resources, mp, md, mf, ma, geometry, h, box, d, mh, group: renderState.Gr, getRenderDesign, garment, handbag, trouserPullOut });
        const itemDims = (i, j) => drawItemDims(i, j, w, d, h, maxReach());
        let x = -w / 2 + PANEL, noFreeSpace = false;
        ws.forEach((sw, i) => {
            // While the skeleton is edited on a phone, the model shows only the panels and their handles.
            const shapeFocus = shapeSheetOpen();
            const selected = !shapeFocus && renderState.renderActive && selectionState.focusOn && i === getRenderDesign().sel;
            const cx = x + sw / 2, sel = selected && inspector.inside(), H = geometry.ih(i), outline = sectionOutline(i, x, 0, sw);
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
            const panels = fittingPanels(lay.map((q, j) => ({ ...q, k: getRenderDesign().secs[i][j].k })), iy, (x0, x1) => iy + geometry.ceilingTop(i, x0, x1), sharedBoards);
            /** Boxes cut to the top: front outline clipped, depth kept. Cabinet-centred x. */
            const slabIn = (bx, w0, h0, dep, cx0, cy0, z, m, g) => {
                let last = null;
                for (const poly of geometry.cutOutline(i, cx0 - w0 / 2 - bx, cx0 + w0 / 2 - bx, cy0 - h0 / 2, cy0 + h0 / 2)) {
                    last = panel(poly.map(p => ({ x: p.x + bx, y: p.y })), dep, z, m, g);
                }
                return last;
            };
            const cutFor = (fit, ix0) => fit?.cut ? {
                core: { x0: fit.core.x0 - ix0, x1: fit.core.x1 - ix0, h: fit.core.y1 - fit.core.y0 },
                slab: (w0, h0, dep, cx0, cy0, z, m, g) => slabIn(x, w0, h0, dep, cx0, cy0, z, m, g),
                clearAt: (a, b) => iy + geometry.ceilingIn(i, a - x, b - x),
            } : undefined;
            /** Flat or extruded outline of a fitting as cut by the top (highlight and picking). */
            const cutShape = (x0, x1, y0, y1) => geometry.cutOutline(i, x0, x1, y0, y1).map(poly => poly.map(p => ({ x: p.x + x, y: p.y })));
            getRenderDesign().secs[i].forEach((it, j) => {
                const hh = it.h, isel = sel && getRenderDesign().item === j, pos = lay[j] || { y0: iy, w: WardrobePlanner.itemWidth(it, sw), off: undefined };
                const iwd = pos.w, iy0 = pos.y0, ix = cx - sw / 2 + (pos.off !== undefined ? pos.off : (sw - iwd) / 2) + iwd / 2, start = renderState.Gr.children.length;
                const localX = ix - x - iwd / 2;
                const local = span => ({...span,x0:span.x0-localX,x1:span.x1-localX});
                const fit = lay[j] ? geometry.itemFit(i, lay[j], it) : null, cut = cutFor(fit, pos.x0);
                mod(it, ix, iy0, iwd, geometry.boxSupported(i, j, lay, iy), geometry.boxCapped(i, j, lay), panels[j].top.map(local), panels[j].bottom.map(local), panels[j].support.map(local), pos.x0 === undefined ? undefined : iy + geometry.ceilingTop(i, pos.x0, pos.x1), cut);
                const group = new THREE.Group(), parts = renderState.Gr.children.slice(start);
                parts.forEach(o => group.add(o));
                renderState.Gr.add(group);
                renderState.itemGroups.push({ it, i, j, group, x: ix, y: iy0 });
                // A cut fitting is picked and highlighted by its real, angled outline.
                const outline = cut ? cutShape(pos.x0, pos.x1, iy0, iy0 + hh)[0] : null;
                let im;
                if (outline) {
                    im = prism(outline, d, 0, resources.HM);
                    im.castShadow = im.receiveShadow = false;
                }
                else {
                    im = new THREE.Mesh(new THREE.BoxGeometry(iwd, hh, d), resources.HM);
                    im.position.set(ix, iy0 + hh / 2, 0);
                    renderState.Gr.add(im);
                }
                im.userData = { i, j };
                renderState.ihits.push(im);
                const io = outline ? flatShape(cutShape(pos.x0 + .2, pos.x1 - .2, iy0 + .2, iy0 + hh - .2)[0] ?? outline, new THREE.MeshBasicMaterial({ color: 0xfff3d9, transparent: true, opacity: isel ? .22 : .04, depthWrite: false })) : resources.softArea(iwd - .4, hh - .4, .15, isel ? .22 : .04);
                if (outline) io.position.z = d / 2 + .2;
                else io.position.set(ix, iy0 + hh / 2, d / 2 + .2);
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
                // Shelf boards and dividers meeting a sloped top are cut to its angle. A divider
                // is drawn to the top the slope allows, never to a stored top above it.
                const j = getRenderDesign().dividers.indexOf(q), r = geometry.dividerRect(geometry.clampDivider(q));
                const cx = x + (r.x0 + r.x1) / 2, cy = iy + (r.y0 + r.y1) / 2, boardCut = geometry.boardFit(i, r, q.orientation)?.cut;
                const roofFit = q.orientation === 'vertical' && (q.roofFit ?? (q.want !== undefined
                    && q.want >= geometry.ceilingTop(i, 0, sw) - .5 && r.y1 >= geometry.ceilingIn(i, r.x0, r.x1) - .05));
                const roof = roofFit ? roofDividerMesh(getRenderDesign(), x + w / 2 + r.x0, x + w / 2 + r.x1, iy + r.y0, mp) : null;
                if (roof) renderState.Gr.add(roof);
                const panel = roof ? null : boardCut ? (slabIn(x, r.x1 - r.x0, r.y1 - r.y0, fd.depth, cx, cy, fd.centre, mp), null)
                    : box(r.x1 - r.x0, r.y1 - r.y0, fd.depth, cx, cy, fd.centre, mp);
                // Picking follows the cut roof, including the taller front/rear area.
                const vr = geometry.visibleRect(q), vcx = x + (vr.x0 + vr.x1) / 2, vcy = iy + (vr.y0 + vr.y1) / 2;
                const hit = new THREE.Mesh(roof ? roof.geometry.clone() : new THREE.BoxGeometry(Math.max(5, vr.x1 - vr.x0), Math.max(5, vr.y1 - vr.y0), d), resources.HM);
                if (!roof) hit.position.set(vcx, vcy, 0);
                hit.userData = { i, divider: j };
                renderState.Gr.add(hit);
                renderState.ihits.push(hit);
                if (renderState.renderActive && selectionState.focusOn && getRenderDesign().divider === j) {
                    const front = d / 2 + 4, a = new V(x + vr.x0, iy + vr.y0, front), b = new V(x + vr.x1, iy + vr.y1, front), outline = dimensionStroke([a, new V(b.x, a.y, front), new V(b.x, a.y, front), b, b, new V(a.x, b.y, front), new V(a.x, b.y, front), a]);
                    const hor = q.orientation === 'horizontal', ra = hor ? new V(x + vr.x0, iy + vr.y0, front) : new V(x + vr.x1, iy + vr.y0, front), rb = hor ? new V(x + vr.x1, iy + vr.y0, front) : new V(x + vr.x1, iy + vr.y1, front);
                    const el = label(ra.clone().add(rb).multiplyScalar(.5), (hor ? 'W ' : 'H ') + measureNumber(hor ? vr.x1 - vr.x0 : vr.y1 - vr.y0) + unitSuffix(), 'lbl dim space-ruler item-dimension');
                    sceneMeasurementBadge(el, { kind: 'board-size', index: j, axis: hor ? 'w' : 'h' }, hor ? 'Shelf width' : 'Divider height',
                        hor ? vr.x1 - vr.x0 : vr.y1 - vr.y0, hor ? 'horizontal' : 'vertical');
                    bindRuler(el, ra, rb, hor ? 'under' : 'height');
                    const sizeEntry = renderState.labs[renderState.labs.length - 1], da = new V(x + vr.x0, iy + vr.y0, fd.z0 - d / 2), db = new V(x + vr.x0, iy + vr.y0, fd.z1 - d / 2), depthLabel = label(da.clone().add(db).multiplyScalar(.5), 'D ' + measureNumber(fd.depth) + unitSuffix(), 'lbl dim space-ruler item-dimension');
                    sceneMeasurementBadge(depthLabel, { kind: 'board-size', index: j, axis: 'd' }, 'Board depth', fd.depth, 'horizontal', fittingDepth(MIN_CABINET_DEPTH).depth, 78);
                    bindRuler(depthLabel, da, db, 'depth');
                    const depthEntry = renderState.labs[renderState.labs.length - 1], clearances = createDividerClearances(j, x);
                    renderState.dividerVisuals[j] = { panel, hit, outline, sizeEntry, depthEntry, clearances, baseX: x };
                }
            });
            const chosenSpace = sel && getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0) ? geometry.sectionSpaceMeasurements(i) : null;
            // A section its fittings fill has no opening to measure: the piece's own sizes show instead, never a 0.
            if (chosenSpace && (chosenSpace.w <= .1 || chosenSpace.h <= .1)) noFreeSpace = true;
            else if (chosenSpace) {
                // Net clear opening of the selected space. Under a slope the height runs from lowest to tallest, and its
                // ruler stands where the space is tallest so it never pokes through the top.
                const space = chosenSpace, sx = x + space.x0, ex = x + space.x1, zf = d / 2 + 3, cls = 'lbl dim space-ruler net';
                const tall = space.sloped ? geometry.spaceTallest(i, space) : { x: space.x1 - 4, h: space.h }, hx = x + tall.x, f = measureNumber;
                dimLine(new V(sx, space.y0 + 3, zf), new V(ex, space.y0 + 3, zf), 'W ' + f(space.w) + unitSuffix(), cls, spaceRulerPoints);
                dimLine(new V(hx, space.y0, zf), new V(hx, space.y0 + tall.h, zf), 'H ' + (space.sloped ? f(space.hMin) + '–' : '') + f(tall.h) + unitSuffix(), cls, spaceRulerPoints);
                dimLine(new V(sx + 5, space.y0 + 5, fd.z0 - d / 2), new V(sx + 5, space.y0 + 5, fd.z1 - d / 2), 'D ' + f(space.dep) + unitSuffix(), cls, spaceRulerPoints);
            }
            else if (!sel && getRenderDesign().item < 0) {
                ho.userData.label = label(new V(cx, iy + H + PANEL + 8, d / 2), 'W ' + measureNumber(sw) + unitSuffix(), 'lbl dim hover-dim net');
            }
            // Add item belongs to the selected wardrobe even outside the section-inspection scope.
            let addSpace, fallbackSpace = false;
            if (selected && getRenderDesign().item < 0 && !(getRenderDesign().divider >= 0) && !interactionState.moveMode) {
                addSpace = geometry.sectionSpaceMeasurements(i);
                // A tapped roof sliver must not hide Add while usable space remains in this section.
                if (addSpace.h < 15) {
                    addSpace = geometry.sectionSpaces(i).filter(q => q.h >= 15).sort((a, b) => b.y1 - a.y1 || b.w * b.h - a.w * a.h)[0];
                    fallbackSpace = true;
                }
            }
            if (addSpace?.h >= 15) {
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
                    if (ev.isTrusted && ev.detail > 0 && !pressed) return;
                    pressed = false;
                    if (fallbackSpace) {
                        const c = geometry.spaceCentre(i, addSpace);
                        getRenderDesign().space = { i, x: c.x, y: c.y };
                    }
                    inspector.openPillMenu(ab);
                };
                $('#labels').appendChild(ab);
                // The pill sits at the centre of mass of the clear area, so it is in the middle of
                // the room the shape leaves, whatever the shape.
                const c = geometry.spaceCentre(i, addSpace);
                const top = Math.min(addSpace.y1, iy + geometry.ceilingIn(i, c.x, c.x + .01));
                renderState.labs.push({ p: new V(x + c.x, c.y, d / 2), el: ab, owner: renderState.Gr, addArea: {
                    left: new V(x + addSpace.x0, c.y, d / 2), right: new V(x + addSpace.x1, c.y, d / 2),
                    bottom: new V(x + c.x, addSpace.y0, d / 2), top: new V(x + c.x, top, d / 2) } });
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
                renderUpright(getRenderDesign(), x + w / 2, x + w / 2 + PANEL, iy, pd.depth, mp, box, prism, pd.centre);
                x += PANEL;
            }
        });
        if (renderState.renderActive && ((selectionState.showDimensions && selectionState.focusOn && getRenderDesign().item < 0 && (!inspector.inside() || noFreeSpace)) || selectionState.editingSize)) {
            dimLine(new V(-w / 2, -4, d / 2 + 8), new V(w / 2, -4, d / 2 + 8), 'W ' + measureNumber(w) + unitSuffix(), 'lbl dim dimension-scrubber scrub-w');
            const top = resolveShape(getRenderDesign()).top, left = top[0].y, right = top[top.length - 1].y, f = measureNumber;
            dimLine(new V(-w / 2 - 9, 0, d / 2 + 2), new V(-w / 2 - 9, left, d / 2 + 2), 'H ' + f(left) + unitSuffix(),
                'lbl dim dimension-scrubber ' + (Math.abs(right - left) > .05 ? 'scrub-h-left' : 'scrub-h'));
            if (Math.abs(right - left) > .05) {
                dimLine(new V(w / 2 + 9, 0, d / 2 + 2), new V(w / 2 + 9, right, d / 2 + 2), 'H ' + f(right) + unitSuffix(), 'lbl dim dimension-scrubber scrub-h-right');
            }
            // The wardrobe depth remains available on the model alongside width and height.
            dimLine(new V(w / 2 + 9, 0, -d / 2), new V(w / 2 + 9, 0, d / 2), 'D ' + measureNumber(d) + unitSuffix(), 'lbl dim dimension-scrubber scrub-d');
        }
        // The project's max reach, where it matters: on the selected piece when it rises to that height (a wall unit's floor
        // may be above it; a base unit never reaches it).
        const reach = maxReach(), cabinetY = renderState.renderCabinet?.y || 0;
        if (renderState.renderActive && selectionState.focusOn && reach !== undefined && cabinetY + h >= reach - 25) {
            const ry = reach - cabinetY, reachGeo = new THREE.BufferGeometry().setFromPoints([new V(-w / 2 - 5, ry, d / 2 + 5), new V(w / 2 + 5, ry, d / 2 + 5)]), reachLine = new THREE.Line(reachGeo, new THREE.LineDashedMaterial({ color: new THREE.Color('#75664f').convertSRGBToLinear(), toneMapped: false, dashSize: 3, gapSize: 2, transparent: true, opacity: .9, depthTest: false }));
            reachLine.computeLineDistances();
            reachLine.renderOrder = 15;
            renderState.Gr.add(reachLine);
            const reachLabel = label(new V(w / 2 + 5, ry, d / 2 + 5), 'Max reach ' + measureNumber(reach) + unitSuffix(), 'lbl dim reach-dimension');
            sceneMeasurementBadge(reachLabel, { kind: 'reach' }, 'Max reach height', reach, 'vertical', 100, 250);
            renderState.labs[renderState.labs.length - 1].reachFrom = new V(-w / 2 - 5, ry, d / 2 + 5);
        }
        const lg = new THREE.BufferGeometry().setFromPoints(lp), ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color('#8d7d65').convertSRGBToLinear(), toneMapped: false, transparent: true, opacity: .65, depthTest: false }));
        ls.renderOrder = 10;
        renderState.Gr.add(ls);
        if (spaceRulerPoints.length) {
            dimensionStroke(spaceRulerPoints, renderState.Gr, 11);
        }
        renderState.pivots = renderCabinetDoors(getRenderDesign(), ws, renderState.Gr, box, prism, resources, mf, mh);
        placeShapeHandles();
        renderState.Gr.updateMatrixWorld(true);
    }
    return { buildCabinet };
}
