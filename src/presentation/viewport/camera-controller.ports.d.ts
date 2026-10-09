/** Explicit dependencies consumed by this module. */
export interface CreateCameraControllerPorts {
readonly dom: ReturnType<typeof import('../editor/editor-dom.js').createEditorDom>;
readonly clock?: Pick<Pick<Performance, "now">, 'now'>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../editor/inspector-presenter.js').createInspectorPresenter>, 'inside' | 'layoutPop'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('../editor/scene-picking.js').createScenePicking>, 'cast'>>;
readonly cameraState: Pick<ReturnType<typeof import('./camera-state.js').createCameraState>, 'az' | 'camGoal' | 'camHome' | 'camRestore' | 'dist' | 'el' | 'fitDist' | 'initialCameraFraming' | 'reducedCameraMotion' | 'tgt' | 'tgtY' | 'vs' | 'vsT' | 'vz' | 'vzT' | 'zoomAnchor' | 'zoomFocus' | 'zoomTarget'>;
readonly interactionState: Pick<ReturnType<typeof import('../editor/interaction-state.js').createInteractionState>, 'ray'>;
readonly renderState: Pick<ReturnType<typeof import('./render-state.js').createRenderState>, 'allHits' | 'allItemHits'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'dividerRect' | 'itemGeom' | 'sectionSpaceMeasurements' | 'widths'>>;
readonly cabinetGeometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/cabinet-geometry.js').createCabinetGeometry>, 'sceneBounds'>>;
readonly resources: Pick<ReturnType<typeof import('./viewport-resources.js').createViewportResources>, 'cam' | 'cv' | 'scene'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly viewport: Readonly<Pick<ReturnType<typeof import('./three-viewport.js').createThreeViewport>, 'resize'>>;
}
