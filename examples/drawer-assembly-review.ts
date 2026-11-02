import { mountEditor } from '../src/presentation/editor/mount-editor';
import { createEditorState } from '../src/application/projects/editor-state';
import { createKitchenDesign } from '../src/domain/kitchen/kitchen-design';
import { defaultMaterials } from '../src/domain/materials/configured-materials';

const kitchen = new URLSearchParams(location.search).get('cabinet') === 'kitchen-drawers';
const state = kitchen ? { ...createEditorState(), ...createKitchenDesign('base', 'drawers'), fin: 'Oak' as const, materials: defaultMaterials('Oak') }
  : { ...createEditorState(), w: 80, h: 220, d: 60, n: 1, wt: [1], doors: 'none' as const,
    secs: [[{ k: 'drawer' as const, h: 30 }, { k: 'drawer' as const, h: 30 }, { k: 'drawer' as const, h: 30 }, { k: 'shelf' as const, h: 70 }]] };

/** Isolated mobile QA fixture. No cloud session, account, persistence or changes to the user's design. */
const editor = mountEditor({ root: document.querySelector<HTMLElement>('#editor')!, initialScene: {
  activeWardrobe: 1, nextWardrobeId: 2, wardrobes: [{
    id: 1, name: 'Drawer camera review', x: 0, y: 0, z: 0, angle: 0,
    state,
  }],
} });
window.addEventListener('pagehide', () => editor.dispose(), { once: true });
import.meta.hot?.dispose(() => editor.dispose());
