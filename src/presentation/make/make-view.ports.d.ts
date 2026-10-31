/** Explicit dependencies of the Make view: one piece of furniture taken down to its parts. */
export interface MakeViewPorts {
  readonly dom: Pick<ReturnType<typeof import('../editor/editor-dom').createEditorDom>, '$' | 'document' | 'matchMedia'>;
  readonly lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen' | 'cleanup' | 'frame'>;
  /** The scene, read when Make opens: the active piece is the one taken apart. */
  scene(): import('../../application/projects/editor-scene').EditorScene;
  /** Opens the full technical drawing set (a paid feature) over Make. */
  openDrawings(): void;
  /** A short message over the editor. */
  toast(message: string): void;
}
