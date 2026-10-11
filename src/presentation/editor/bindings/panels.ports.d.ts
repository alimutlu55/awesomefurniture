/** Explicit dependencies consumed by ./panels.js. */
export interface BindInspectorControlsPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../../viewport/cabinet-renderer.js').createCabinetRenderer>, 'theme'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindToolbarPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;

}

export interface BindPopPminPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'layoutPop' | 'syncMin'>>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'popMin'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPopPhPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'baseShift'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'dockPop' | 'sideFor'>>;
readonly cameraState: Pick<ReturnType<typeof import('../../viewport/camera-state.js').createCameraState>, 'vsT' | 'vzT'>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'popPos'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPxPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}
