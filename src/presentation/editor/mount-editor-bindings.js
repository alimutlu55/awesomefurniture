import { takeMobilePanel } from './mobile-panel-owner.js';
import { createContextualToolbar } from './contextual-toolbar.js';
import { createResizePresenter } from './resize-presenter.js';
import { mountResizeFields } from './resize-fields.js';
import { bindDividerClose, bindDividerGap, bindDividerHeight, bindDividerRemove, bindDividerDragMove, bindDividerDragEnd, bindDividerDragCancel, bindDividerDragBlur, bindDividerDragEscape } from './bindings/divider.js';
import { bindSecMinus, bindSecPlus, bindSectionDiagram } from './bindings/sections.js';
import { bindCabinetDimensions, bindFinishSwatches, bindReachChange, bindReachBlur, bindReachEnter, bindReachLineToggle, bindDoorChoice, renderDoorChoices, bindDoorsOpenToggle, bindWardrobeSelect, bindWardrobeAdd, bindResetAll } from './bindings/cabinet.js';
import { bindMoreAddMenu, bindPillAddMenu, bindPillMenuDismiss, bindAddPanel } from './bindings/add-menu.js';
import { bindUndoButton, bindRedoButton, bindEditShortcuts } from './bindings/history.js';
import { bindItemResizeEscape, bindItemResizeBlur, bindItemDimensions, bindItemPanelClose, bindItemPanel, populateStoragePurposes, bindItemPurpose } from './bindings/item.js';
import { bindMoveMode, bindSwapMode, bindMoveCancel, bindMoveBay, bindMoveSlot, bindMoveApply, bindMovePreviewKeydown, bindMovePreviewKeyup } from './bindings/move.js';
import { bindEmptySceneDismiss, bindLaunchWizard, bindEmptySceneLaunch, bindCloseWizard, bindWizardInputs, bindIdeaApply, bindWizardBackdropClose, bindWizardFocusTrap } from './bindings/wizard.js';
import { bindColorSchemeChange, addToolbarSeparator, bindPanelMinimize, bindPanelHeaderDrag, bindPropertiesPanelClose } from './bindings/panels.js';
import { observeViewportSize, bindCanvasPointerdown, bindCanvasPointermove, bindCanvasPointerup, bindCanvasPointercancel, bindCanvasLostpointercapture, bindCanvasGestureBlur, bindCanvasWheel, bindCanvasPointerleave, bindCanvasGestureEscape } from './bindings/canvas.js';
import { bindItemMenus } from './bindings/item-menus.js';
import { bindEscapeKey } from './bindings/keyboard.js';
import * as wizardBindings from './wizard-bindings.js';
import * as shellBindings from './shell-bindings.js';
import { MODS } from '../../domain/wardrobe/catalog.js';
/** @param {import('./mount-editor-bindings.ports').MountEditorBindingsPorts} ports */
export function mountEditorBindings({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState, renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements, room }) {
    const { $, document } = dom;
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
    bindCanvasPointerdown({ dom, camera, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime, room: room.surface });
    bindCanvasPointermove({ dom, camera, rendering, interactions, inspector, cameraState, interactionState, resources, lifetime, room: room.surface });
    bindCanvasPointerup({ dom, interactions, shell, interactionState, resources, lifetime, room: room.surface });
    bindCanvasPointercancel({ dom, interactions, interactionState, resources, lifetime, room: room.surface });
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
    bindReachChange({ dom, inspector, commands, lifetime });
    bindReachBlur({ dom, inspector, model, commands, lifetime });
    bindReachEnter({ dom, inspector, commands, lifetime });
    bindReachLineToggle({ dom, commands, lifetime });
    bindMoreAddMenu({ dom, shell, commands });
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
    bindResetAll({ dom, inspector, shell, plannerState, sceneCommands });
    bindEscapeKey({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, lifetime });
    bindPanelMinimize({ dom, inspector, selectionState, lifetime });
    bindPanelHeaderDrag({ dom, camera, inspector, cameraState, selectionState, lifetime });
    bindPropertiesPanelClose({ dom, inspector });
    bindAddPanel({ dom, inspector, model, commands, lifetime });
    bindItemResizeEscape({ dom, interactions, interactionState, lifetime });
    bindItemResizeBlur({ dom, interactions, lifetime });
    bindMoveMode({ dom, interactions });
    bindSwapMode({ dom, interactions });
    bindMoveCancel({ dom, interactions });
    bindMoveBay({ dom, inspector });
    bindMoveSlot({ dom, inspector });
    bindMoveApply({ dom, interactions, geometry, model });
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
    shellBindings.bindMoreBtn({ dom, inspector, shell, selectionState, model, camera, lifetime });
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
    renderState.itemEdgeHandles = ['left', 'right', 'top'].map(edge => {
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'item-resize-handle';
        handle.dataset.edge = edge;
        handle.hidden = true;
        handle.setAttribute('aria-label', edge === 'top' ? 'Resize item height' : 'Resize item width from ' + edge);
        handle.title = edge === 'top' ? 'Drag to resize height' : 'Drag to resize width';
        handle.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (edge === 'top' ? 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4' : 'M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4') + '"/></svg>';
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
        if (child.tagName === 'H2' || !group || child.classList.contains('reach-row') || child.classList.contains('reset-row')) {
            group = document.createElement('section');
            const label = child.textContent.trim();
            group.dataset.wardrobeControls = child.classList.contains('reach-row') ? 'reach' : child.classList.contains('reset-row') ? 'reset' : ({Size:'resize',Shape:'shape',Sections:'sections',Finish:'material',Doors:'doors'}[label] || 'resize');
            body.insertBefore(group,child);
        }
        group.append(child);
    }
    const openControls = key => {
        inspector.hidePop();
        if (key !== 'shape' && selectionState.shapeEditing) { selectionState.shapeEditing = false; rendering.build(); }
        takeMobilePanel(dom, $('#left'));
        $('#left').dataset.contextSection = key;
        elements.app.classList.add('props-open');
        elements.app.classList.remove('props-hidden', 'inspecting', 'adding');
        $('#left').scrollTop = 0;
        camera.frameMobileInspector();
        rendering.build();
    };
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
    createContextualToolbar({document, root:$('#toolbar'), app:elements.app, undo:$('#undo2'), redo:$('#redo2'), lifetime,
        // A selected wall or opening of the room has its own actions.
        getSelection: () => {
            if (selectionState.room) return selectionState.room.kind;
            if (!selectionState.focusOn || !model.scene.wardrobes.length) return 'none';
            const state = model.activeCabinet().state;
            return state.item >= 0 || state.divider >= 0 ? 'item' : 'wardrobe';
        },
        replacements: () => Object.entries(MODS).filter(([key]) => key !== 'void').map(([key,value]) => ['t-' + key,value.n]),
        controls: key => {
            if (key === 'wall-size' || key === 'opening-size' || key === 'ceiling-size') { room.fields.render(); return [room.fields.root]; }
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
            if (selectionState.room?.kind === 'wall' && key === 'wardrobe-here') { const wall = selectionState.room.id; selectionState.room = null; inspector.addCabinet(false, undefined, wall); return; }
            if (selectionState.room) { room.editor.act(key); return; }
            const state = model.activeCabinet().state;
            delete elements.app.dataset.toolbarMode;
            if (key === 'resize') { resize.open(); return; }
            if (key.startsWith('t-')) { inspector.itemAction(key); return; }
            if (key === 'duplicate') {
                if (state.divider >= 0) commands.duplicateDivider();
                else if (state.item >= 0) inspector.itemAction('dup');
                else inspector.addCabinet(true);
            } else if (key === 'remove') {
                if (state.divider >= 0) $('#divider-remove').click();
                else if (state.item >= 0) inspector.itemAction('del');
                else $('#remove-wardrobe').click();
            } else if (key === 'reset') $('#reset-all').click();
            else if (key === 'move') {
                inspector.hidePop(); elements.app.classList.remove('props-open');
                elements.app.dataset.toolbarMode = 'move';
                // Ease back and rise a little so the floor around the wardrobe shows where it can go.
                camera.moveOverview();
                selectionState.deep = true; selectionState.pillOn = true;
                inspector.update();
            } else {
                openControls(key);
                // The shape sheet opens with its panel list and break-point handles.
                if (key === 'shape' && !selectionState.shapeEditing) { selectionState.shapeEditing = true; inspector.update(true); }
            }
        }
    });
    $('#menu-btn').innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/></svg>';
    (() => {
        const k = (a, b) => '<kbd>' + a + '</kbd><span>' + b + '</span>', h = t => '<h3>' + t + '</h3>';
        document.getElementById('keys').innerHTML = h('Add to the selected section') + '<div class="kc">' + Object.values(MODS).map(m => '<span><kbd>' + m.k + '</kbd>' + m.n + '</span>').join('') + '</div>'
            + h('Move around') + k('← →', 'Previous / next section') + k('↑ ↓', 'Next item up / down') + k('Esc', 'Deselect or cancel a move')
            + h('Edit') + k('⌫', 'Remove the selected item') + k('Shift + arrows', 'Move the selected item') + k('Ctrl/⌘ Z', 'Undo') + k('Ctrl/⌘ ⇧ Z', 'Redo')
            + h('Mouse and touch') + k('Click', 'Select a section or item') + k('Drag item', 'Move freely, view turns to the front · Alt = no snap · Shift-drag swaps') + k('Drag background', 'Orbit') + k('Scroll / pinch', 'Zoom');
    })();
}
