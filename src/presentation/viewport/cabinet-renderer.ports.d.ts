/** Explicit dependencies consumed by this module. */
export interface CreateCabinetRendererPorts {
readonly dom: ReturnType<typeof import('../editor/editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('./camera-controller.js').createCameraController>, 'applyView' | 'cameraNearDistance' | 'cameraTick'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('../editor/editor-gestures.js').createEditorGestures>, 'beginDividerDrag' | 'beginRotation' | 'beginWardrobeDrag' | 'finishRotation' | 'finishWardrobeDrag' | 'moveWardrobeFromPointer' | 'previewAt' | 'rotateFromPointer'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../editor/inspector-presenter.js').createInspectorPresenter>, 'addCabinet' | 'crumbUI' | 'dividerUI' | 'editableDividerClearance' | 'editableItemClearance' | 'inside' | 'openPillMenu' | 'selectCabinet' | 'setCabinetPose' | 'updateItemBar'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor/editor-shell.js').createEditorShell>, 'toast'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('../editor/scene-picking.js').createScenePicking>, 'frontPoint' | 'screenPoint'>>;
readonly cameraState: Pick<ReturnType<typeof import('./camera-state.js').createCameraState>, 'az' | 'camGoal' | 'dist' | 'el' | 'fitDist' | 'tgt' | 'vs' | 'vsT' | 'vz' | 'vzT'>;
readonly interactionState: Pick<ReturnType<typeof import('../editor/interaction-state.js').createInteractionState>, 'drag' | 'itemEdgeGesture' | 'lastMoveEvent' | 'moveMode' | 'previewPlan' | 'rotationGesture' | 'wardrobeGesture'>;
readonly renderState: Pick<ReturnType<typeof import('./render-state.js').createRenderState>, 'Gr' | 'allHits' | 'allItemHits' | 'buildStamp' | 'dividerMoveHandle' | 'dividerVisuals' | 'hits' | 'ihits' | 'itemEdgeHandles' | 'itemGroups' | 'labs' | 'lastFrameTime' | 'moveIcons' | 'outs' | 'overlayHeld' | 'pivots' | 'prevLab' | 'previewGroup' | 'pv' | 'pv2' | 'renderActive' | 'renderCabinet' | 'selMarks' | 'settling' | 'wardrobeGroups'>;
readonly selectionState: Pick<ReturnType<typeof import('../editor/selection-state.js').createSelectionState>, 'editingSize' | 'focusOn' | 'pillOn' | 'showDimensions' | 'shapeEditing'>;
readonly shellState: Pick<ReturnType<typeof import('../editor/shell-state.js').createShellState>, 't0'>;
readonly resources: Pick<ReturnType<typeof import('./viewport-resources.js').createViewportResources>, 'HM' | 'M' | 'R' | 'aoTexture' | 'cam' | 'contact' | 'cv' | 'scene' | 'shade' | 'softArea' | 'wood'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'moveDividerTo' | 'run'>>;
readonly settings: Pick<{ budget: number }, 'budget'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('./editor-lifetime.js').createEditorLifetime>, 'frame' | 'cleanup'>>;
readonly shapeInspector: Readonly<Pick<ReturnType<typeof import('../editor/shape-inspector').createShapeInspector>, 'handles' | 'beginHandleDrag' | 'moveHandleDrag' | 'endHandleDrag' | 'nudge'>>;
}
