/** Explicit dependencies consumed by ./canvas.js. */
/** The room editor's surface drags: the selected wall, opening or ceiling, grabbed on the model. */
type RoomSurface = Readonly<Pick<ReturnType<typeof import('../room-wiring').createRoomWiring>['surface'], 'grab' | 'move' | 'end' | 'dragging'>>;


export interface ObserveViewportSizePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'resize'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'observe'>>;
}

export interface BindCanvasPointerdownPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'camRelease' | 'panBy'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'beginDividerDrag' | 'beginWardrobeDrag' | 'cancelMovement' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'inside'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('../scene-picking.js').createScenePicking>, 'cast' | 'frontPoint'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'drag' | 'moved' | 'pd' | 'ptrs' | 'rotationClick' | 'rotationGesture' | 'sx' | 'sy' | 'wardrobeGesture' | 'panGesture'>;
readonly renderState: Pick<ReturnType<typeof import('../../viewport/render-state.js').createRenderState>, 'allHits' | 'ihits'>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'focusOn' | 'shapeEditing'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly room?: RoomSurface;
}

export interface BindCanvasPointermovePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'camRelease' | 'cameraDistance' | 'cameraFocusPoint' | 'cameraZoomDistance' | 'panBy'>>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../../viewport/cabinet-renderer.js').createCabinetRenderer>, 'clearSettling'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'hover' | 'moveWardrobeFromPointer' | 'previewAt' | 'rotateFromPointer'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
readonly cameraState: Pick<ReturnType<typeof import('../../viewport/camera-state.js').createCameraState>, 'az' | 'dist' | 'el' | 'tgt' | 'tgtY' | 'vs' | 'vsT' | 'vz' | 'vzT'>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'moveMode' | 'moved' | 'panelWasOpen' | 'pd' | 'ptrs' | 'rotationGesture' | 'sx' | 'sy' | 'wardrobeGesture' | 'panGesture'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly room?: RoomSurface;
}

export interface BindCanvasPointerupPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'commitItemMove' | 'finishDividerDrag' | 'finishWardrobeDrag' | 'hover' | 'pick' | 'previewAt'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'toast'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'moveMode' | 'moved' | 'previewPlan' | 'ptrs' | 'rotationClick' | 'wardrobeGesture' | 'panGesture'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly room?: RoomSurface;
}

export interface BindCanvasPointercancelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'moved' | 'ptrs' | 'wardrobeGesture' | 'panGesture'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
readonly room?: RoomSurface;
}

export interface BindCanvasLostpointercapturePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'moved' | 'ptrs' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasGestureBlurPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'ptrs' | 'rotationGesture' | 'wardrobeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasWheelPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../../viewport/camera-controller.js').createCameraController>, 'cameraZoom'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'cancelMovement'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'itemEdgeGesture' | 'rotationGesture' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasPointerleavePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly renderState: Pick<ReturnType<typeof import('../../viewport/render-state.js').createRenderState>, 'ihits' | 'outs'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasGestureEscapePorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor-gestures.js').createEditorGestures>, 'finishRotation' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('../interaction-state.js').createInteractionState>, 'rotationGesture' | 'wardrobeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
