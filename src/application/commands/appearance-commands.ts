import { assertDecorZone, defaultMaterials, materialZoneFields, resolveMaterials, HANDLE_FINISHES, ACCESSORY_FINISHES, type HandleFinish, type AccessoryFinish } from '../../domain/materials/configured-materials';
import { getDecor, type TargetZone } from '../../domain/materials/decor-catalog';
import { designerPalettes } from '../../domain/materials/designer-palettes';
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
        run(() => { getDesign().fin = finish; getDesign().materials = defaultMaterials(finish); });
    }
    function setDecor(zone: TargetZone, id: string) {
        assertDecorZone(id, zone);
        if ((zone === 'worktop' || zone === 'backsplash') && getDesign().product !== 'kitchen') return false;
        run(() => {
            const materials = { ...resolveMaterials(getDesign()) };
            const linked = (zone === 'carcass' || zone === 'fronts') && materials.linkedDecors;
            const compatible = getDecor(id).allowedZones.includes('carcass') && getDecor(id).allowedZones.includes('fronts');
            if (linked && compatible) materials.carcassDecorId = materials.frontDecorId = id;
            else { materials[materialZoneFields[zone]] = id; if (linked) materials.linkedDecors = false; }
            if (zone === 'fronts') {
                const glass = getDecor(id).category === 'glass_mirror';
                if (glass || getDesign().doors !== 'none') getDesign().doors = glass ? 'glass' : 'hinged';
                if (glass) materials.frontProfile = 'slab';
            }
            getDesign().materials = materials;
        });
        return true;
    }
    function applyDesignerPalette(id: string) {
        const palette = designerPalettes.find(p => p.id === id);
        if (!palette) return false;
        run(() => {
            const design = getDesign();
            design.materials = { ...palette.materials, ...(design.product === 'kitchen' ? palette.kitchen : {}) };
            if (design.product !== 'kitchen') design.doors = getDecor(design.materials.frontDecorId).category === 'glass_mirror' ? 'glass' : 'hinged';
            design.open = false;
        });
        return true;
    }
    function setLinkedDecors(linked: boolean) {
        run(() => {
            const materials = { ...resolveMaterials(getDesign()), linkedDecors: linked };
            if (linked) materials.frontDecorId = materials.carcassDecorId;
            getDesign().materials = materials;
        });
    }
    function setHandleFinish(finish: HandleFinish) {
        if (!HANDLE_FINISHES.includes(finish)) return;
        run(() => { getDesign().materials = { ...resolveMaterials(getDesign()), handleFinish: finish }; });
    }
    function setAccessoryFinish(finish: AccessoryFinish) {
        if (!ACCESSORY_FINISHES.includes(finish)) return;
        run(() => { getDesign().materials = { ...resolveMaterials(getDesign()), internalAccessoryFinish: finish }; });
    }
    function setDoors(doors: EditorState['doors']) {
        run(() => {
            getDesign().doors = doors;
            getDesign().open = false;
        });
    }
    function setDoorHang(doorHang: 'left' | 'right' | 'corner-l' | 'corner-r' | null) {
        run(() => {
            if (doorHang === 'corner-l' || doorHang === 'corner-r') {
                for (const sec of getDesign().secs) for (const it of sec) if (it.k === 'corner') it.ax = doorHang === 'corner-r' ? 'r' : 'l';
                return;
            }
            if (!doorHang) delete getDesign().doorHang;
            else getDesign().doorHang = doorHang;
            for (const sec of getDesign().secs) for (const it of sec) delete it.hinge;
        });
    }
    function setReachLine(enabled: boolean) {
        effects.checkpoint();
        getDesign().reachLine = enabled;
        effects.changed(true);
    }
    return { setDecor, setLinkedDecors, applyDesignerPalette, setHandleFinish, setAccessoryFinish, setWardrobeReach, setPreferences, setFinish, setDoors, setDoorHang, setReachLine };
}
