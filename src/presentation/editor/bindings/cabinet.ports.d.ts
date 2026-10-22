/** Explicit dependencies consumed by ./cabinet.js. */
export interface BindCabinetDimensionsPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../../viewport/cabinet-renderer.js').createCabinetRenderer>, 'build'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'update'>>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'editingSize'>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'snapshot' | 'restore' | 'scene'>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../../application/history/scene-history.js').createSceneHistory>, 'checkpoint'>>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/scene-commands.js').createSceneCommands>, 'setCabinetSize' | 'setCabinetPose' | 'previewTranslation' | 'fillSpace'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindFinishSwatchesPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'setDecor' | 'setLinkedDecors' | 'setHandleFinish' | 'setAccessoryFinish'>>;
}

export interface BindDoorChoicePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'setDoors' | 'setDoorHang'>>;
}

export interface RenderDoorChoicesPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;

}

export interface BindDoorsOpenTogglePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
}

export interface BindWardrobeSelectPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'selectCabinet'>>;
}

export interface BindWardrobeAddPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'addCabinet'>>;
}

export interface BindResetAllPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'hidePop' | 'update'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
readonly plannerState: Pick<ReturnType<typeof import('../planner-state.js').createPlannerState>, 'emptyDismissed'>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/scene-commands.js').createSceneCommands>, 'resetCabinet'>>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
}
