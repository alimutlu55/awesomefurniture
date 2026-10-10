import * as inspectorBindings from './inspector-bindings.js';
import * as gestureBindings from './gesture-bindings.js';
import * as wizardBindings from './wizard-bindings.js';
import * as shellBindings from './shell-bindings.js';
import { MODS } from '../../domain/wardrobe/catalog.js';
/** @param {import('./mount-editor-bindings.ports').MountEditorBindingsPorts} ports */
export function mountEditorBindings({ dom, picking, camera, rendering, interactions, inspector, planner, shell, cameraState, interactionState, renderState, selectionState, plannerState, shellState, geometry, resources, model, commands, sceneCommands, history, lifetime, elements }) {
    const { $, document } = dom;
    inspectorBindings.bindInspectorControls({ dom, rendering, lifetime });
    inspectorBindings.bindDividerClose({ dom, inspector });
    inspectorBindings.bindDgap({ dom, rendering, inspector, shell, geometry, model, commands, history });
    inspectorBindings.bindDividerRemove({ dom, commands });
    inspectorBindings.bindWindowPointermove({ dom, interactions, lifetime });
    inspectorBindings.bindWindowPointerup({ dom, interactions, lifetime });
    inspectorBindings.bindWindowPointercancel({ dom, interactions, lifetime });
    inspectorBindings.bindWindowBlur({ dom, interactions, lifetime });
    inspectorBindings.bindWindowKeydown({ dom, interactions, interactionState, lifetime });
    gestureBindings.observeViewportSize({ dom, camera, lifetime });
    gestureBindings.bindCanvasPointerdown({ dom, camera, interactions, inspector, picking, interactionState, renderState, selectionState, resources, model, lifetime });
    gestureBindings.bindCanvasPointermove({ dom, camera, rendering, interactions, inspector, cameraState, interactionState, resources, lifetime });
    gestureBindings.bindCanvasPointerup({ dom, interactions, shell, interactionState, resources, lifetime });
    gestureBindings.bindCanvasPointercancel({ dom, interactions, interactionState, resources, lifetime });
    gestureBindings.bindCanvasLostpointercapture({ dom, interactions, interactionState, resources, lifetime });
    gestureBindings.bindWindowBlur2({ dom, interactions, interactionState, lifetime });
    gestureBindings.bindCanvasWheel({ dom, camera, interactions, interactionState, resources, lifetime });
    gestureBindings.bindCanvasPointerleave({ dom, renderState, resources, lifetime });
    gestureBindings.bindView({ dom, inspector, picking, renderState, selectionState, resources, model, lifetime });
    wizardBindings.bindPlanCapacity({ dom, planner, lifetime });
    inspectorBindings.bindSecMinus({ dom, commands });
    inspectorBindings.bindSecPlus({ dom, commands });
    inspectorBindings.bindSectionDiagram({ dom, inspector, model, lifetime });
    inspectorBindings.bindCabinetDimensions({ dom, rendering, inspector, selectionState, model, sceneCommands, history, lifetime });
    inspectorBindings.bindFinishSwatches({ dom, commands });
    inspectorBindings.bindWardrobeReach({ dom, inspector, commands, lifetime });
    inspectorBindings.bindWardrobeReach2({ dom, inspector, model, commands, lifetime });
    inspectorBindings.bindWardrobeReach3({ dom, inspector, commands, lifetime });
    inspectorBindings.bindWardrobeReachLine({ dom, commands, lifetime });
    inspectorBindings.bindMoreAddMenu({ dom, shell, commands });
    inspectorBindings.bindPillAddMenu({ dom, commands, elements });
    inspectorBindings.bindWindowPointerdown({ dom, lifetime, elements });
    inspectorBindings.bindDataD({ dom, commands });
    inspectorBindings.bindOpen({ dom, model });
    inspectorBindings.bindUndo2({ dom, inspector });
    inspectorBindings.bindRedo2({ dom, inspector });
    inspectorBindings.bindWindowKeydown2({ dom, inspector, selectionState, model, commands, lifetime });
    inspectorBindings.bindWardrobeSelect({ dom, inspector });
    inspectorBindings.bindWardrobeAdd({ dom, inspector });
    gestureBindings.bindWindowKeydown3({ dom, interactions, interactionState, lifetime });
    gestureBindings.bindResetAll({ dom, inspector, shell, plannerState, sceneCommands });
    gestureBindings.bindWindowKeydown4({ dom, interactions, inspector, planner, shell, interactionState, selectionState, model, commands, lifetime });
    gestureBindings.bindPopPmin({ dom, inspector, selectionState, lifetime });
    gestureBindings.bindPopPh({ dom, camera, inspector, cameraState, selectionState, lifetime });
    gestureBindings.bindPx({ dom, inspector });
    gestureBindings.bindPop2({ dom, inspector, model, commands, lifetime });
    inspectorBindings.bindWindowKeydown5({ dom, interactions, interactionState, lifetime });
    inspectorBindings.bindWindowBlur3({ dom, interactions, lifetime });
    inspectorBindings.bindMoveMode({ dom, interactions });
    inspectorBindings.bindSwapMode({ dom, interactions });
    inspectorBindings.bindMoveCancel({ dom, interactions });
    inspectorBindings.bindMoveBay({ dom, inspector });
    inspectorBindings.bindMoveSlot({ dom, inspector });
    inspectorBindings.bindMoveApply({ dom, interactions, geometry, model });
    inspectorBindings.bindWindowKeydown6({ dom, interactions, interactionState, lifetime });
    inspectorBindings.bindWindowKeyup({ dom, interactions, interactionState, lifetime });
    inspectorBindings.bindItemDimensions({ dom, interactions, inspector, lifetime });
    inspectorBindings.bindIx({ dom, inspector });
    inspectorBindings.bindPop3({ dom, interactions, inspector, selectionState, geometry, model, commands, lifetime });
    inspectorBindings.populateStoragePurposes({ dom, });
    inspectorBindings.bindIpurpose({ dom, model, commands });
    inspectorBindings.bindEmptyX({ dom, plannerState });
    inspectorBindings.bindLaunchWizard({ dom, planner });
    inspectorBindings.bindEmptyLaunch({ dom, planner });
    inspectorBindings.bindCloseWizard({ dom, planner });
    inspectorBindings.bindWizard({ dom, planner, lifetime });
    inspectorBindings.bindIdeas({ dom, planner, shell, plannerState, geometry, commands });
    inspectorBindings.bindWizard2({ dom, planner, lifetime });
    inspectorBindings.bindWizard3({ dom, lifetime });
    inspectorBindings.bindToolbar({ dom, });
    inspectorBindings.bindDataD2({ dom, });
    shellBindings.bindMoreBtn({ dom, inspector, shell, selectionState, model, lifetime });
    shellBindings.bindInspectorControls2({ dom, shell, lifetime });
    shellBindings.bindHelpMenu({ dom, shell, lifetime });
    shellBindings.bindInspectorControls3({ dom, shell, lifetime });
    shellBindings.bindWindowPointerdown2({ dom, shell, lifetime });
    shellBindings.bindWindowKeydown7({ dom, shell, lifetime });
    shellBindings.bindPlanPanel({ dom, shell, lifetime });
    shellBindings.bindDocumentFocusin({ dom, camera, lifetime });
    shellBindings.bindZoomIn({ dom, camera });
    shellBindings.bindZoomOut({ dom, camera });
    shellBindings.bindInspectorControls4({ dom, inspector, shell, lifetime, elements });
    shellBindings.observeInspectorPanels({ dom, shell, lifetime });
    shellBindings.bindResponsiveInspectors({ dom, inspector, model, lifetime, elements });
    shellBindings.bindRemoveWardrobe({ dom, camera, interactions, inspector, shell, interactionState, selectionState, model, sceneCommands });
    shellBindings.bindDividerDup({ dom, commands });
    shellBindings.bindC({ dom, lifetime });
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
    $('#menu-btn').innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/></svg>';
    (() => {
        const k = (a, b) => '<kbd>' + a + '</kbd><span>' + b + '</span>', h = t => '<h3>' + t + '</h3>';
        document.getElementById('keys').innerHTML = h('Add to the selected section') + '<div class="kc">' + Object.values(MODS).map(m => '<span><kbd>' + m.k + '</kbd>' + m.n + '</span>').join('') + '</div>'
            + h('Move around') + k('← →', 'Previous / next section') + k('↑ ↓', 'Next item up / down') + k('Esc', 'Deselect or cancel a move')
            + h('Edit') + k('⌫', 'Remove the selected item') + k('Shift + arrows', 'Move the selected item') + k('Ctrl/⌘ Z', 'Undo') + k('Ctrl/⌘ ⇧ Z', 'Redo')
            + h('Mouse and touch') + k('Click', 'Select a section or item') + k('Drag item', 'Move freely, view turns to the front · Alt = no snap · Shift-drag swaps') + k('Drag background', 'Orbit') + k('Scroll / pinch', 'Zoom');
    })();
}
