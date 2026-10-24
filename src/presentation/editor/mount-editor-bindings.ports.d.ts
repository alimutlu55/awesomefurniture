/** Explicit dependencies consumed by this module. */
export interface MountEditorBindingsPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly picking: Readonly<ReturnType<typeof import('./scene-picking.js').createScenePicking>>;
readonly camera: Readonly<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>>;
readonly rendering: Readonly<ReturnType<typeof import('../viewport/cabinet-renderer.js').createCabinetRenderer>>;
readonly interactions: Readonly<ReturnType<typeof import('./editor-gestures.js').createEditorGestures>>;
readonly inspector: Readonly<ReturnType<typeof import('./inspector-presenter.js').createInspectorPresenter>>;
readonly planner: Readonly<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>>;
readonly shell: Readonly<ReturnType<typeof import('./editor-shell.js').createEditorShell>>;
readonly cameraState: ReturnType<typeof import('../viewport/camera-state.js').createCameraState>;
readonly interactionState: ReturnType<typeof import('./interaction-state.js').createInteractionState>;
readonly renderState: ReturnType<typeof import('../viewport/render-state.js').createRenderState>;
readonly selectionState: ReturnType<typeof import('./selection-state.js').createSelectionState>;
readonly plannerState: ReturnType<typeof import('./planner-state.js').createPlannerState>;
readonly shellState: Pick<ReturnType<typeof import('./shell-state.js').createShellState>, 'G'>;
readonly geometry: Readonly<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>>;
readonly resources: ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>;
readonly model: ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>;
readonly commands: Readonly<ReturnType<typeof import('../../application/commands/design-commands.js').createDesignCommands>>;
readonly sceneCommands: Readonly<ReturnType<typeof import('../../application/commands/scene-commands.js').createSceneCommands>>;
readonly history: Readonly<ReturnType<typeof import('../../application/history/scene-history.js').createSceneHistory>>;
readonly lifetime: Readonly<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>>;
readonly elements: ReturnType<typeof import('./editor-dom.js').getEditorElements>;
/** The room editor and its Size fields, for the contextual toolbar. */
readonly room: Pick<ReturnType<typeof import('./room-wiring').createRoomWiring>, 'editor' | 'fields' | 'surface' | 'resizePanel' | 'actOnWall' | 'paintPanel' | 'openShape'>;
/** Pull-to-array on a selected kitchen unit, for the canvas bindings and Escape. */
readonly kitchenArray?: ReturnType<typeof import('./kitchen-array-gesture').createKitchenArrayGesture>;
}
