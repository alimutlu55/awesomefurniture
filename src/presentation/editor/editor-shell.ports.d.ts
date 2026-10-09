/** Explicit dependencies consumed by this module. */
export interface CreateEditorShellPorts {
readonly dom: ReturnType<typeof import('./editor-dom.js').createEditorDom>;
readonly shellState: Pick<ReturnType<typeof import('./shell-state.js').createShellState>, 'G' | 't0' | 'tt'>;
readonly geometry: Readonly<Pick<ReturnType<typeof import('../../domain/geometry/wardrobe-geometry.js').createWardrobeGeometry>, 'stats'>>;
readonly model: Pick<ReturnType<typeof import('../../application/projects/editor-model.js').createEditorModel>, 'activeCabinet'>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../viewport/editor-lifetime.js').createEditorLifetime>, 'cancelTimeout' | 'timeout'>>;
readonly elements: Pick<ReturnType<typeof import('./editor-dom.js').getEditorElements>, 'app' | 'propsButton'>;
}
