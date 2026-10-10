/** Explicit dependencies consumed by this module. */
export interface BindInspectorControlsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'theme'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDividerClosePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}

export interface BindDgapPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'positionLabels' | 'refreshDividerVisual'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'dividerUI' | 'histUI'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerMeasurements'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'snapshot'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setDividerClearance'>>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../application/history/scene-history.js').createSceneHistory>, 'checkpoint'>>;
}

export interface BindDividerRemovePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'removeDivider'>>;
}

export interface BindWindowPointermovePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'moveDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowPointerupPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowPointercancelPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowBlurPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowKeydownPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishDividerDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindSecMinusPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'changeSections'>>;
}

export interface BindSecPlusPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'changeSections'>>;
}

export interface BindSectionDiagramPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'update'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCabinetDimensionsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'build'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'update'>>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'editingSize'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'snapshot' | 'restore'>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../application/history/scene-history.js').createSceneHistory>, 'checkpoint'>>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>, 'setCabinetSize'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindFinishSwatchesPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setFinish'>>;
}

export interface BindWardrobeReachPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'reachUI'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setWardrobeReach'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWardrobeReach2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'reachUI'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setWardrobeReach'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWardrobeReach3Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'reachUI'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setWardrobeReach'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWardrobeReachLinePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setReachLine'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindMoreAddMenuPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'addMod'>>;
}

export interface BindPillAddMenuPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'addMod'>>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'pillMenu'>;
}

export interface BindWindowPointerdownPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'pillMenu'>;
}

export interface BindDataDPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'setDoors'>>;
}

export interface BindOpenPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
}

export interface BindUndo2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'undo'>>;
}

export interface BindRedo2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'redo'>>;
}

export interface BindWindowKeydown2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'redo' | 'undo'>>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'focusOn'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'duplicateItem'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWardrobeSelectPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'selectCabinet'>>;
}

export interface BindWardrobeAddPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'addCabinet'>>;
}

export interface BindWindowKeydown5Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishItemEdgeResize'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'itemEdgeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowBlur3Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishItemEdgeResize'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindMoveModePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'armMovement'>>;
}

export interface BindSwapModePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'armMovement'>>;
}

export interface BindMoveCancelPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement'>>;
}

export interface BindMoveBayPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'moveSlotUI'>>;
}

export interface BindMoveSlotPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'moveSlotUI'>>;
}

export interface BindMoveApplyPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'performMove'>>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'planItemMove'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
}

export interface BindWindowKeydown6Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'previewAt'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'drag' | 'lastMoveEvent' | 'moveMode'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowKeyupPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'previewAt'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'drag' | 'lastMoveEvent' | 'moveMode'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindItemDimensionsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'setManualItemSize'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'itemUI'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindIxPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}

export interface BindPop3Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'performMove'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'update'>>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'pillOn'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'planItemMove' | 'verticalNeighbor'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'deleteItem' | 'duplicateItem' | 'editItem'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface PopulateStoragePurposesPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;

}

export interface BindIpurposePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'editItem'>>;
}

export interface BindEmptyXPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly plannerState: Pick<ReturnType<typeof import('./planner-state.js').createPlannerState>, 'emptyDismissed'>;
}

export interface BindLaunchWizardPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'openWizard'>>;
}

export interface BindEmptyLaunchPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'openWizard'>>;
}

export interface BindCloseWizardPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
}

export interface BindWizardPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'markIdeasDirty'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindIdeasPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard' | 'readPreferences' | 'refreshIdeas'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly plannerState: Pick<ReturnType<typeof import('./planner-state.js').createPlannerState>, 'ideas' | 'ideasConfig'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'plannerConfig'>>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'applyProposal'>>;
}

export interface BindWizard2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWizard3Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindToolbarPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;

}

export interface BindDataD2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;

}
