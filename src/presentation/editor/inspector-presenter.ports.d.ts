/** Explicit dependencies consumed by this module. */
export interface CreateInspectorPresenterPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'app'>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'baseShift' | 'camRelease' | 'frameMobileInspector' | 'fit' | 'focusSelection'>>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'build' | 'positionLabels' | 'refreshDividerVisual'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'armMovement' | 'cancelMovement' | 'finishItemEdgeResize' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'planUI'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'Q' | 'check' | 'toast'>>;
readonly cameraState: Pick<ReturnType<typeof import('../viewport/camera-state.js').createCameraState>, 'vs' | 'vsT' | 'vz' | 'vzT'>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'itemEdgeGesture' | 'moveMode' | 'ptrs' | 'rotationGesture' | 'wardrobeGesture'>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'Gr' | 'buildStamp' | 'overlayHeld'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'addKey' | 'ctxMenu' | 'deep' | 'focusOn' | 'itemBar' | 'itemBarCache' | 'itemTypeMenu' | 'pillOn' | 'popMin' | 'responsivePanel' | 'showDimensions' | 'shapeEditing' | 'addScope'>;
readonly shellState: Pick<ReturnType<typeof import('./shell-state.js').createShellState>, 'G'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'boardFit' | 'currentLayout' | 'dividerDupSpot' | 'dividerMeasurements' | 'dividerRect' | 'duplicateSideSpot' | 'edgeGap' | 'effectiveMin' | 'free' | 'ih' | 'itemEdgeSize' | 'itemFeasible' | 'itemFreeAbove' | 'itemGeom' | 'itemMeasurements' | 'itemMinW' | 'itemYBounds' | 'maxN' | 'planCfg' | 'planItemMove' | 'plannerConfig' | 'resizeObstacles' | 'sectionDividers' | 'sectionSpaceMeasurements' | 'spaceSpan' | 'stats' | 'widthEdgeFor' | 'widths'>>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cam' | 'cv'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene' | 'select' | 'snapshot'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'deleteItem' | 'duplicateItem' | 'normalizeSelection' | 'setDividerClearance' | 'setItemClearance'>>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>, 'addCabinet' | 'setCabinetPose'>>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../application/history/scene-history.js').createSceneHistory>, 'checkpoint' | 'redo' | 'redoCount' | 'undo' | 'undoCount'>>;
readonly shapeInspector: Readonly<Pick<ReturnType<typeof import('./shape-inspector').createShapeInspector>, 'render'>>;
readonly studioPanel: Readonly<Pick<ReturnType<typeof import('./studio-panel').createStudioPanel>, 'render' | 'products'>>;
}
