import { scopeEditorStyles } from './editor-styles';
import { startEditor } from './editor-runtime.js';
import { createEditorDom } from './editor-dom.js';
import { mountProjectControls } from './project-controls';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { ProjectService } from '../../application/projects/project-service';
import type { StoredProject } from '../../application/ports/project-repository';
import markup from './editor.html?raw';
import stylesheet from './editor.css?raw';
import projectStyles from './project-controls.css?raw';
export interface MountEditorOptions {
    root: HTMLElement;
    initialScene?: EditorScene | undefined;
    projects?: ProjectService;
    initialProject?: StoredProject | null;
    onProjectCreated?: (project: StoredProject) => void;
}
const mounted = new WeakSet<HTMLElement>();
/** Each editor owns a separate DOM tree, controls, focus, working scene and lifetime. */
export function mountEditor({ root, initialScene, projects, initialProject = null, onProjectCreated }: MountEditorOptions) {
    if (mounted.has(root))
        throw new Error('This container already contains a mounted editor.');
    mounted.add(root);
    const shadow = root.shadowRoot ?? root.attachShadow({ mode: 'open' });
    root.dataset.theme ??= root.ownerDocument.documentElement.dataset.theme ?? 'light';
    const style = root.ownerDocument.createElement('style');
    const controlIds = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!).concat(['item-bar', 'item-type-menu', 'ctx-menu']));
    const styles = scopeEditorStyles(stylesheet + '\n' + projectStyles, controlIds);
    style.textContent = ':host{display:block;position:relative;container-type:size;overflow:hidden;height:100%;width:100%}\n' + styles;
    shadow.innerHTML = markup;
    shadow.prepend(style);
    const dom = createEditorDom(shadow);
    let editor:ReturnType<typeof startEditor>|undefined;
    try {
        editor = startEditor(initialScene, dom);
        const mountedEditor=editor;
        const unmountControls = projects ? mountProjectControls(projects, initialProject, editor.snapshot, dom, onProjectCreated) : () => { };
        let disposed = false;
        return {
            snapshot: mountedEditor.snapshot,
            viewport: mountedEditor.viewport,
            dispose() {
                if (disposed)
                    return;
                disposed = true;
                unmountControls();
                mountedEditor.dispose();
                shadow.replaceChildren();
                mounted.delete(root);
            }
        };
    }
    catch (error) {
        editor?.dispose();
        dom.dispose();
        shadow.replaceChildren();
        mounted.delete(root);
        throw error;
    }
}
