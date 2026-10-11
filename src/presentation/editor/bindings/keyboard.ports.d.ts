/** Explicit dependencies consumed by ./keyboard.js. */
export interface BindWindowKeydown4Ports {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'keyboardMove'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'clearFocus' | 'goUp' | 'hidePop' | 'update'>>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'drag' | 'moveMode' | 'moved' | 'ptrs'>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'deep' | 'focusOn' | 'pillOn'>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'addMod' | 'removeTop'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
