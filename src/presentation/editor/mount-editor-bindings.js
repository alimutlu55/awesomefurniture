import { takeMobilePanel } from './mobile-panel-owner.js';
import { bindTactileCanvas } from './tactile-canvas';
import { animateMobileSheetClose } from './mobile-sheet-motion.js';
import { createContextualToolbar } from './contextual-toolbar.js';
import { createViewModes } from './view-modes';
import { bindSceneReset } from './scene-reset';
import { createResizePresenter } from './resize-presenter.js';
import { mountResizeFields } from './resize-fields.js';
import { bindDividerClose, bindDividerGap, bindDividerHeight, bindDividerRemove, bindDividerDragMove, bindDividerDragEnd, bindDividerDragCancel, bindDividerDragBlur, bindDividerDragEscape } from './bindings/divider.js';
import { bindSecMinus, bindSecPlus, bindSectionDiagram } from './bindings/sections.js';
import { bindCabinetDimensions, bindFinishSwatches, bindDoorChoice, renderDoorChoices, bindDoorsOpenToggle, bindWardrobeSelect, bindWardrobeAdd, bindResetAll } from './bindings/cabinet.js';
import { bindPillAddMenu, bindPillMenuDismiss, bindAddPanel } from './bindings/add-menu.js';
import { bindUndoButton, bindRedoButton, bindEditShortcuts } from './bindings/history.js';
import { bindItemResizeEscape, bindItemResizeBlur, bindItemDimensions, bindItemPanelClose, bindItemPanel, populateStoragePurposes, bindItemPurpose } from './bindings/item.js';
import { bindSwapMode, bindMoveCancel, bindMovePreviewKeydown, bindMovePreviewKeyup } from './bindings/move.js';
import { bindEmptySceneDismiss, bindLaunchWizard, bindEmptySceneLaunch, bindCloseWizard, bindWizardInputs, bindIdeaApply, bindWizardBackdropClose, bindWizardFocusTrap } from './bindings/wizard.js';
import { bindColorSchemeChange, addToolbarSeparator, bindPanelMinimize, bindPanelHeaderDrag, bindPropertiesPanelClose } from './bindings/panels.js';
import { createTouchCamera } from './touch-camera';
import { observeViewportSize, bindCanvasPointerdown, bindCanvasPointermove, bindCanvasPointerup, bindCanvasPointercancel, bindCanvasLostpointercapture, bindCanvasGestureBlur, bindCanvasWheel, bindCanvasPointerleave, bindCanvasGestureEscape } from './bindings/canvas.js';
import { bindItemMenus } from './bindings/item-menus.js';
import { bindEscapeKey } from './bindings/keyboard.js';
import * as wizardBindings from './wizard-bindings.js';
import * as shellBindings from './shell-bindings.js';
import { MODS } from '../../domain/wardrobe/catalog.js';
import { fittingProduct } from '../../domain/wardrobe/fittings';
import { furnitureKind, furnitureModule } from '../../domain/furniture/furniture';
import { isFixture } from '../../domain/kitchen/kitchen-units';
import { OPENING_KINDS } from '../../domain/studio/wall-utilities';
/** @param {import('./mount-editor-bindings.ports').MountEditorBindingsPorts} ports */
export function mountEditorBindings({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState, renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements, room, kitchenArray }) {
    const { $, document } = dom;
    bindTactileCanvas({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState,
        renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements, room,
        openSize: () => resize.open() });
    bindSceneReset({ dom, selectionState, interactionState, plannerState, shellState, inspector,
        interactions, planner, shell, camera, sceneCommands, lifetime });
    mountResizeFields({ dom, lifetime, model, history, refresh: () => inspector.update(true),
        fields: [{ input: $('#iw'), axis: 'width' }, { input: $('#ih'), axis: 'height' },
            { input: $('#dgap0'), axis: 'before' }, { input: $('#dgap1'), axis: 'after' }],
        preview: (input, value) => {
            const id = dom.controlId(input);
            if (id === 'ih' || id === 'iw') interactions.setManualItemSize(id === 'ih' ? 'top' : 'right', value, false);
            else commands.setDividerClearance(model.activeCabinet().state.divider, id === 'dgap0' ? 'before' : 'after', value);
        }
    });
    bindColorSchemeChange({ dom, rendering, lifetime });
    bindDividerClose({ dom, inspector });
    bindDividerGap({ dom, rendering, inspector, shell, geometry, model, commands, history });
    bindDividerHeight({ dom, inspector, model, commands, shell });
    bindDividerRemove({ dom, commands });
    bindDividerDragMove({ dom, interactions, lifetime });
    bindDividerDragEnd({ dom, interactions, lifetime });
    bindDividerDragCancel({ dom, interactions, lifetime });
    bindDividerDragBlur({ dom, interactions, lifetime });
    bindDividerDragEscape({ dom, interactions, interactionState, lifetime });
    observeViewportSize({ dom, camera, lifetime });
    const touch = createTouchCamera({ dom, camera, cameraState, lifetime, picking });
    bindCanvasPointerdown({ dom, camera, touch, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime, room: room.surface, kitchenArray });
    bindCanvasPointermove({ dom, camera, touch, rendering, interactions, inspector, cameraState, interactionState, resources, model, lifetime, room: room.surface, kitchenArray });
    bindCanvasPointerup({ dom, touch, interactions, shell, interactionState, resources, lifetime, room: room.surface, kitchenArray });
    bindCanvasPointercancel({ dom, touch, interactions, interactionState, resources, lifetime, room: room.surface, kitchenArray });
    // Escape during a pull puts the copies back.
    if (kitchenArray) lifetime.listen(dom.window, 'keydown', e => {
        if (e.key !== 'Escape' || !kitchenArray.active()) return;
        e.preventDefault(); e.stopImmediatePropagation(); kitchenArray.end(true);
    }, true);
    bindCanvasLostpointercapture({ dom, interactions, interactionState, resources, lifetime });
    bindCanvasGestureBlur({ dom, interactions, interactionState, lifetime });
    bindCanvasWheel({ dom, camera, interactions, interactionState, resources, lifetime });
    bindCanvasPointerleave({ dom, renderState, resources, lifetime });
    bindItemMenus({ dom, inspector, picking, renderState, selectionState, resources, model, lifetime });
    wizardBindings.bindPlanCapacity({ dom, planner, lifetime });
    bindSecMinus({ dom, commands });
    bindSecPlus({ dom, commands });
    bindSectionDiagram({ dom, inspector, model, lifetime });
    bindCabinetDimensions({ dom, rendering, inspector, selectionState, model, sceneCommands, history, lifetime });
    bindFinishSwatches({ dom, commands });
    bindPillAddMenu({ dom, commands, elements });
    bindPillMenuDismiss({ dom, lifetime, elements });
    bindDoorChoice({ dom, commands });
    bindDoorsOpenToggle({ dom, model });
    bindUndoButton({ dom, inspector });
    bindRedoButton({ dom, inspector });
    bindEditShortcuts({ dom, inspector, selectionState, model, commands, lifetime });
    bindWardrobeSelect({ dom, inspector });
    bindWardrobeAdd({ dom, inspector });
    bindCanvasGestureEscape({ dom, interactions, interactionState, lifetime });
    bindResetAll({ dom, inspector, shell, plannerState, sceneCommands, model });
    bindEscapeKey({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, lifetime });
    bindPanelMinimize({ dom, inspector, selectionState, lifetime });
    bindPanelHeaderDrag({ dom, camera, inspector, cameraState, selectionState, lifetime });
    bindPropertiesPanelClose({ dom, inspector });
    bindAddPanel({ dom, inspector, model, commands, lifetime });
    bindItemResizeEscape({ dom, interactions, interactionState, lifetime });
    bindItemResizeBlur({ dom, interactions, lifetime });
    bindSwapMode({ dom, interactions });
    bindMoveCancel({ dom, interactions });
    bindMovePreviewKeydown({ dom, interactions, interactionState, lifetime });
    bindMovePreviewKeyup({ dom, interactions, interactionState, lifetime });
    bindItemDimensions({ dom, camera, interactions, inspector, lifetime });
    bindItemPanelClose({ dom, inspector });
    bindItemPanel({ dom, interactions, inspector, selectionState, geometry, model, commands, lifetime });
    populateStoragePurposes({ dom, });
    bindItemPurpose({ dom, model, commands });
    bindEmptySceneDismiss({ dom, plannerState });
    bindLaunchWizard({ dom, planner });
    bindEmptySceneLaunch({ dom, planner });
    bindCloseWizard({ dom, planner });
    bindWizardInputs({ dom, planner, lifetime });
    bindIdeaApply({ dom, planner, shell, plannerState, geometry, commands });
    bindWizardBackdropClose({ dom, planner, lifetime });
    bindWizardFocusTrap({ dom, lifetime });
    addToolbarSeparator({ dom, });
    renderDoorChoices({ dom, });
    shellBindings.bindFurnitureButtons({ dom, inspector, shell, camera, lifetime });
    shellBindings.bindDropdownOpen({ dom, shell, lifetime });
    shellBindings.bindHelpMenu({ dom, shell, lifetime });
    shellBindings.bindResetClosesDropdown({ dom, shell, lifetime });
    shellBindings.bindDropdownOutsideClose({ dom, shell, lifetime });
    shellBindings.bindDropdownEscape({ dom, shell, lifetime });
    shellBindings.bindPlanPanel({ dom, shell, lifetime });
    shellBindings.bindDocumentFocusin({ dom, camera, lifetime });
    shellBindings.bindZoomIn({ dom, camera });
    shellBindings.bindZoomOut({ dom, camera });
    shellBindings.bindPropertiesToggle({ dom, inspector, shell, lifetime, elements });
    shellBindings.observeInspectorPanels({ dom, shell, lifetime });
    shellBindings.bindResponsiveInspectors({ dom, inspector, model, lifetime, elements });
    shellBindings.bindRemoveWardrobe({ dom, camera, interactions, inspector, shell, interactionState, selectionState, model, sceneCommands });
    shellBindings.bindDividerDup({ dom, commands });
    shellBindings.bindCanvasHintDismiss({ dom, lifetime });
    renderState.itemEdgeHandles = ['left', 'right', 'top', 'bottom'].map(edge => {
        const vertical = edge === 'top' || edge === 'bottom';
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'item-resize-handle';
        handle.dataset.edge = edge;
        handle.hidden = true;
        handle.setAttribute('aria-label', vertical ? 'Resize item height from the ' + edge : 'Resize item width from ' + edge);
        handle.title = vertical ? 'Drag to resize height' : 'Drag to resize width';
        handle.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (vertical ? 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4' : 'M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4') + '"/></svg>';
        $('#item-resize-handles').appendChild(handle);
        handle.onpointerdown = e => interactions.beginItemEdgeResize(e, edge, handle);
        handle.onpointermove = interactions.moveItemEdgeResize;
        handle.onpointerup = e => {
            if (interactionState.itemEdgeGesture?.pointer === e.pointerId) {
                interactions.finishItemEdgeResize();
            }
        };
        handle.onpointercancel = () => interactions.finishItemEdgeResize(true);
        handle.onlostpointercapture = () => {
            if (interactionState.itemEdgeGesture?.handle === handle) {
                interactions.finishItemEdgeResize(true);
            }
        };
        handle.onkeydown = e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                return;
            }
            e.preventDefault();
            const g = geometry.itemGeom(model.activeCabinet().state.sel, model.activeCabinet().state.item);
            if (!g) {
                return;
            }
            const it = model.activeCabinet().state.secs[model.activeCabinet().state.sel][model.activeCabinet().state.item], target = geometry.itemEdgeSize(g, edge, (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? .5 : 1), geometry.resizeObstacles(model.activeCabinet().state.sel), model.activeCabinet().state.item, geometry.itemMinW(it), geometry.effectiveMin(it.k), Math.min(MODS[it.k].mx, it.h + g.freeTop));
            commands.run(() => {
                if (commands.applyItemEdgeSize({ edge, g, index: model.activeCabinet().state.item, section: model.activeCabinet().state.sel, layout: geometry.resizeObstacles(model.activeCabinet().state.sel), original: model.activeCabinet().state.secs[model.activeCabinet().state.sel] }, target)) {
                    shellState.G.tune = 1;
                }
            });
        };
        return handle;
    });
    $('#toolbar').append($('#undo2'), $('#redo2'));
    // Group the existing wardrobe controls without replacing their bindings.
    const body = $('#left-body');
    let group;
    for (const child of [...body.children]) {
        if (child.tagName === 'H2' || !group || child.classList.contains('reset-row')) {
            group = document.createElement('section');
            const label = child.textContent.trim();
            group.dataset.wardrobeControls = child.classList.contains('reset-row') ? 'reset' : ({Size:'resize',Shape:'shape',Sections:'sections',Finish:'material',Doors:'doors'}[label] || 'resize');
            body.insertBefore(group,child);
        }
        group.append(child);
    }
    const leftHeader = document.createElement('div');
    leftHeader.className = 'ph left-ph';
    const leftTitle = document.createElement('b');
    leftTitle.id = 'left-title';
    leftTitle.textContent = 'Size';
    const leftBtns = document.createElement('span');
    leftBtns.className = 'pbtns';
    const leftClose = document.createElement('button');
    leftClose.id = 'left-close';
    leftClose.type = 'button';
    leftClose.setAttribute('aria-label', 'Close settings');
    leftClose.title = 'Close';
    leftClose.textContent = '×';
    leftClose.onclick = () => {
        animateMobileSheetClose($('#left'));
        elements.app.classList.add('props-hidden');
        elements.app.classList.remove('props-open');
        elements.propsButton.setAttribute('aria-expanded', 'false');
        elements.propsButton.setAttribute('aria-pressed', 'false');
    };
    leftBtns.append(leftClose);
    leftHeader.append(leftTitle, leftBtns);
    $('#left').prepend(leftHeader);
    // Size and Shape are tabs of one sheet for furniture whose top can be reshaped (wardrobes).
    const sizeTabs = document.createElement('div');
    sizeTabs.className = 'size-tabs';
    sizeTabs.setAttribute('role', 'tablist');
    sizeTabs.setAttribute('aria-label', 'Size or shape');
    for (const [key, label] of [['resize', 'Size'], ['shape', 'Shape']]) {
        const tab = document.createElement('button');
        tab.type = 'button'; tab.dataset.sizeTab = key; tab.setAttribute('role', 'tab'); tab.textContent = label;
        tab.onclick = () => { if ($('#left').dataset.contextSection !== key) key === 'shape' ? openShape() : resize.open(); };
        sizeTabs.append(tab);
    }
    $('#left-body').prepend(sizeTabs);
    const sectionTitles = { resize: 'Size', shape: 'Size', sections: 'Sections', material: 'Finish', doors: 'Doors', fronts: 'Fronts' };
    const openControls = key => {
        if (elements.app.classList.contains('props-open') && $('#left').dataset.contextSection === key) {
            animateMobileSheetClose($('#left'));
            elements.app.classList.add('props-hidden');
            elements.app.classList.remove('props-open');
            return;
        }
        inspector.hidePop();
        // Size and Shape measure the whole piece: leave the space chosen inside, so its W, H and D show as controls.
        const whole = (key === 'resize' || key === 'shape') && (selectionState.deep || model.activeCabinet().state.space);
        if (whole) { selectionState.deep = false; model.activeCabinet().state.space = null; }
        const leaveShape = key !== 'shape' && selectionState.shapeEditing;
        if (leaveShape) selectionState.shapeEditing = false;
        if (whole || leaveShape) rendering.build();
        takeMobilePanel(dom, $('#left'));
        delete $('#left').dataset.roomResize;
        $('#left').dataset.contextSection = key;
        const module = furnitureModule(model.activeCabinet().state);
        $('#left').toggleAttribute('data-shaped', module.shaped);
        $('#left').toggleAttribute('data-whole-doors', module.wholeDoors);
        sizeTabs.querySelectorAll('[data-size-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab.getAttribute('data-size-tab') === key)));
        leftTitle.textContent = sectionTitles[key] || ($('#left').dataset.studioResize ? 'Wall Size' : 'Settings');
        elements.app.classList.add('props-open');
        elements.app.classList.remove('props-hidden', 'inspecting', 'adding');
        $('#left').scrollTop = 0;
        camera.frameMobileInspector(key === 'shape');
    };
    // The shape sheet opens with its panel list and break-point handles.
    const openShape = () => { openControls('shape'); if (!selectionState.shapeEditing) { selectionState.shapeEditing = true; inspector.update(true); } };
    const resize = createResizePresenter({
        getSelection: () => model.activeCabinet().state,
        prepare: target => {
            const panel = $({wardrobe:'#left',item:'#pop3',divider:'#pop4'}[target]);
            panel.dataset.sheetPosition = 'compact';
            panel.scrollTop = 0;
            selectionState.popMin = false;
        },
        openWardrobe: () => openControls('resize'),
        openItem: () => inspector.showPop(null, '#pop3', 'resize'),
        openDivider: () => inspector.showPop(null, '#pop4', 'resize'),
    });
    const viewModes = createViewModes({ dom, selectionState, camera, inspector, shell, planner, lifetime });
    createContextualToolbar({document, root:$('#toolbar'), app:elements.app, undo:$('#undo2'), redo:$('#redo2'), lifetime, autoDesign:$('#launch-wizard'),
        // A selected wall or opening of the room has its own actions.
        getSelection: () => {
            viewModes.sync();
            if (selectionState.viewMode === 'studio') return selectionState.room?.kind ?? 'studio';
            if (!selectionState.focusOn || !model.scene.wardrobes.length) return 'none';
            const state = model.activeCabinet().state;
            return state.divider >= 0 ? 'divider' : state.item >= 0 ? 'item' : isFixture(state) ? 'fixture' : furnitureKind(state);
        },
        replacements: () => { const state = model.activeCabinet().state, module = furnitureModule(state);
            return Object.entries(MODS).filter(([key]) => key !== 'void' && module.allows(key, state)).map(([key,value]) => ['t-' + key,value.n]); },
        controls: key => {
            if (key === 'ceiling' || key === 'ceiling-shape') return [room.ceilingChoices.root];
            const divider = model.activeCabinet().state.divider >= 0;
            if (key === 'stores') {
                if (divider) return [];
                inspector.itemUI(true);
                return [$('#ipurpose')];
            }
            return [];
        },
        execute: key => {
            if (key === 'wall-paint') {
                if (elements.app.classList.contains('props-open') && $('#left').dataset.contextSection === 'material') {
                    animateMobileSheetClose($('#left'));
                    elements.app.classList.add('props-hidden');
                    elements.app.classList.remove('props-open');
                    return;
                }
                room.resizePanel.openPaint();
                leftTitle.textContent = 'Paint & Finish';
                return;
            }
            if (key === 'walls') {
                if ($('#pop2').classList.contains('show')) { inspector.hidePop(); return; }
                $('#walls-btn').click(); return;
            }
            if (selectionState.viewMode === 'studio' && OPENING_KINDS.includes(key)) {
                room.actOnWall(key); return;
            }
            if (['wall-size', 'opening-size', 'ceiling-size'].includes(key)) {
                leftTitle.textContent = 'Wall Size';
                room.resizePanel.open(); return;
            }
            if (selectionState.room?.kind === 'wall' && key === 'wardrobe-here') { const wall = selectionState.room.id; inspector.addCabinet(false, undefined, wall); return; }
            if (key === 'new' && selectionState.room?.kind === 'wall') {
                if ($('#pop2').classList.contains('show') && $('#pop2').dataset.addContext === 'wall') { inspector.hidePop(); return; }
                shellBindings.openSceneAdd({ dom, inspector, shell }, 'wall'); return;
            }
            if (selectionState.room) { room.editor.act(key); return; }
            const state = model.activeCabinet().state;
            if (key === 'resize') {
                if (elements.app.classList.contains('props-open') && $('#left').dataset.contextSection === 'resize') {
                    animateMobileSheetClose($('#left'));
                    elements.app.classList.add('props-hidden');
                    elements.app.classList.remove('props-open');
                    return;
                }
                leftTitle.textContent = 'Size';
                resize.open(); return;
            }
            if (key.startsWith('t-')) { inspector.itemAction(key); return; }
            // Another of the selected kind: a new wardrobe or kitchen cabinet, chosen in the Add sheet.
            if (key === 'new') { shellBindings.openSceneAdd({ dom, inspector, shell }, furnitureKind(state)); return; }
            // Add item fills the selected section, as the + on the model does.
            if (key === 'add-item') { inspector.showPop(null, '#pop2'); return; }
            if (key === 'shape') { openShape(); return; }
            if (key === 'duplicate') {
                if (state.divider >= 0) commands.duplicateDivider();
                else if (state.item >= 0) inspector.itemAction('dup');
                else inspector.addCabinet(true);
            } else if (key === 'remove') {
                if (state.divider >= 0) $('#divider-remove').click();
                else if (state.item >= 0) inspector.itemAction('del');
                else $('#remove-wardrobe').click();
            } else if (key === 'reset') $('#reset-all').click();
            else openControls(key);
        }
    });
    $('#menu-btn').innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/></svg>';
    (() => {
        const k = (a, b) => '<kbd>' + a + '</kbd><span>' + b + '</span>', h = t => '<h3>' + t + '</h3>';
        const keysOf = product => '<div class="kc">' + Object.entries(MODS).filter(([key]) => fittingProduct(key) === product).map(([, m]) => '<span><kbd>' + m.k + '</kbd>' + m.n + '</span>').join('') + '</div>';
        document.getElementById('keys').innerHTML = h('Add to the selected section') + keysOf('wardrobe') + h('Add to a kitchen cabinet') + keysOf('kitchen')
            + h('Move around') + k('← →', 'Previous / next section') + k('↑ ↓', 'Next item up / down') + k('Esc', 'Deselect or cancel a move')
            + h('Edit') + k('⌫', 'Remove the selected item') + k('Shift + arrows', 'Move the selected item or divider') + k('Ctrl/⌘ Z', 'Undo') + k('Ctrl/⌘ ⇧ Z', 'Redo')
            + h('Mouse and touch') + k('Click', 'Select a section or item') + k('Drag item', 'Move freely, view turns to the front · Alt = no snap · Shift-drag swaps') + k('Drag background', 'Orbit') + k('Scroll / pinch', 'Zoom');
    })();
}
