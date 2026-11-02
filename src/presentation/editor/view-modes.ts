interface ViewModePorts {
    dom: ReturnType<typeof import('./editor-dom').createEditorDom>;
    selectionState: ReturnType<typeof import('./selection-state.js').createSelectionState>;
    camera: Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'frameScene'>;
    inspector: Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'clearFocus' | 'update'>;
    shell: Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>;
    planner: Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard'>;
    lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>;
    onStudioFormatChange?: (format: '2d' | '3d') => void;
}

/** Modes own selection scope; changing a view never changes the design or its history. */
export function createViewModes({ dom, selectionState, camera, inspector, shell, planner, lifetime, onStudioFormatChange }: ViewModePorts) {
    const { $ } = dom;
    const switcher = $('#view-modes');

    // Create 2D/3D segmented format toggle for Studio section if DOM supports it
    if (switcher?.querySelector && switcher?.appendChild && dom.document?.createElement) {
        let formatSeg = switcher.querySelector<HTMLSpanElement>('.studio-format-seg');
        if (!formatSeg) {
            formatSeg = dom.document.createElement('span');
            formatSeg.className = 'studio-format-seg';
            formatSeg.setAttribute('role', 'group');
            formatSeg.setAttribute('aria-label', 'Studio view format');
            formatSeg.innerHTML = `
                <button type="button" data-studio-format="2d" aria-pressed="false">2D</button>
                <button type="button" data-studio-format="3d" aria-pressed="true">3D</button>
            `;
            switcher.appendChild(formatSeg);
        }
    }

    const sync = () => {
        if (selectionState.viewMode !== 'studio') selectionState.studioView = '3d';
        $('#app').dataset.viewMode = selectionState.viewMode;
        $('#app').dataset.studioView = selectionState.studioView || '3d';
        if (selectionState.viewMode === 'studio' && !$('#app').classList.contains('props-open')) {
            $('#app').classList.add('props-hidden');
        }
        switcher?.querySelectorAll<HTMLButtonElement>('button[data-view-mode]').forEach(button => {
            if (button.dataset.viewMode !== undefined) {
                button.setAttribute('aria-pressed', String(button.dataset.viewMode === selectionState.viewMode));
            }
        });
        switcher?.querySelectorAll<HTMLButtonElement>('button[data-studio-format]').forEach(button => {
            if (button.dataset.studioFormat !== undefined) {
                button.setAttribute('aria-pressed', String(button.dataset.studioFormat === (selectionState.studioView || '3d')));
            }
        });
    };

    const setStudioFormat = (format: '2d' | '3d') => {
        if (selectionState.viewMode !== 'studio') return;
        if (selectionState.studioView === format) return;
        selectionState.studioView = format;
        sync();
        onStudioFormatChange?.(format);
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
        if (mode === 'studio' && selectionState.studioView === '2d') {
            onStudioFormatChange?.('2d');
        } else {
            if (onStudioFormatChange) onStudioFormatChange('3d');
            else camera.frameScene();
        }
    };

    lifetime.listen(switcher, 'click', (e: Event) => {
        const target = e.target as Element;
        const modeBtn = target.closest<HTMLButtonElement>('button[data-view-mode]');
        if (modeBtn && (modeBtn.dataset.viewMode === 'studio' || modeBtn.dataset.viewMode === 'furniture')) {
            change(modeBtn.dataset.viewMode);
            return;
        }
        const formatBtn = target.closest<HTMLButtonElement>('button[data-studio-format]');
        const format = formatBtn?.dataset.studioFormat;
        if (format === '2d' || format === '3d') {
            setStudioFormat(format);
        }
    });

    sync();
    return { change, sync, setStudioFormat };
}
