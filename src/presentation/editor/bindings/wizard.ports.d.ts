/** Explicit dependencies consumed by ./wizard.js. */
export interface BindEmptySceneDismissPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly plannerState: Pick<ReturnType<typeof import('../planner-state.js').createPlannerState>, 'emptyDismissed'>;
}

export interface BindLaunchWizardPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'openWizard'>>;
}

export interface BindEmptySceneLaunchPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'openWizard'>>;
}

export interface BindCloseWizardPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
}

export interface BindWizardInputsPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'markIdeasDirty'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindIdeaApplyPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'closeWizard' | 'readPreferences' | 'refreshIdeas'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
readonly plannerState: Pick<ReturnType<typeof import('../planner-state.js').createPlannerState>, 'ideas' | 'ideasConfig'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'plannerConfig'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'applyProposal'>>;
}

export interface BindWizardBackdropClosePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('../planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWizardFocusTrapPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
