import { rememberEndPanels } from '../../domain/kitchen/end-panels';
import { reconcileInstallation } from './installation-reconciliation';
import type {EditorCabinet, EditorScene} from './editor-scene';
import { createEditorState } from './editor-state';
import { ensureEditorIdentities } from './editor-identities';
/** Working model shared by commands and the viewport. Snapshots are detached;
 * replacing one restores every cabinet and the active editing context together. */

/** What the editor shows when every wardrobe is removed: a detached, empty design that no command saves. */
export const emptyCabinet = (): EditorCabinet => ({ id: 0, name: '', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() });

export function createEditorModel(initialScene?:EditorScene, newId = () => crypto.randomUUID()) {
    let scene:EditorScene = initialScene ? structuredClone(initialScene) : { wardrobes: [{ id: 1, name: 'Wardrobe 1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() }], activeWardrobe: 1, nextWardrobeId: 2 };
    reconcileInstallation(scene);
    rememberEndPanels(scene.wardrobes);
    let spare: EditorCabinet | null = null;
    return {
        get scene() {
            return scene;
        },
        activeCabinet() {
            if (!scene.wardrobes.length) return spare ??= emptyCabinet();
            const cabinet=scene.wardrobes.find(w => w.id === scene.activeWardrobe);
            if(!cabinet)throw new Error('Active wardrobe is missing.');
            return cabinet;
        },
        select(id:number) {
            if (!scene.wardrobes.some(w => w.id === id)) {
                return false;
            }
            scene.activeWardrobe = id;
            return true;
        },
        snapshot() {
            ensureEditorIdentities(scene.wardrobes, newId);
            return JSON.stringify(scene);
        },
        restore(raw:string) {
            const next:EditorScene = JSON.parse(raw);
            if (next.wardrobes.length && !next.wardrobes.some(w => w.id === next.activeWardrobe)) {
                throw new Error('Active wardrobe is missing.');
            }
            scene = next;
        },
    };
}
