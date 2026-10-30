/** Explicit dependencies consumed by this module. */
export interface CreateEditorGesturesPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly camera: Readonly<Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'camRelease' | 'frameMobileInspector' | 'frameScene' | 'frameWardrobe' | 'moveViewOff' | 'moveViewOn'>>;
readonly rendering: Readonly<Pick<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>, 'assist' | 'build' | 'clearPreview' | 'clearSettling' | 'drawClearances' | 'dropPreviewLabels' | 'holdOverlay' | 'refreshDividerVisual' | 'setPreviewLabel' | 'updatePreviewOutlines' | 'wallGuide'>>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>, 'clearFocus' | 'hidePop' | 'histUI' | 'inside' | 'itemUI' | 'movementUI' | 'reopenItemPanel' | 'selectCabinet' | 'selectSpaceAt' | 'showPop' | 'update'>>;
readonly shell: Readonly<Pick<ReturnType<typeof import('./editor-shell.js').createEditorShell>, 'toast'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('./scene-picking.js').createScenePicking>, 'cast' | 'frontPoint' | 'groundPoint' | 'hitAt' | 'screenPoint' | 'pieceAt'>>;
readonly cameraState: Pick<ReturnType<typeof import('../viewport/camera-state.js').createCameraState>, 'camGoal' | 'el' | 'tgt' | 'tgtY' | 'vs' | 'vsT' | 'vz' | 'vzT'>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'dividerGesture' | 'drag' | 'itemEdgeGesture' | 'lastMoveEvent' | 'moveMode' | 'panelWasOpen' | 'previewPlan' | 'rotationGesture' | 'wardrobeGesture'>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'Gr' | 'allHits' | 'allItemHits' | 'hits' | 'ihits' | 'itemGroups' | 'outs' | 'previewGroup' | 'settling' | 'wardrobeGroups'>;
readonly selectionState: Pick<ReturnType<typeof import('./selection-state.js').createSelectionState>, 'deep' | 'focusOn' | 'pillOn' | 'room' | 'viewMode' | 'pendingStudioAction'>;
readonly shellState: Pick<ReturnType<typeof import('./shell-state.js').createShellState>, 'G'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>,
    'interiorFloor' | 'computeLayout' | 'effectiveMin' | 'ih' | 'itemEdgeSize' | 'itemGeom' | 'itemMinW' | 'planFreeMove' | 'planItemMove'
    | 'resizeObstacles' | 'verticalNeighbor' | 'widthEdgeFor' | 'widths' | 'ceilingTop' | 'dividerRect' | 'clampDivider'>>;
readonly cabinetGeometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/cabinet-geometry.js').createCabinetGeometry>, 'cabinetTranslation'>>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cv' | 'scene'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'restore' | 'scene' | 'snapshot'>;
readonly commands: Readonly<Pick<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>, 'applyItemEdgeSize' | 'applyMove' | 'moveDividerTo' | 'alignDividerTo' | 'restoreSection'>>;
readonly sceneCommands: Readonly<Pick<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>, 'previewRotation' | 'previewTranslation' | 'restorePose' | 'wallSnap' | 'settleCabinet' | 'alignSnap'>>;
readonly history: Readonly<Pick<ReturnType<typeof import('../../application/history/scene-history.js').createSceneHistory>, 'checkpoint'>>;
/** The room: its walls and openings can be picked when no wardrobe is in front of them. */
readonly room?: { pickables(): import('three').Object3D[]; pick(hit: import('three').Intersection | undefined): boolean };
}
