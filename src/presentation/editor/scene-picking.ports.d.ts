/** Explicit dependencies consumed by this module. */
export interface CreateScenePickingPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly interactionState: Pick<ReturnType<typeof import('./interaction-state.js').createInteractionState>, 'ray'>;
readonly renderState: Pick<ReturnType<typeof import('../viewport/render-state.js').createRenderState>, 'Gr' | 'hits'>;
readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'cam' | 'cv' | 'scene'>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
}
