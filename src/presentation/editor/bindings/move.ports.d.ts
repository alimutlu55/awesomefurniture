/** Explicit dependencies consumed by ./move.js. */
export interface BindSwapModePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'armMovement'>>;
}

export interface BindMoveCancelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement'>>;
}

export interface BindMovePreviewKeydownPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'previewAt'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'drag' | 'lastMoveEvent' | 'moveMode'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindMovePreviewKeyupPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'previewAt'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'drag' | 'lastMoveEvent' | 'moveMode'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
