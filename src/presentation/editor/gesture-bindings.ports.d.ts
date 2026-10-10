/** Explicit dependencies consumed by this module. */
export interface ObserveViewportSizePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'resize'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'observe'>>;
}

export interface BindCanvasPointerdownPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'camRelease'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'beginDividerDrag' | 'beginWardrobeDrag' | 'cancelMovement' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'inside'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('./scene-picking.js').createScenePicking>, 'cast' | 'frontPoint'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'drag' | 'moved' | 'pd' | 'ptrs' | 'rotationClick' | 'rotationGesture' | 'sx' | 'sy' | 'wardrobeGesture'>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'allHits' | 'ihits'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'focusOn'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasPointermovePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'camRelease' | 'cameraDistance' | 'cameraFocusPoint' | 'cameraZoomDistance'>>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'clearSettling'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'hover' | 'moveWardrobeFromPointer' | 'previewAt' | 'rotateFromPointer'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
readonly cameraState: Pick<ReturnType<typeof import('../viewport/camera-state.js').createCameraState>, 'az' | 'dist' | 'el' | 'tgt' | 'tgtY' | 'vs' | 'vsT' | 'vz' | 'vzT'>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'moveMode' | 'moved' | 'panelWasOpen' | 'pd' | 'ptrs' | 'rotationGesture' | 'sx' | 'sy' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasPointerupPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'commitItemMove' | 'finishDividerDrag' | 'finishWardrobeDrag' | 'hover' | 'pick' | 'previewAt'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'moveMode' | 'moved' | 'previewPlan' | 'ptrs' | 'rotationClick' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasPointercancelPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'moved' | 'ptrs' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasLostpointercapturePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'moved' | 'ptrs' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowBlur2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'finishRotation' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'ptrs' | 'rotationGesture' | 'wardrobeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasWheelPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'cameraZoom'>>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'itemEdgeGesture' | 'rotationGesture' | 'wardrobeGesture'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindCanvasPointerleavePorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'ihits' | 'outs'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindViewPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'closeItemMenus' | 'inside' | 'itemAction' | 'placeFloating' | 'placeItemTypeMenu' | 'showPop' | 'update'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('./scene-picking.js').createScenePicking>, 'cast'>>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'allItemHits'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'ctxMenu' | 'deep' | 'focusOn' | 'itemBar' | 'itemTypeMenu' | 'pillOn'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindWindowKeydown3Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'finishRotation' | 'finishWardrobeDrag'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'rotationGesture' | 'wardrobeGesture'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindResetAllPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop' | 'update'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly plannerState: Pick<ReturnType<typeof import('./planner-state.js').createPlannerState>, 'emptyDismissed'>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>, 'resetCabinet'>>;
}

export interface BindWindowKeydown4Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactions: Readonly<Pick<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>, 'cancelMovement' | 'keyboardMove'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'clearFocus' | 'goUp' | 'hidePop' | 'update'>>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'closeWizard'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'drag' | 'moveMode' | 'moved' | 'ptrs'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'deep' | 'focusOn' | 'pillOn'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'addMod' | 'removeTop'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPopPminPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'layoutPop' | 'syncMin'>>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'popMin'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPopPhPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'baseShift'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'dockPop' | 'sideFor'>>;
readonly cameraState: Pick<ReturnType<typeof import('../viewport/camera-state.js').createCameraState>, 'vsT' | 'vzT'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'popPos'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}

export interface BindPxPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'hidePop'>>;
}

export interface BindPop2Ports {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'itemUI' | 'showPop' | 'swapPop' | 'update'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'addMod' | 'addSpaceDivider' | 'autofill' | 'clearSection' | 'run'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
