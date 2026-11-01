/** Explicit dependencies of Make: the selected piece taken down to its parts, inside the editor. */
export interface MakeViewPorts {
  readonly dom: Pick<ReturnType<typeof import('../editor/editor-dom').createEditorDom>, '$' | 'document' | 'matchMedia' | 'window'>;
  readonly lifetime: Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'listen' | 'cleanup' | 'frame' | 'observe'>;
  /** The editor's own scene, camera and canvas: Make draws its boards there, on a layer of their own. */
  readonly resources: Pick<ReturnType<typeof import('../viewport/viewport-resources.js').createViewportResources>, 'scene' | 'cam' | 'cv' | 'M' | 'decorTexture' | 'frameHooks' | 'R'>;
  /** The editor's own camera framing. */
  readonly camera: Pick<ReturnType<typeof import('../viewport/camera-controller.js').createCameraController>, 'frameWardrobe' | 'frameBox' | 'camNow' | 'fittedCamera' | 'cameraSample' | 'cameraTransition'>;
  /** The scene, read when Make opens: the active piece is the one taken apart. */
  scene(): import('../../application/projects/editor-scene').EditorScene;
  /** Closes the editor's own panels before Make opens its own. */
  closePanels(): void;
  /** Redraws the bottom toolbar for the current selection (Make's tools while it is open). */
  refreshToolbar(): void;
  /** Opens the full technical drawing set (a paid feature). */
  openDrawings(): void;
  /** A short message over the editor. */
  toast(message: string): void;
  /** Saves how a piece goes together with the design, as one undo step; false when nothing changed. */
  setConstruction(id: number, change: Partial<import('../../domain/make/make-construction').Construction>): boolean;
  /** Pays for saving the piece's drawings or cut list (the drawing set's price and pass); false when not paid. */
  pay(): Promise<boolean>;
}
