import { syncDecorPicker } from './decor-picker';
import { isKitchen } from '../../domain/furniture/furniture';
import { kitchenUnit } from '../../domain/kitchen/kitchen-units';
import { itemHingeSide } from '../../domain/kitchen/kitchen-fronts';
import { createAddMenuPresenter } from './add-menu-presenter.js';
import { viewedPlacement } from './viewed-placement';
import { shelfPossession } from '../../domain/wardrobe/possessions';
import { fitting, hasTrait } from '../../domain/wardrobe/fittings';
import { refreshContextualToolbar } from './contextual-toolbar.js';
import { syncResizeFields, syncCabinetSizeLimits } from './resize-fields.js';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import { createMeasurementInspector } from './measurement-inspector.js';
import { createItemActions } from './item-actions.js';
import { createInspectorPanels } from './inspector-panels.js';
import { PANEL, PLINTH, MODS, PURPOSE, compatiblePurposes, itemName } from '../../domain/wardrobe/catalog.js';
import { measureNumber, capWord, esc, icon, ICONP, RANKS, unitSuffix } from './editor-format.js';
import { scoreLayout } from '../../domain/planner/layout-score';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { shapeTemplates, templateArt } from './shape-art';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./inspector-presenter.ports').CreateInspectorPresenterPorts} ports */
export function createInspectorPresenter({ dom, elements, camera, rendering, interactions, planner, shell, cameraState, interactionState, renderState, selectionState, shellState, geometry, resources, model, commands, sceneCommands, history, shapeInspector, studioPanel, kitchenPanel, roomFields }) {
    const { $, document } = dom;
    const { renderAddChoices } = createAddMenuPresenter({ $, model, selectionState, geometry, addCabinet: (copy, template) => addCabinet(copy, template), roomProducts: () => studioPanel.products() + (kitchenPanel?.products() ?? '') });
    const { editableItemClearance, editableDividerClearance, dividerUI } = createMeasurementInspector({ dom, geometry, shell, commands, rendering, model, history, callbacks: { get histUI() {
                return histUI;
            }, get hidePop() {
                return hidePop;
            }, get divWord() {
                return divWord;
            } } });
    const { closeItemMenus, itemAction, placeFloating, placeItemTypeMenu, updateItemBar } = createItemActions({ dom, selectionState, model, commands, interactions, interactionState, renderState, geometry, resources, callbacks: { get inside() {
                return inside;
            }, get divWord() {
                return divWord;
            } } });
    const { sideFor, layoutPop, dockPop, syncMin, placePop, showPop, popUI, swapPop } = createInspectorPanels({ dom, geometry, model, resources, cameraState, camera, selectionState, callbacks: { get hidePop() {
                return hidePop;
            }, get renderAddChoices() {
                return renderAddChoices;
            }, get itemUI() {
                return itemUI;
            }, get dividerUI() {
                return dividerUI;
            } } });
    const divWord = i => model.activeCabinet().state.dividers?.[i]?.orientation === 'horizontal' ? 'shelf' : 'divider';
    const bar = (id, p) => $(id).style.width = Math.max(0, Math.min(100, p)) + '%';
    const hidePop = () => {
        // Closing the phone catalogue enlarges the canvas. Stop its automatic fit
        // before ResizeObserver can pull the camera away from the newly placed item.
        const add = $('#pop2');
        if (dom.width <= 900 && add.classList.contains('show') && !add.dataset.addContext) camera.camRelease();
        (document.querySelectorAll('.pop.show')).forEach(p => { animateMobileSheetClose(p); p.classList.remove('show'); });
        cameraState.vsT = camera.baseShift();
        cameraState.vzT = 1;
    };
    function selectCabinet(id) {
        selectionState.shapeEditing = false;
        camera.camRelease();
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag();
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation();
        }
        interactions.cancelMovement();
        hidePop();
        model.select(id);
        model.activeCabinet().state.item = -1;
        model.activeCabinet().state.divider = -1;
        model.activeCabinet().state.space = null;
        selectionState.pillOn = false;
        selectionState.deep = false;
        update();
        if (dom.width > 900) camera.frameMobileInspector(true);
    }
    function addCabinet(copy = false, template, wall) {
        // A new wardrobe stands against the wall in view, in front of the viewer.
        const w = sceneCommands.addCabinet(copy, template, wall, !copy && !wall ? viewedPlacement(model.scene.studio, resources.cam) : {});
        if (!w) return false;
        selectionState.room = null;
        if (template && template !== 'regular') selectionState.shapeEditing = true;
        hidePop();
        selectionState.pillOn = true;
        selectionState.deep = true;
        update();
        camera.frameMobileInspector(true); // frame the new wardrobe, not all of them
        shell.toast(w.name + ' added');
        return true;
    }
    function wardrobeUI() {
        const select = $('#wardrobe-select');
        select.replaceChildren(...model.scene.wardrobes.map(w => {
            const option = document.createElement('option');
            option.value = String(w.id);
            option.textContent = w.name;
            return option;
        }));
        select.value = String(model.scene.activeWardrobe);
    }
    function histUI() {
        const u = $('#undo2'), r = $('#redo2');
        if (!u) {
            return;
        }
        u.disabled = !history.undoCount;
        r.disabled = !history.redoCount;
        u.querySelector('small').textContent = String(history.undoCount || '');
        r.querySelector('small').textContent = String(history.redoCount || '');
    }
    function selectSpaceAt(i, point) {
        const left = -model.activeCabinet().state.w / 2 + PANEL + geometry.widths().slice(0, i).reduce((a, b) => a + b + PANEL, 0);
        model.activeCabinet().state.space = { i, x: point.x - left, y: point.y };
    }
    function measurementUI() {
        const control = document.querySelector('#studio-measure');
        if (control) {
            control.setAttribute('aria-pressed', String(selectionState.showDimensions));
            control.textContent = selectionState.showDimensions ? 'Hide wardrobe rulers' : 'Show wardrobe rulers';
        }
    }
    function movementUI() {
        const mobileCancel = document.querySelector('.mobile-cancel-move');
        if (mobileCancel) mobileCancel.hidden = !interactionState.moveMode;
        const swapping = interactionState.moveMode === 'swap';
        $('#swap-mode').classList.toggle('on', swapping);
        $('#swap-mode').setAttribute('aria-pressed', String(swapping));
        $('#move-cancel').hidden = !interactionState.moveMode;
    }
    // Selection stays in the contextual toolbar until an explicit action opens a sheet.
    function reopenItemPanel() {}
    function syncResponsive() {
        $('#remove-wardrobe').hidden = !model.scene.wardrobes.length;
    }
    function ui() {
        refreshContextualToolbar($('#toolbar'));
        syncResponsive();
        wardrobeUI();
        measurementUI();
        const s = geometry.stats(), f = geometry.free(model.activeCabinet().state.sel), ws = geometry.widths(), mn = geometry.maxN();
        $('#sliders').querySelectorAll('input').forEach(i => {
            const key = i.dataset.dimension || dom.controlId(i), cabinet = model.activeCabinet(), value = key === 'y' ? cabinet.y || 0 : cabinet.state[key];
            // Height above the floor is only for what hangs on a wall.
            if (key === 'y') /** @type {HTMLElement} */ (i.closest('.resize-field-control')).hidden = !(isKitchen(cabinet.state) && kitchenUnit(cabinet.state.unit).elevation > 0);
            // A sink or hob has no height to set: its thickness is fixed.
            if (key === 'h') /** @type {HTMLElement} */ (i.closest('.resize-field-control')).hidden = isKitchen(cabinet.state) && !!kitchenUnit(cabinet.state.unit).fixture;
            i.value = value;
            $('#' + key + 'v').textContent = measureNumber(value) + unitSuffix();
            if (i.type === 'range') i.setAttribute('aria-valuetext', measureNumber(Number(i.value)) + unitSuffix());
        });
        // The room beside a kitchen unit that it could grow to fill.
        const fill = /** @type {HTMLButtonElement} */ ($('#fill-gap')), room = sceneCommands.fillableSpace();
        fill.hidden = room < .05;
        if (!fill.hidden) fill.textContent = 'Fill the ' + measureNumber(room) + unitSuffix() + ' gap beside it';
        syncCabinetSizeLimits(dom, model.activeCabinet().state, selectionState.editingSize);
        for (const panel of [shapeInspector, studioPanel, kitchenPanel, roomFields]) panel?.render();
        sectionsUI();
        syncDecorPicker($('#fins'), model.activeCabinet().state);
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]')).forEach(b => {
            b.classList.toggle('on', b.dataset.d === model.activeCabinet().state.doors);
            b.setAttribute('aria-pressed', String(b.dataset.d === model.activeCabinet().state.doors));
        });
        const hang = /** @type {HTMLElement | null} */ (document.querySelector('#door-hang')), cornerSide = /** @type {HTMLElement | null} */ (document.querySelector('#corner-side')), cabState = model.activeCabinet().state;
        const cornerItem = cabState.secs.flatMap(sec => sec).find(it => it.k === 'corner');
        if (hang) {
            hang.hidden = (!isKitchen(cabState) && cabState.doors === 'none') || (isKitchen(cabState) && !!kitchenUnit(cabState.unit).fixture);
            hang.querySelectorAll('[data-hang]').forEach(b => {
                const on = (b.getAttribute('data-hang') || '') === (cabState.doorHang || '');
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', String(on));
            });
        }
        if (cornerSide) {
            cornerSide.hidden = !cornerItem;
            cornerSide.querySelectorAll('[data-hang]').forEach(b => {
                const on = b.getAttribute('data-hang') === (cornerItem?.ax === 'r' ? 'corner-r' : 'corner-l');
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', String(on));
            });
        }
        $('#open').disabled = model.activeCabinet().state.doors === 'none';
        const effF = model.activeCabinet().state.item < 0 ? geometry.sectionSpaceMeasurements(model.activeCabinet().state.sel).h : (model.activeCabinet().state.secs[model.activeCabinet().state.sel][model.activeCabinet().state.item]?.w ? geometry.itemFreeAbove(model.activeCabinet().state.sel, model.activeCabinet().state.item) : f);
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#toolbar [data-m],#pop2 [data-m],#pill-menu [data-m]')).forEach(b => {
            const m = b.dataset.m, bad = (geometry.effectiveMin(m) > effF && !geometry.edgeGap(m)) || !geometry.itemFeasible(m, ws[model.activeCabinet().state.sel]);
            b.classList.toggle('no', bad);
            b.setAttribute('aria-disabled', String(bad));
            b.title = MODS[m].n + ' · ' + measureNumber(MODS[m].h) + unitSuffix() + ' tall · shortcut ' + MODS[m].k + (bad ? ' · no room in this section' : '');
        });
        const eng = model.activeCabinet().state.profile.engaged, rating = scoreLayout(geometry.currentLayout().sections, geometry.planCfg(), model.activeCabinet().state.dividers), assessment = rating.metrics;
        const score = s.mods ? Math.round(rating.score) : 0;
        $('#score').textContent = String(eng ? score : '–');
        $('#score-sub').hidden = true;
        planner.planUI(assessment);
        const iw = ws.reduce((a, b) => a + b);
        $('#specs').innerHTML = isKitchen(model.activeCabinet().state) ? planner.kitchenSpecs() : [['Outer', measureNumber(model.activeCabinet().state.w) + ' × ' + measureNumber(model.activeCabinet().state.h) + ' × ' + measureNumber(model.activeCabinet().state.d) + unitSuffix()], ['Inner height', measureNumber(geometry.ih()) + unitSuffix()], ['Inner width (total)', measureNumber(iw) + unitSuffix()], ['Hanging length', s.hang.toFixed(2) + ' m'], ['Shelf area', s.shelf.toFixed(2) + ' m²'], ['Drawers', s.drawers], ['Space used', Math.round(s.avg * 100) + '%']].map(r => `<div class="stat"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
        const lv = Math.floor(shellState.G.xp / 150) + 1;
        $('#lvl').textContent = String(lv);
        $('#xp').textContent = String(shellState.G.xp);
        $('#rank').textContent = RANKS[Math.min(lv - 1, 5)];
        bar('#xpb', shellState.G.xp % 150 / 1.5);
        $('#qc').textContent = '(' + Object.keys(shellState.G.done).length + '/' + shell.Q.length + ')';
        $('#quests').innerHTML = shell.Q.map(q => `<li class="q ${shellState.G.done[q[0]] ? 'done' : ''}"><span class="ck">${shellState.G.done[q[0]] ? '✓' : ''}</span><span>${q[1]}<small>${q[2]}</small></span><em>+${q[3]}</em></li>`).join('');
    }
    function inside() {
        const state = model.activeCabinet().state;
        return selectionState.deep || state.item >= 0 || state.divider >= 0;
    }
    function goUp(to) {
        model.activeCabinet().state.space = null;
        model.activeCabinet().state.divider = -1;
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag();
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation();
        }
        model.activeCabinet().state.item = -1;
        hidePop();
        if (to === 'wardrobe') {
            selectionState.deep = false;
            selectionState.pillOn = false;
        }
        else {
            selectionState.deep = true;
            selectionState.pillOn = true;
        }
        update(true);
    }
    function crumbUI() {
        let c = document.getElementById('crumb');
        if (!c) {
            c = document.createElement('div');
            dom.setId(c, 'crumb');
            c.setAttribute('aria-label', 'Selection');
            document.getElementById('view').appendChild(c);
        }
        c.replaceChildren();
        c.hidden = !selectionState.focusOn;
        if (!selectionState.focusOn) {
            return;
        }
        const add = (t, fn) => {
            const b = document.createElement(fn ? 'button' : 'span');
            if (b instanceof HTMLButtonElement) {
                b.type = 'button';
            }
            b.textContent = t;
            if (fn) {
                b.onclick = fn;
            }
            else {
                b.className = 'cur';
            }
            if (c.children.length) {
                c.append(' › ');
            }
            c.append(b);
        };
        const w = model.activeCabinet().name, lvl = model.activeCabinet().state.item >= 0 || model.activeCabinet().state.divider >= 0 ? 2 : selectionState.deep ? 1 : 0;
        add(w, lvl ? () => goUp('wardrobe') : null);
        if (lvl > 0) {
            add('Space', lvl > 1 ? () => goUp('section') : null);
        }
        if (lvl > 1) {
            add(model.activeCabinet().state.divider >= 0 ? capWord(divWord(model.activeCabinet().state.divider)) : 'Item');
        }
    }
    function clearFocus() {
        // Leaving the wardrobe ends any shape session: handles disappear with it.
        selectionState.shapeEditing = false;
        elements.app.classList.remove('props-open');
        elements.app.classList.add('props-hidden');
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag();
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation();
        }
        selectionState.focusOn = false;
        selectionState.pillOn = false;
        selectionState.deep = false;
        model.activeCabinet().state.item = -1;
        model.activeCabinet().state.divider = -1;
        model.activeCabinet().state.space = null;
        hidePop();
        update(true);
    }
    function update(keep) {
        if (interactionState.drag || interactionState.moveMode) {
            interactionState.ptrs.clear();
            interactions.cancelMovement();
        }
        if (!keep) {
            selectionState.viewMode = 'furniture';
            selectionState.room = null;
            selectionState.pendingStudioAction = null;
            selectionState.focusOn = true;
        }
        commands.normalizeSelection();
        rendering.build();
        shell.check();
        ui();
        histUI();
        if (model.activeCabinet().state.item < 0 && $('#pop3').classList.contains('show')) {
            swapPop('#pop2');
        }
        popUI();
        itemUI();
        dividerUI();
    }
    function sectionsUI() {
        const ws = geometry.widths(), mn = geometry.maxN();
        $('#section-count').textContent = String(model.activeCabinet().state.n);
        $('#sec-minus').disabled = model.activeCabinet().state.n <= 1;
        $('#sec-plus').disabled = model.activeCabinet().state.n >= mn;
        $('#section-diagram').innerHTML = ws.map((w, i) => '<button type="button" data-sec="' + i + '" aria-label="Section ' + (i + 1) + '" aria-pressed="' + (i === model.activeCabinet().state.sel) + '" title="Section ' + (i + 1) + ' · ' + measureNumber(w) + unitSuffix() + '" class="' + (i === model.activeCabinet().state.sel ? 'on' : '') + '" style="flex:' + w + '"><span class="mobile-section-label">' + (i + 1) + '</span></button>').join('');
    }
    function openPillMenu(btn) {
        showPop(null, '#pop2');
        $('#px').focus({ preventScroll: true });
    }
    function undo() {
        if (interactionState.itemEdgeGesture) {
            interactions.finishItemEdgeResize(true);
            return;
        }
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag(true);
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation(true);
        }
        if (!history.undo()) {
            shell.toast('Nothing to undo');
            return;
        }
        selectionState.pendingStudioAction = null;
        update(selectionState.viewMode === 'studio');
        histUI();
    }
    function redo() {
        if (interactionState.itemEdgeGesture) {
            interactions.finishItemEdgeResize(true);
        }
        if (interactionState.wardrobeGesture) {
            interactions.finishWardrobeDrag(true);
        }
        if (interactionState.rotationGesture) {
            interactions.finishRotation(true);
        }
        if (!history.redo()) {
            shell.toast('Nothing to redo');
            return;
        }
        selectionState.pendingStudioAction = null;
        update(selectionState.viewMode === 'studio');
        histUI();
    }
    function setCabinetPose(key, value) {
        if (sceneCommands.setCabinetPose(key, value)) {
            hidePop();
            update(true);
        }
    }
    function itemUI(force = false) {
        const p = $('#pop3');
        if (!force && !p.classList.contains('show') && !$('#app').classList.contains('v-item') && !document.querySelector('.contextual-control-popover:not([hidden])')) {
            return;
        }
        const a = model.activeCabinet().state.secs[model.activeCabinet().state.sel], it = a[model.activeCabinet().state.item];
        if (!it) {
            hidePop();
            return;
        }
        movementUI();
        const m = MODS[it.k], mx = Math.min(m.mx, it.h + geometry.itemFreeAbove(model.activeCabinet().state.sel, model.activeCabinet().state.item));
        $('#iback').textContent = '← Add another item';
        $('#ititle').textContent = p.dataset.contextSection === 'resize' ? 'Size' : itemName(it);
        $('#ipurpose').innerHTML = compatiblePurposes(it.k).map(value => '<option value="' + value + '">' + PURPOSE[value] + '</option>').join('');
        $('#ipurpose').value = it.purpose || m.purpose;
        $('#ih').value = measureNumber(it.h);
        $('#ih').min = geometry.effectiveMin(it.k);
        $('#ih').max = measureNumber(mx);
        {
            const g = geometry.itemGeom(model.activeCabinet().state.sel, model.activeCabinet().state.item), f1 = v => String(Math.round(v * 10) / 10), mnw = geometry.itemMinW(it), full = g.w >= g.bw - .05, maxWidth = geometry.itemEdgeSize(g, geometry.widthEdgeFor(g), geometry.widthEdgeFor(g) === 'left' ? -Infinity : Infinity, geometry.resizeObstacles(model.activeCabinet().state.sel), model.activeCabinet().state.item, mnw, geometry.effectiveMin(it.k), mx).w;
            $('#iw').value = f1(g.w);
            $('#iw').min = mnw;
            $('#iw').max = f1(maxWidth);
            ( /** @type {HTMLInputElement} */(p.querySelector('[data-iwfull]'))).disabled = full || geometry.sectionDividers(model.activeCabinet().state.sel).some(d => {
                const r = geometry.dividerRect(d);
                return g.y0 < geometry.interiorFloor() + r.y1 - .01 && g.y1 > geometry.interiorFloor() + r.y0 + .01;
            });
            $('#ialign').querySelectorAll('[data-al]').forEach(b => {
                ( /** @type {HTMLInputElement} */(b)).disabled = full;
                b.classList.toggle('on', !full && (Number.isFinite(it.x) ? (g.gapL < .05 ? 'l' : g.gapR < .05 ? 'r' : Math.abs(g.gapL - g.gapR) < .05 ? 'c' : '') : (it.ax || 'c')) === ( /** @type {HTMLElement} */(b)).dataset.al);
            });
            const q = geometry.itemMeasurements(model.activeCabinet().state.sel, model.activeCabinet().state.item), A = WardrobePlanner.accessInfo(it, g.y0, geometry.plannerConfig()), f = measureNumber;
            const rows = [['Free above (next fitting / top)', f(q.freeTop) + unitSuffix()], ['Free below (next fitting / base)', f(q.freeBelow) + unitSuffix()], ['Section side gaps (left / right)', f(g.gapL) + ' / ' + f(g.gapR) + unitSuffix()], ['X · left → right edge', f(g.x0) + ' → ' + f(g.x1) + unitSuffix()], ['Y · bottom → top from floor', f(g.y0) + ' → ' + f(g.y1) + unitSuffix()], ['Z · back → front', f(g.z0) + ' → ' + f(g.z1) + unitSuffix()]];
            if (hasTrait(it.k, 'hanging')) {
                rows.push(['Rail above floor', f(A.railHeight) + unitSuffix()]);
                if (it.k === 'lift') {
                    rows.push(['Handle above floor', f(A.handleHeight) + unitSuffix()]);
                }
            }
            rows.unshift(['Size · width × height × depth', f(g.w) + ' × ' + f(g.h) + ' × ' + f(g.dep) + unitSuffix()], ['To inside top / base', f(q.top) + ' / ' + f(q.bottom) + unitSuffix()]);
            if (q.cut && q.core) {
                // Boards and front follow the top's angle; the working part keeps a full rectangle.
                rows.splice(1, 0, ['Cut to the top', 'angled · usable ' + f(q.core.w) + ' × ' + f(q.core.h) + unitSuffix()]);
            }
            if (model.activeCabinet().state.profile.engaged && model.scene.maxReach !== undefined) {
                rows.push(['Max reach', f(model.activeCabinet().state.profile.reach) + unitSuffix()], ['Access height', f(A.height) + unitSuffix() + (A.height > model.activeCabinet().state.profile.reach + .03 ? ' · above max reach' : '')]);
                if (A.limit) {
                    rows.push(['Comfortable access limit', f(A.limit) + unitSuffix()]);
                }
            }
            $('#imeas').innerHTML = rows.map(r => '<b>' + r[0] + '</b><span>' + esc(r[1]) + '</span>').join('');
        }
        const ihinge = /** @type {HTMLElement | null} */ (p.querySelector?.('#ihinge'));
        if (ihinge) {
            const side = itemHingeSide(it, model.activeCabinet().state);
            ihinge.hidden = !hasTrait(it.k, 'sideHandle');
            ihinge.querySelectorAll('[data-hinge]').forEach(b => {
                const on = b.getAttribute('data-hinge') === side;
                b.classList.toggle('on', on);
                b.setAttribute('aria-pressed', String(on));
            });
        }
        $('#itype').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === it.k));
        $('#ifin').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.f || null) === (it.f || null)));
        syncResizeFields(p);
    }
    return { syncResponsive, selectCabinet, addCabinet, wardrobeUI, histUI, editableItemClearance, selectSpaceAt, measurementUI, editableDividerClearance, dividerUI, movementUI, reopenItemPanel, closeItemMenus, itemAction, placeFloating, placeItemTypeMenu, updateItemBar, ui, inside, goUp, crumbUI, clearFocus, update, sectionsUI, openPillMenu, renderAddChoices, undo, redo, setCabinetPose, sideFor, layoutPop, dockPop, syncMin, placePop, showPop, popUI, swapPop, itemUI, divWord, bar, hidePop };
}
