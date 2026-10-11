/** Explicit dependencies consumed by ./divider.js. */
export interface BindDividerClosePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}

export interface BindDividerGapPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../../viewport/cabinet-renderer.js').createCabinetRenderer>, 'positionLabels' | 'refreshDividerVisual'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'dividerUI' | 'histUI'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerMeasurements'>>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'snapshot'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'setDividerClearance'>>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../../application/history/scene-history.js').createSceneHistory>, 'checkpoint'>>;
}

export interface BindDividerHeightPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'dividerUI' | 'update'>>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'setDividerHeight'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
}

export interface BindDividerRemovePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'removeDivider'>>;
}

export interface BindDividerDragMovePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'moveDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDividerDragEndPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDividerDragCancelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDividerDragBlurPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDividerDragEscapePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'dividerGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
