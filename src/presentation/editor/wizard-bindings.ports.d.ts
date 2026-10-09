/** Explicit dependencies consumed by this module. */
export interface BindPlanCapacityPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly planner: Readonly<Pick<ReturnType<typeof import('./planner-presenter.js').createPlannerPresenter>, 'openWizard'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
}
