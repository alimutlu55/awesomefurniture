export interface EditorSession {
  readonly selection: {
    readonly wardrobeId: string;
    readonly sectionId: string | null;
    readonly itemId: string | null;
    readonly dividerId: string | null;
  } | null;
  readonly tool: 'select' | 'move' | 'resize';
  readonly openPanel: 'properties' | 'planner' | null;
}

export const createEditorSession = (): EditorSession => ({
  selection: null,
  tool: 'select',
  openPanel: null,
});
