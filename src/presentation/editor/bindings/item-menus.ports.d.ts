/** Explicit dependencies consumed by ./item-menus.js. */
export interface BindViewPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly inspector: Readonly<Pick<ReturnType<typeof import('../inspector-presenter.js').createInspectorPresenter>, 'closeItemMenus' | 'inside' | 'itemAction' | 'placeFloating' | 'placeItemTypeMenu' | 'showPop' | 'update'>>;
readonly picking: Readonly<Pick<ReturnType<typeof import('../scene-picking.js').createScenePicking>, 'cast'>>;
readonly renderState: Pick<ReturnType<typeof import('../../viewport/render-state.js').createRenderState>, 'allItemHits'>;
readonly selectionState: Pick<ReturnType<typeof import('../selection-state.js').createSelectionState>, 'ctxMenu' | 'deep' | 'focusOn' | 'itemBar' | 'itemTypeMenu' | 'pillOn'>;
readonly resources: Pick<ReturnType<typeof import('../../viewport/viewport-resources.js').createViewportResources>, 'cv'>;
readonly model: Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet' | 'scene'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
