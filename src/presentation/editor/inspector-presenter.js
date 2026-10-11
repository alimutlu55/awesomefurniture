import { refreshContextualToolbar } from './contextual-toolbar.js';
import { syncResizeFields } from './resize-fields.js';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import { tags, noticeLabels } from './storage-tags.js';
import { createMeasurementInspector } from './measurement-inspector.js';
import { createItemActions } from './item-actions.js';
import { createInspectorPanels } from './inspector-panels.js';
import { PANEL, PLINTH, MODS, PURPOSE, compatiblePurposes, itemName } from '../../domain/wardrobe/catalog.js';
import { measureNumber, capWord, esc, icon, RANKS } from './editor-format.js';
import { scoreLayout } from '../../domain/planner/layout-score';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { isRegularShape, minimumShapeHeight } from '../../domain/wardrobe/shape/wardrobe-shape';
import { shapeTemplates, templateArt } from './shape-art';
/** Presentation behavior with explicit subsystem dependencies. */
/** @param {import('./inspector-presenter.ports').CreateInspectorPresenterPorts} ports */
export function createInspectorPresenter({ dom, elements, camera, rendering, interactions, planner, shell, cameraState, interactionState, renderState, selectionState, shellState, geometry, resources, model, commands, sceneCommands, history, shapeInspector }) {
    const { $, document, matchMedia } = dom;
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
        (document.querySelectorAll('.pop.show')).forEach(p => { animateMobileSheetClose(p); p.classList.remove('show'); });
        cameraState.vsT = camera.baseShift();
        cameraState.vzT = 1;
    };
    function selectCabinet(id) {
        selectionState.shapeEditing = false;
        delete elements.app.dataset.toolbarMode;
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
        selectionState.pillOn = dom.width <= 900;
        selectionState.deep = dom.width <= 900;
        update();
        if (dom.width <= 900) camera.frameMobileInspector(true);
        else camera.focusSelection(true);
    }
    function addCabinet(copy = false, template) {
        const w = sceneCommands.addCabinet(copy, template);
        if (template && template !== 'regular') selectionState.shapeEditing = true;
        hidePop();
        selectionState.pillOn = dom.width <= 900;
        if (dom.width <= 900) selectionState.deep = true;
        update();
        camera.fit();
        shell.toast(w.name + ' added');
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
    function reachUI() {
        const p = model.activeCabinet().state.profile, input = $('#wardrobe-reach');
        input.value = String(p.reach);
        input.disabled = !!p.accessible;
        input.min = p.accessible ? '100' : '140';
        $('#wardrobe-reach-line').checked = !!(model.activeCabinet().state.reachLine ?? p.engaged);
        input.title = p.accessible ? 'Seated reach is fixed at 122 cm. Change it in Auto design.' : 'Maximum comfortable reach height';
        const enabled = !!(model.activeCabinet().state.reachLine ?? p.engaged);
        $('#reach-height-row').hidden = !enabled;
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
        for (const [id, mode] of [['move-mode', 'move'], ['swap-mode', 'swap']]) {
            const on = interactionState.moveMode === mode;
            $('#' + id).classList.toggle('on', on);
            $('#' + id).setAttribute('aria-pressed', String(on));
        }
        $('#move-cancel').hidden = !interactionState.moveMode;
    }
    function reopenItemPanel() {
        if (dom.width <= 900) return;
        if (interactionState.ptrs.size || interactionState.drag || interactionState.moveMode || interactionState.wardrobeGesture || interactionState.rotationGesture || !selectionState.focusOn || !$('#wizard').hidden || document.querySelector('.pop.show')) {
            return;
        }
        if (!model.activeCabinet().state.secs[model.activeCabinet().state.sel]?.[model.activeCabinet().state.item]) {
            return;
        }
        showPop({ clientX: 0, clientY: 0 }, '#pop3');
    }
    function syncResponsive() {
        const desk = matchMedia('(min-width:901px)').matches, design = model.activeCabinet().state;
        $('#remove-wardrobe').hidden = model.scene.wardrobes.length < 2;
        const div = desk && design.divider >= 0, item = desk && !div && !!design.secs[design.sel]?.[design.item];
        elements.app.classList.toggle('v-div', div);
        elements.app.classList.toggle('v-item', item);
        const key = div ? 'd' : item ? 'i' : 'w';
        if (key !== selectionState.responsivePanel) {
            selectionState.responsivePanel = key;
            $('#left').scrollTop = 0;
        }
    }
    function ui() {
        refreshContextualToolbar($('#toolbar'));
        syncResponsive();
        wardrobeUI();
        measurementUI();
        reachUI();
        const s = geometry.stats(), f = geometry.free(model.activeCabinet().state.sel), ws = geometry.widths(), mn = geometry.maxN();
        $('#sliders').querySelectorAll('input').forEach(i => {
            const key = i.dataset.dimension || dom.controlId(i);
            i.value = model.activeCabinet().state[key];
            $('#' + key + 'v').textContent = model.activeCabinet().state[key] + ' cm';
            if (i.type === 'range') i.setAttribute('aria-valuetext', i.value + ' cm');
        });
        {
            // A shaped wardrobe's height is its tallest point; its lowest part may be short.
            const shape = model.activeCabinet().state.shape, minH = shape && !isRegularShape(shape) ? Math.max(60, Math.ceil(minimumShapeHeight(shape))) : 180;
            for (const el of /** @type {HTMLInputElement[]} */ ([$('#h'), document.querySelector('[data-dimension="h"]')])) if (el) el.min = String(minH);
        }
        shapeInspector.render();
        sectionsUI();
        $('#fins').querySelectorAll('button').forEach(b => {
            b.classList.toggle('on', b.dataset.f === model.activeCabinet().state.fin);
            b.setAttribute('aria-pressed', String(b.dataset.f === model.activeCabinet().state.fin));
        });
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-d]')).forEach(b => {
            b.classList.toggle('on', b.dataset.d === model.activeCabinet().state.doors);
            b.setAttribute('aria-pressed', String(b.dataset.d === model.activeCabinet().state.doors));
        });
        $('#open').disabled = model.activeCabinet().state.doors === 'none';
        const effF = model.activeCabinet().state.item < 0 ? geometry.sectionSpaceMeasurements(model.activeCabinet().state.sel).h : (model.activeCabinet().state.secs[model.activeCabinet().state.sel][model.activeCabinet().state.item]?.w ? geometry.itemFreeAbove(model.activeCabinet().state.sel, model.activeCabinet().state.item) : f);
        /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#toolbar [data-m],#pop2 [data-m],#pill-menu [data-m]')).forEach(b => {
            const m = b.dataset.m, bad = (geometry.effectiveMin(m) > effF && !geometry.edgeGap(m)) || !geometry.itemFeasible(m, ws[model.activeCabinet().state.sel]);
            b.classList.toggle('no', bad);
            b.setAttribute('aria-disabled', String(bad));
            b.title = MODS[m].n + ' · ' + MODS[m].h + ' cm tall · shortcut ' + MODS[m].k + (bad ? ' · no room in this section' : '');
        });
        const eng = model.activeCabinet().state.profile.engaged, rating = scoreLayout(geometry.currentLayout().sections, geometry.planCfg(), model.activeCabinet().state.dividers), assessment = rating.metrics;
        const score = s.mods ? Math.round(rating.score) : 0;
        $('#score').textContent = String(eng ? score : '–');
        $('#score-sub').hidden = true;
        planner.planUI(assessment);
        const iw = ws.reduce((a, b) => a + b);
        $('#specs').innerHTML = [['Outer', model.activeCabinet().state.w + ' × ' + model.activeCabinet().state.h + ' × ' + model.activeCabinet().state.d], ['Inner height', geometry.ih().toFixed(1) + ' cm'], ['Inner width (total)', iw.toFixed(1) + ' cm'], ['Hanging length', s.hang.toFixed(2) + ' m'], ['Shelf area', s.shelf.toFixed(2) + ' m²'], ['Drawers', s.drawers], ['Space used', Math.round(s.avg * 100) + '%']].map(r => `<div class="stat"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
        const lv = Math.floor(shellState.G.xp / 150) + 1;
        $('#lvl').textContent = String(lv);
        $('#xp').textContent = String(shellState.G.xp);
        $('#rank').textContent = RANKS[Math.min(lv - 1, 5)];
        bar('#xpb', shellState.G.xp % 150 / 1.5);
        $('#qc').textContent = '(' + Object.keys(shellState.G.done).length + '/' + shell.Q.length + ')';
        $('#quests').innerHTML = shell.Q.map(q => `<li class="q ${shellState.G.done[q[0]] ? 'done' : ''}"><span class="ck">${shellState.G.done[q[0]] ? '✓' : ''}</span><span>${q[1]}<small>${q[2]}</small></span><em>+${q[3]}</em></li>`).join('');
    }
    function inside() {
        return selectionState.deep || model.activeCabinet().state.item >= 0;
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
        delete elements.app.dataset.toolbarMode;
        if (dom.width <= 900) { elements.app.classList.remove('props-open'); elements.app.classList.add('props-hidden'); }
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
        $('#section-diagram').innerHTML = ws.map((w, i) => '<button type="button" data-sec="' + i + '" aria-label="Section ' + (i + 1) + '" aria-pressed="' + (i === model.activeCabinet().state.sel) + '" title="Section ' + (i + 1) + ' · ' + (Math.round(w * 10) / 10) + ' cm" class="' + (i === model.activeCabinet().state.sel ? 'on' : '') + '" style="flex:' + w + '"><span class="mobile-section-label">' + (i + 1) + '</span></button>').join('');
    }
    function openPillMenu(btn) {
        showPop(null, '#pop2');
        $('#px').focus();
    }
    function productArt(k) {
        const shelf = '<path d="M16 58 93 39 130 53 52 75Z" fill="#d9bd91"/><path d="M16 58v9l36 17v-9Z" fill="#ad8a5e"/><path d="M52 75 130 53v9L52 84Z" fill="#c3a073"/><path d="m24 59 69-16m-55 23 68-17" stroke="#f4ddba" opacity=".45"/>';
        const hanger = x => `<g transform="translate(${x},0)"><path d="M60 26c-8-8 6-12 6-4 0 4-6 5-6 10v5" fill="none" stroke="#a79881" stroke-width="2"/><path d="M60 37 39 65q-2 4 3 4l40-6q5-1 1-4Z" fill="none" stroke="#b39568" stroke-width="5" stroke-linejoin="round"/></g>`;
        const trouserRack = '<path d="M18 24 94 6 130 20 54 39Z" fill="#dcc49f"/><path d="M18 24v5l36 15v-5Z" fill="#b99b71"/><path d="M54 39 130 20v5L54 44Z" fill="#c5aa83"/>'
            + '<g fill="none" stroke-linecap="round"><path d="m20 37 77-19m-43 36 77-19" stroke="#73766f" stroke-width="5"/><path d="m20 36 77-19m-43 36 77-19" stroke="#e8e9e3" stroke-width="2"/><path d="m18 43 78-19m-42 36 78-19" stroke="#a2a59d" stroke-width="3"/></g>'
            + ['#4c5965', '#b9af9e', '#757d6d', '#d1c8b6', '#676962', '#465361'].map((color, i) => {
                const t = (5 - i) / 5, x = 36 + t * 68, y = 48 - t * 18;
                return `<g><path d="M${x} ${y}q7-3 14-3l1 44-6 2-2-23-1 24-6 2Z" fill="${color}"/><path d="m${x + 7} ${y + 3} 0 20m-4 4-1 16m9-18 1 17" fill="none" stroke="#202b33" stroke-opacity=".22" stroke-width=".8"/><path d="m${x} ${y} 14-3" stroke="#f7f4eb" stroke-opacity=".4" stroke-width="1.4"/><path d="m${x - 15} ${y - 10} 32 14" stroke="#797d76" stroke-width="3" stroke-linecap="round"/><path d="m${x - 15} ${y - 11} 32 14" stroke="#e7e8e0" stroke-width="1" stroke-linecap="round"/></g>`;
            }).join('')
            + '<path d="m18 43 36 17 78-19" fill="none" stroke="#73786f" stroke-width="4" stroke-linejoin="round"/><path d="m18 42 36 17 78-19" fill="none" stroke="#e7e9e2" stroke-width="1.3"/><path d="m72 57 30-7" stroke="#4f554f" stroke-width="5" stroke-linecap="round"/><path d="m72 56 30-7" stroke="#92988e" stroke-width="1" stroke-linecap="round"/>';
        const art = { short: '<path d="M17 24 128 15" stroke="#8c8980" stroke-width="5" stroke-linecap="round"/><path d="M17 23 128 14" stroke="#f8f6ee" stroke-width="2"/>' + hanger(-19) + hanger(2) + hanger(23),
            shelf,
            folded: shelf + '<path d="M38 54 74 45 92 52 56 61Z" fill="#e7e1d4"/><path d="M38 54v5l18 8v-6Z" fill="#b8b09c"/><path d="M56 61 92 52v5L56 67Z" fill="#cfc7b4"/><path d="M40 47 76 38 94 45 58 54Z" fill="#8a9a82"/><path d="M40 47v5l18 7v-5Z" fill="#6d7c66"/><path d="M58 54 94 45v5L58 59Z" fill="#7b8b73"/>',
            pants: trouserRack,
            drawer: '<path d="M23 42 96 26 126 40 52 58Z" fill="#b5976f"/><path d="m30 43 64-13 24 10-65 14Z" fill="#8c7051"/><path d="M23 42v33l29 17V58Z" fill="#ba9869"/><path d="M52 58 126 40v33L52 92Z" fill="#d8b98a"/><path d="m74 70 30-7" stroke="#796248" stroke-width="2"/><path d="m56 61 64-16" stroke="#f4ddb8"/>',
            shoe: '<g fill="none" stroke="#ada99b" stroke-width="2"><path d="m22 49 77-18 49 18-78 24Zm0 0v24m26 0v20m78-44v25M22 73l26 20 78-19M32 47l27 23m-7-28 27 23m-8-28 27 24m-8-28 27 23"/></g><path d="m47 41 8-14q3-3 7 2l9 17q7 9-1 11l-12 2Z" fill="#817460"/><path d="m70 37 8-14q3-3 7 2l9 17q7 9-1 11l-12 2Z" fill="#a0927a"/>',
            basket: '<g fill="#d7d0c330" stroke="#aaa397" stroke-width="1.5"><path d="m23 37 70-16 35 16-70 19Z"/><path d="m23 37 7 40 29 15 62-18 7-37-70 19Z"/></g><g stroke="#aaa397" fill="none">' + [0, 1, 2, 3, 4, 5, 6].map(i => `<path d="m${60 + i * 10} ${56 - i * 2.7} -1 33M${24 + i * 5} ${39 + i * 3} l7 39"/>`).join('') + '<path d="m25 48 34 17 67-19M27 59l32 16 64-18M29 69l30 15 63-18"/></g>',
            seasonal: '<path d="M24 62 56 54 84 66 52 75Z" fill="#d2c4a4"/><path d="M24 62v22l28 12V75Z" fill="#a99b7c"/><path d="M52 75 84 66v22L52 96Z" fill="#bbad8e"/><path d="M40 70h8" stroke="#f3eee4" stroke-width="2"/><path d="M66 34 98 26 126 38 94 46Z" fill="#d9ccae"/><path d="M66 34v22l28 12V46Z" fill="#b2a485"/><path d="M94 46 126 38v22L94 68Z" fill="#c4b697"/><path d="M80 44h8" stroke="#f3eee4" stroke-width="2"/>',
            divider: '<path d="m71 22 6-2v72l-6 2Z" fill="#a28e73"/><path d="m71 22-35 13v51l35 8Z" fill="#dfd5c4"/><path d="m77 20 34 17v48L77 92Z" fill="#b5aa96"/>',
        };
        return '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true">' + (art[k] || art[{ long: 'short', sdrawer: 'drawer', lift: 'short' }[k]] || shelf) + '</svg>';
    }
    function renderAddChoices() {
        selectionState.addKey = model.activeCabinet().state.sel;
        const { list, intent } = geometry.addSuggestions(), ranked = list.slice().sort((a, c) => (c.fit - a.fit) || c.s - a.s || a.o - c.o), feat = ranked.slice(0, 6);
        const set = new Set(feat.map(x => x.k)), rest = list.filter(x => !set.has(x.k)).sort((a, c) => (c.fit - a.fit) || c.s - a.s || a.o - c.o), nm = k => k === 'divider' ? 'Divider' : k === 'short' ? 'Hanging rail' : MODS[k].n, attr = x => x.k === 'divider' ? 'data-a="divider"' : 'data-m="' + x.k + '"';
        $('#add-intent').innerHTML = tags([(intent.match(/<b>(.*?)<\/b>/)?.[1] || '').replace(/\.$/, '').replace('Low space at floor level', 'Floor zone').replace('Roomy space within reach', 'Within reach').replace('Reaches above your ', 'Above reach ')]);
        $('#padd').innerHTML = feat.map(x => '<button type="button" ' + attr(x) + (!x.fit ? ' class="no" aria-disabled="true"' : x.warn ? ' class="warn"' : '') + ' title="' + esc(nm(x.k) + (x.fit ? (x.warn ? ' · ' + x.hint : '') : ' · ' + x.hint)) + '">' + productArt(x.k) + '<span>' + nm(x.k) + '</span>' + (x.hint ? '<small>' + esc(x.hint) + '</small>' : '') + '</button>').join('');
        $('#padd2').innerHTML = rest.map(x => '<button type="button" ' + attr(x) + ' class="' + (!x.fit ? 'no' : x.warn ? 'warn' : '') + '" aria-disabled="' + !x.fit + '" title="' + esc(nm(x.k) + (x.hint ? ' · ' + x.hint : '')) + '">' + icon(x.k) + '<span>' + nm(x.k) + '</span>' + (x.hint ? '<small>' + esc(x.hint) + '</small>' : '') + '</button>').join('');
        $('#more-count').textContent = String(rest.length);
        const browser = $('#pop2').querySelector('.mobile-add-browser');
        const categories = browser.querySelector('.mobile-add-categories'), products = browser.querySelector('.mobile-add-products');
        const group = k => ['short','long','lift','pants'].includes(k) ? 'hanging' : ['drawer','sdrawer'].includes(k) ? 'drawers' : ['shelf','folded','divider','shoe'].includes(k) ? 'shelves' : 'storage';
        const shapes = shapeTemplates(), shapeButton = (t, extra) => '<button type="button" class="shape-product" data-add-shape="' + t.id + '"' + extra + ' title="' + esc('New ' + t.name.toLowerCase() + ' wardrobe · ' + t.description) + '">' + templateArt(t.id) + '<span>' + esc(t.name) + '</span></button>';
        $('#padd-shapes').innerHTML = shapes.map(t => shapeButton(t, '')).join('');
        categories.innerHTML = [['all','Add item','plus'],['wardrobe','Wardrobe','wardrobe'],['storage','Storage','seasonal'],['hanging','Hanging','short'],['drawers','Drawers','drawer'],['shelves','Shelves','shelf']].map(([key,name,ic]) => '<button type="button" data-category="'+key+'" aria-pressed="'+(key==='all')+'">'+icon(ic)+'<span>'+name+'</span></button>').join('') + '<button type="button" data-auto-design>'+icon('spark')+'<span>Auto design</span></button>';
        const wardrobeArt = '<svg class="product-art" viewBox="0 0 146 110" aria-hidden="true"><path d="M42 17 92 10 112 24 62 32Z" fill="#e0c49b"/><path d="M42 17v80l20 10V32Z" fill="#b59261"/><path d="M62 32 112 24v72l-50 11Z" fill="#cfad79"/><path d="m87 28 0 74m-5-43v10m10-12v10" stroke="#8d734f" stroke-width="1.5"/></svg>';
        const order = k => { const i = ['drawer','shelf','short','seasonal'].indexOf(k); return i < 0 ? 4 : i; };
        products.innerHTML = '<button type="button" data-product-category="storage" data-add-wardrobe>'+wardrobeArt+'<span>Wardrobe</span></button>' + shapes.map(t => shapeButton(t, ' data-product-category="wardrobe" hidden')).join('') + list.slice().sort((a,b) => order(a.k) - order(b.k)).map(x => '<button type="button" '+attr(x)+' data-product-category="'+group(x.k)+'" aria-disabled="'+!x.fit+'" class="'+(!x.fit?'no':x.warn?'warn':'')+'" title="'+esc(nm(x.k)+(x.hint?' · '+x.hint:''))+'">'+productArt(x.k)+'<span>'+nm(x.k)+'</span></button>').join('');
        (/** @type {HTMLButtonElement} */ (browser.querySelector('[data-add-wardrobe]'))).onclick = () => addCabinet();
        // Wardrobe templates add a new wardrobe that starts from that skeleton.
        (/** @type {NodeListOf<HTMLButtonElement>} */ ($('#pop2').querySelectorAll('[data-add-shape]'))).forEach(button => { button.onclick = () => addCabinet(false, button.dataset.addShape); });
        (/** @type {HTMLButtonElement} */ (categories.querySelector('[data-auto-design]'))).onclick = () => $('#launch-wizard').click();
        (/** @type {NodeListOf<HTMLButtonElement>} */ (categories.querySelectorAll('[data-category]'))).forEach(button => {
            button.onclick = () => {
                const category = button.dataset.category;
                categories.querySelectorAll('[data-category]').forEach(tab => tab.setAttribute('aria-pressed',String(tab===button)));
                (/** @type {NodeListOf<HTMLButtonElement>} */ (products.querySelectorAll('[data-product-category]'))).forEach(product => { product.hidden = category === 'all' ? product.dataset.productCategory === 'wardrobe' : product.dataset.productCategory !== category; });
                products.scrollLeft = 0;
            };
        });
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
        update();
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
        update();
        histUI();
    }
    function setCabinetPose(key, value) {
        if (sceneCommands.setCabinetPose(key, value)) {
            hidePop();
            update(true);
        }
    }
    function moveDestinationUI() {
        const bay = $('#move-bay'), key = model.activeCabinet().state.sel + ',' + model.activeCabinet().state.item + ',' + geometry.widths().join(',');
        if (bay.dataset.source !== key) {
            bay.dataset.source = key;
            $('#move-slot').value = '';
            bay.innerHTML = geometry.widths().map((w, i) => '<option value="' + i + '">Section ' + (i + 1) + ' · ' + w.toFixed(1) + ' cm wide</option>').join('');
            bay.value = String(model.activeCabinet().state.sel);
        }
        moveSlotUI();
    }
    function moveSlotUI() {
        const to = +$('#move-bay').value, sec = model.activeCabinet().state.secs[to] || [], slot = $('#move-slot'), value = slot.value;
        slot.innerHTML = sec.map((it, j) => '<option value="' + j + '">Below ' + (j + 1) + ': ' + esc(itemName(it)) + '</option>').join('') + '<option value="' + sec.length + '">Top of section' + (!sec.length ? ' (empty)' : '') + '</option>';
        slot.value = String([...slot.options].some(o => o.value === value) ? value : sec.length);
        const plan = geometry.planItemMove({ i: model.activeCabinet().state.sel, j: model.activeCabinet().state.item }, to, +slot.value);
        $('#move-apply').disabled = !plan.valid || plan.unchanged;
        $('#move-apply').title = noticeLabels(plan.reason).join(' · ');
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
        moveDestinationUI();
        movementUI();
        const m = MODS[it.k], mx = Math.min(m.mx, it.h + geometry.itemFreeAbove(model.activeCabinet().state.sel, model.activeCabinet().state.item));
        $('#iback').textContent = '← Add another item';
        $('#ititle').textContent = dom.width <= 900 && p.dataset.contextSection === 'resize' ? 'Size' : itemName(it);
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
                return g.y0 < PLINTH + PANEL + r.y1 - .01 && g.y1 > PLINTH + PANEL + r.y0 + .01;
            });
            $('#ialign').querySelectorAll('[data-al]').forEach(b => {
                ( /** @type {HTMLInputElement} */(b)).disabled = full;
                b.classList.toggle('on', !full && (Number.isFinite(it.x) ? (g.gapL < .05 ? 'l' : g.gapR < .05 ? 'r' : Math.abs(g.gapL - g.gapR) < .05 ? 'c' : '') : (it.ax || 'c')) === ( /** @type {HTMLElement} */(b)).dataset.al);
            });
            const q = geometry.itemMeasurements(model.activeCabinet().state.sel, model.activeCabinet().state.item), A = WardrobePlanner.accessInfo(it, g.y0, geometry.plannerConfig()), f = measureNumber;
            const rows = [['Free above (next fitting / top)', f(q.freeTop) + ' cm'], ['Free below (next fitting / base)', f(q.freeBelow) + ' cm'], ['Section side gaps (left / right)', f(g.gapL) + ' / ' + f(g.gapR) + ' cm'], ['X · left → right edge', f(g.x0) + ' → ' + f(g.x1) + ' cm'], ['Y · bottom → top from floor', f(g.y0) + ' → ' + f(g.y1) + ' cm'], ['Z · back → front', f(g.z0) + ' → ' + f(g.z1) + ' cm']];
            if (['short', 'long', 'lift'].includes(it.k)) {
                rows.push(['Rail above floor', f(A.railHeight) + ' cm']);
                if (it.k === 'lift') {
                    rows.push(['Handle above floor', f(A.handleHeight) + ' cm']);
                }
            }
            rows.unshift(['Size · width × height × depth', f(g.w) + ' × ' + f(g.h) + ' × ' + f(g.dep) + ' cm'], ['To inside top / base', f(q.top) + ' / ' + f(q.bottom) + ' cm']);
            if (q.cut && q.core) {
                // Boards and front follow the top's angle; the working part keeps a full rectangle.
                rows.splice(1, 0, ['Cut to the top', 'angled · usable ' + f(q.core.w) + ' × ' + f(q.core.h) + ' cm']);
            }
            if (model.activeCabinet().state.profile.engaged) {
                rows.push(['Max reach', f(model.activeCabinet().state.profile.reach) + ' cm'], ['Access height', f(A.height) + ' cm' + (A.height > model.activeCabinet().state.profile.reach + .03 ? ' · above max reach' : '')]);
                if (A.limit) {
                    rows.push(['Comfortable access limit', f(A.limit) + ' cm']);
                }
            }
            $('#imeas').innerHTML = rows.map(r => '<b>' + r[0] + '</b><span>' + esc(r[1]) + '</span>').join('');
        }
        $('#itype').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === it.k));
        $('#ifin').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.f || null) === (it.f || null)));
        syncResizeFields(p);
    }
    return { syncResponsive, selectCabinet, addCabinet, wardrobeUI, histUI, editableItemClearance, selectSpaceAt, reachUI, measurementUI, editableDividerClearance, dividerUI, movementUI, reopenItemPanel, closeItemMenus, itemAction, placeFloating, placeItemTypeMenu, updateItemBar, ui, inside, goUp, crumbUI, clearFocus, update, sectionsUI, openPillMenu, productArt, renderAddChoices, undo, redo, setCabinetPose, sideFor, layoutPop, dockPop, syncMin, placePop, showPop, popUI, swapPop, moveDestinationUI, moveSlotUI, itemUI, divWord, bar, hidePop };
}
