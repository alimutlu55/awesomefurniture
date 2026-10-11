import { scopeEditorStyles } from './editor-styles';
import { startEditor } from './editor-runtime.js';
import { createEditorDom } from './editor-dom.js';
import type { EditorScene } from '../../application/projects/editor-scene';
import rawMarkup from './editor.html?raw';
import { withPossessionFields } from './possession-fields';
import stylesheet from './editor.css?raw';
import mobileStylesheet from './mobile.css?raw';
import mobileSheetStylesheet from './mobile-sheet.css?raw';
import shapeStylesheet from './shape.css?raw';
import studioStylesheet from './studio.css?raw';
export interface MountEditorOptions {
    root: HTMLElement;
    initialScene?: EditorScene | undefined;
}
const markup = withPossessionFields(rawMarkup);
const mounted = new WeakSet<HTMLElement>();
/** Each editor owns a separate DOM tree, controls, focus, working scene and lifetime. */
export function mountEditor({ root, initialScene }: MountEditorOptions) {
    if (mounted.has(root))
        throw new Error('This container already contains a mounted editor.');
    mounted.add(root);
    const shadow = root.shadowRoot ?? root.attachShadow({ mode: 'open' });
    root.dataset.theme ??= root.ownerDocument.documentElement.dataset.theme ?? 'light';
    const style = root.ownerDocument.createElement('style');
    const controlIds = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!).concat(['item-bar', 'item-type-menu', 'ctx-menu']));
    const styles = scopeEditorStyles(stylesheet + '\n' + mobileStylesheet + '\n' + mobileSheetStylesheet + '\n' + shapeStylesheet + '\n' + studioStylesheet, controlIds);
    style.textContent = ':host{display:block;position:relative;container-type:size;overflow:hidden;height:100%;width:100%}\n' + styles;
    shadow.innerHTML = markup;
    shadow.prepend(style);
    const dom = createEditorDom(shadow);
    let editor:ReturnType<typeof startEditor>|undefined;
    try {
        editor = startEditor(initialScene, dom);
        const mountedEditor=editor;
        let disposed = false;
        return {
            snapshot: mountedEditor.snapshot,
            viewport: mountedEditor.viewport,
            dispose() {
                if (disposed)
                    return;
                disposed = true;
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
