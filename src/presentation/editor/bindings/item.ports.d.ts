/** Explicit dependencies consumed by ./item.js. */
export interface BindItemResizeEscapePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishItemEdgeResize'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'itemEdgeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindItemResizeBlurPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishItemEdgeResize'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindItemDimensionsPorts {
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'camRelease' | 'moveViewOn' | 'moveViewOff'>>;
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'setManualItemSize'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'itemUI'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindItemPanelClosePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}

export interface BindItemPanelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'performMove'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'update'>>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'pillOn'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'planItemMove' | 'verticalNeighbor'>>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'deleteItem' | 'duplicateItem' | 'editItem'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface PopulateStoragePurposesPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;

}

export interface BindItemPurposePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../../application/commands/design-commands.js').createDesignCommands>, 'editItem'>>;
}
