/** Explicit dependencies consumed by ./share.js. */
export interface BindShareMenuPorts {
readonly dom: ReturnType<typeof import('../editor-dom.js').createEditorDom>;
readonly shell: Readonly<Pick<ReturnType<typeof import('../editor-shell.js').createEditorShell>, 'closeDD' | 'toast'>>;
readonly model: Readonly<Pick<ReturnType<typeof import('../../../application/projects/editor-model.js').createEditorModel>, 'scene'>>;
readonly lifetime: Readonly<Pick<ReturnType<typeof import('../../viewport/editor-lifetime.js').createEditorLifetime>, 'listen'>>;
/** Makes a link that opens this design (given by the page that mounts the editor); without it there is no Share. */
readonly shareLink: ((scene: import('../../../application/projects/editor-scene').EditorScene) => Promise<string>) | undefined;
}
