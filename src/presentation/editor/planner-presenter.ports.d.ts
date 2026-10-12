/** Explicit dependencies consumed by this module. */
export interface CreatePlannerPresenterPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly plannerState: Pick<ReturnType<typeof import('./planner-state.js').createPlannerState>, 'emptyDismissed' | 'ideas' | 'ideasConfig' | 'ideasTimer' | 'openRaf' | 'openTimer' | 'wizardTrigger' | 'pendingKey' | 'prewarmTimer'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'ih' | 'plannerConfig' | 'stats'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setPreferences'>>;
readonly plannerService: Readonly<Pick<ReturnType<typeof import('../../application/projects/planner-service.js').createPlannerService>, 'generate' | 'has' | 'store'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'cancelFrame' | 'cancelTimeout' | 'frame' | 'timeout'>>;
}
