/** Explicit dependencies consumed by ./add-menu.js. */
export interface BindMoreAddMenuPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'addMod'>>;
}

export interface BindPillAddMenuPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'addMod'>>;
readonly elements: Pick<ReturnType<typeof import('../editor-dom.js').getEditorElements>, 'pillMenu'>;
}

export interface BindPillMenuDismissPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly elements: Pick<ReturnType<typeof import('../editor-dom.js').getEditorElements>, 'pillMenu'>;
}

export interface BindAddPanelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'itemUI' | 'showPop' | 'swapPop' | 'update'>>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'addMod' | 'addPossessionShelf' | 'addSpaceDivider' | 'autofill' | 'clearSection' | 'run'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
