export type FloorPlanPorts = {
  dom: ReturnType<typeof import('./editor-dom').createEditorDom>;
  model: ReturnType<typeof import('../../application/projects/editor-model').createEditorModel>;
  history: ReturnType<typeof import('../../application/history/scene-history').createSceneHistory>;
  commands: ReturnType<typeof import('../../application/commands/scene-commands').createSceneCommands>;
  selection: ReturnType<typeof import('./selection-state.js').createSelectionState>;
  lifetime: ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>;
  refresh(): void; closePanels(): void;
};
