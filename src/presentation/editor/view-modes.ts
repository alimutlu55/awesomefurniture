interface ViewModePorts {
    dom: ReturnType<typeof import('./editor-dom').createEditorDom>;
    selectionState: ReturnType<typeof import('./selection-state.js').createSelectionState>;
    camera: Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'frameScene' | 'frameWardrobe'>;
    inspector: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'clearFocus' | 'update'>;
    shell: Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>;
    planner: Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard'>;
    lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>;
}

/** Modes own selection scope; changing a view never changes the design or its history. */
export function createViewModes({ dom, selectionState, camera, inspector, shell, planner, lifetime }: ViewModePorts) {
    const { $ } = dom;
    const switcher = $('#view-modes');
    const sync = () => {
        $('#app').dataset.viewMode = selectionState.viewMode;
        if (selectionState.viewMode === 'studio' && !$('#app').classList.contains('props-open')) $('#app').classList.add('props-hidden');
        switcher.querySelectorAll<HTMLButtonElement>('[data-view-mode]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.viewMode === selectionState.viewMode));
        });
    };
    const change = (mode: 'studio' | 'furniture') => {
        if (selectionState.viewMode === mode) return;
        shell.closeDD();
        if (!$('#wizard').hidden) planner.closeWizard();
        selectionState.pendingStudioAction = null;
        selectionState.room = null;
        selectionState.viewMode = mode;
        inspector.clearFocus();
        $('#app').classList.remove('props-open');
        $('#app').classList.add('props-hidden');
        sync();
        inspector.update(true);
        if (mode === 'studio') camera.frameScene(); else camera.frameWardrobe();
    };
    lifetime.listen(switcher, 'click', (e: Event) => {
        const mode = (e.target as Element).closest<HTMLButtonElement>('[data-view-mode]')?.dataset.viewMode;
        if (mode === 'studio' || mode === 'furniture') change(mode);
    });
    sync();
    return { change, sync };
}
