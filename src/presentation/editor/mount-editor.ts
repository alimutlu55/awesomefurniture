import { scopeEditorStyles } from './editor-styles';
import { startEditor } from './editor-runtime.js';
import { createEditorDom } from './editor-dom.js';
import type { EditorScene } from '../../application/projects/editor-scene';
import rawMarkup from './editor.html?raw';
import { withPossessionFields } from './possession-fields';
import stylesheet from './editor.css?raw';
import decorStylesheet from './decor-picker.css?raw';
import mobileStylesheet from './mobile.css?raw';
import mobileSheetStylesheet from './mobile-sheet.css?raw';
import shapeStylesheet from './shape.css?raw';
import studioStylesheet from './studio.css?raw';
import fixturesStylesheet from './fixtures.css?raw';
import surfaceShapeStylesheet from './surface-shape.css?raw';
import toolbarLayoutStylesheet from './toolbar-layout.css?raw';
import furnitureStylesheet from './furniture.css?raw';
import focusedEditingStylesheet from './focused-editing.css?raw';
import tactileStylesheet from './tactile-controls.css?raw';
import measurementStylesheet from '../components/measurement-badge.css?raw';
import drawingsStylesheet from '../drawings/drawings.css?raw';
import designImageStylesheet from '../ai/design-image.css?raw';
import designImageLoadingStylesheet from '../ai/design-image-loading.css?raw';
import creditsStylesheet from '../credits/credits.css?raw';
import type { CreditsPlatform } from '../credits/credits.ports';
import experienceStylesheet from '../experience/experience.css?raw';
import welcomeStylesheet from '../experience/welcome.css?raw';
export interface MountEditorOptions {
    root: HTMLElement;
    initialScene?: EditorScene | undefined;
    /** Makes a link that opens a design; given, the menu offers Share design. */
    shareLink?: ((scene: EditorScene) => Promise<string>) | undefined;
    onBack?: (() => void) | undefined;
    /** Given, the toolbar shows the credit balance and paid features charge credits (src/app/credit-platform.ts). */
    credits?: CreditsPlatform | undefined;
}
const markup = withPossessionFields(rawMarkup);
const mounted = new WeakSet<HTMLElement>();
/** Each editor owns a separate DOM tree, controls, focus, working scene and lifetime. */
export function mountEditor({ root, initialScene, shareLink, onBack, credits }: MountEditorOptions) {
    if (mounted.has(root))
        throw new Error('This container already contains a mounted editor.');
    mounted.add(root);
    const shadow = root.shadowRoot ?? root.attachShadow({ mode: 'open' });
    root.dataset.theme ??= root.ownerDocument.documentElement.dataset.theme ?? 'light';
    const style = root.ownerDocument.createElement('style');
    const controlIds = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]!).concat(['item-bar', 'item-type-menu', 'ctx-menu']));
    const styles = scopeEditorStyles([stylesheet, mobileStylesheet, mobileSheetStylesheet,
        shapeStylesheet, studioStylesheet, fixturesStylesheet, surfaceShapeStylesheet, toolbarLayoutStylesheet, furnitureStylesheet, focusedEditingStylesheet, tactileStylesheet,
        measurementStylesheet, drawingsStylesheet, designImageStylesheet, designImageLoadingStylesheet, creditsStylesheet, decorStylesheet, experienceStylesheet, welcomeStylesheet].join('\n'), controlIds);
    style.textContent = ':host{display:block;position:relative;container-type:size;overflow:hidden;height:100%;width:100%}\n' + styles;
    shadow.innerHTML = markup;
    shadow.prepend(style);
    const dom = createEditorDom(shadow);
    let editor:ReturnType<typeof startEditor>|undefined;
    try {
        editor = startEditor(initialScene, dom, shareLink, credits);
        if (onBack) {
            dom.$('#view-modes').setAttribute('aria-label', 'Design navigation and editing mode');
            const back = dom.$('#designs-back');
            back.hidden = false;
            dom.$('#designs-separator').hidden = false;
            back.addEventListener('click', onBack);
        }
        const mountedEditor=editor;
        let disposed = false;
        return {
            snapshot: mountedEditor.snapshot,
            viewport: mountedEditor.viewport,
            /** For the agent API (src/app/agent-api.ts): load a whole design, read the current one, tell the person. */
            replaceDesign: mountedEditor.replaceDesign,
            scene: mountedEditor.scene,
            notify: mountedEditor.notify,
            preview: mountedEditor.preview,
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
