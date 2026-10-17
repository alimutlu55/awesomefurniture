/** Explicit dependencies consumed by this module. */
export interface BindFurnitureButtonsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'showPop' | 'clearFocus' | 'selectCabinet'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene'>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'frameScene'>>;
/** Frames what was chosen: a wardrobe, or a kitchen cabinet with its run. */
readonly frame: () => void;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDropdownOpenPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'openDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindHelpMenuPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD' | 'openDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindResetClosesDropdownPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDropdownOutsideClosePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDropdownEscapePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPlanPanelPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindDocumentFocusinPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'camRelease'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindZoomInPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'cameraZoom'>>;
}

export interface BindZoomOutPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'cameraZoom'>>;
}

export interface BindPropertiesTogglePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'clearFocus'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'closeDD'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'app' | 'propsButton'>;
}

export interface ObserveInspectorPanelsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'sync'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'observe'>>;
}

export interface BindResponsiveInspectorsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'goUp' | 'hidePop' | 'syncResponsive'>>;
readonly model: ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen' | 'cleanup'>>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'app' | 'propsButton'>;
}

export interface BindRemoveWardrobePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'fit'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop' | 'update'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'rotationGesture' | 'wardrobeGesture'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'deep' | 'pillOn' | 'shapeEditing'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'scene'>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>, 'removeCabinet'>>;
}

export interface BindDividerDupPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'duplicateDivider'>>;
}

export interface BindCanvasHintDismissPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
