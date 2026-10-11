/** Explicit dependencies consumed by ./history.js. */
export interface BindUndo2Ports {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'undo'>>;
}

export interface BindRedo2Ports {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'redo'>>;
}

export interface BindWindowKeydown2Ports {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'redo' | 'undo'>>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'focusOn'>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'duplicateItem'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
