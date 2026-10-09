import type { EditorState } from '../projects/editor-scene';
import type { EditorProfile } from '../../domain/wardrobe/editor-design';
type Ports = {
    getDesign(): import('../projects/editor-scene').EditorState;
    effects: Pick<Required<import('./command-effects').CommandEffects>, 'checkpoint' | 'changed'>;
    run(fn: () => void): void;
};
export function createAppearanceCommands({ getDesign, effects, run }: Ports) {
    function setWardrobeReach(value: number) {
        if (!Number.isFinite(value) || getDesign().profile.accessible) {
            return false;
        }
        const next = Math.max(140, Math.min(210, Math.round(value)));
        if (getDesign().profile.reach === next && (getDesign().reachLine ?? getDesign().profile.engaged)) {
            return false;
        }
        effects.checkpoint();
        getDesign().profile.reach = getDesign().profile.reachStd = next;
        getDesign().reachLine = true;
        getDesign().proposal = null;
        effects.changed(true);
        return true;
    }
    function setPreferences(profile: EditorProfile) {
        effects.checkpoint();
        getDesign().profile = profile;
        effects.changed();
    }
    function setFinish(finish: EditorState['fin']) {
        run(() => getDesign().fin = finish);
    }
    function setDoors(doors: EditorState['doors']) {
        run(() => {
            getDesign().doors = doors;
            getDesign().open = false;
        });
    }
    function setReachLine(enabled: boolean) {
        effects.checkpoint();
        getDesign().reachLine = enabled;
        effects.changed(true);
    }
    return { setWardrobeReach, setPreferences, setFinish, setDoors, setReachLine };
}
