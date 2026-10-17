import { createPlannerState } from './planner-state.js';
import { createShellState } from './shell-state.js';
import { dismissMobileSheetExits } from './mobile-sheet-motion.js';

type BindingPorts = import('./mount-editor-bindings.ports').MountEditorBindingsPorts;
type ResetPorts = Pick<BindingPorts, 'dom' | 'selectionState' | 'interactionState' | 'plannerState' | 'shellState' |
    'inspector' | 'interactions' | 'planner' | 'shell' | 'camera' | 'sceneCommands' | 'lifetime'>;

/** Reset the full design and its transient tools, without reloading or affecting other editor instances. */
export function bindSceneReset({ dom, selectionState, interactionState, plannerState, shellState, inspector,
    interactions, planner, shell, camera, sceneCommands, lifetime }: ResetPorts) {
    const { $ } = dom;
    lifetime.listen($('#reset-scene'), 'click', () => {
        interactions.finishItemEdgeResize(true);
        interactions.finishDividerDrag(true);
        interactions.finishWardrobeDrag(true);
        interactions.finishRotation(true);
        interactions.cancelMovement();
        interactionState.ptrs.clear();
        interactionState.panGesture = null;
        if (!$('#wizard').hidden) planner.closeWizard();
        shell.closeDD();
        inspector.closeItemMenus();
        inspector.hidePop();
        for (const timer of [plannerState.ideasTimer, plannerState.openTimer, plannerState.prewarmTimer]) lifetime.cancelTimeout(timer);
        lifetime.cancelFrame(plannerState.openRaf);
        Object.assign(plannerState, createPlannerState());
        Object.assign(shellState, createShellState());
        sceneCommands.resetScene();
        selectionState.viewMode = 'furniture';
        selectionState.room = null;
        selectionState.pendingStudioAction = null;
        selectionState.editingSize = false;
        selectionState.popMin = false;
        selectionState.addKey = null;
        selectionState.showDimensions = true;
        inspector.clearFocus();
        const app = $('#app');
        app.classList.remove('props-open', 'inspecting', 'adding', 'auto-design-open');
        app.classList.add('props-hidden');
        app.inert = false;
        dismissMobileSheetExits(app);
        planner.syncPreferences();
        camera.frameScene({ instant: true });
        camera.resize();
        inspector.histUI();
        shell.toast('Everything reset. Undo brings your design back.');
    });
}
