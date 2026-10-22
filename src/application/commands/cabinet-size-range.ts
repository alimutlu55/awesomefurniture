import type { EditorScene } from '../projects/editor-scene';
import { createSceneCommands } from './scene-commands';
import { furnitureModule } from '../../domain/furniture/furniture';

type Axis = 'w' | 'h' | 'd';
type Ranges = Record<Axis, [number, number]>;
/** Query reachable millimetre dimensions through the same placement, ceiling,
 * skeleton and fitting rules as a resize. Probes never touch the live model. */
export function createCabinetSizeRange(getScene: () => EditorScene) {
    let key = '', cached: Ranges | null = null;
    return () => {
        const scene = getScene(), cabinet = scene.wardrobes.find(c => c.id === scene.activeWardrobe);
        if (!cabinet) return null;
        // Selection does not alter constraints. Cache across selection and UI refreshes.
        const nextKey = JSON.stringify(scene, (name, value) => ['sel', 'item', 'divider', 'space'].includes(name) ? undefined : value);
        if (cached && nextKey === key) return cached;
        const original = structuredClone(scene);
        let probe = original;
        const commands = createSceneCommands(() => probe), catalogue = furnitureModule(cabinet.state).sizes(cabinet.state);
        const result = {} as Ranges;
        for (const axis of ['w', 'h', 'd'] as const) {
            const start = cabinet.state[axis];
            const accepts = (value: number) => {
                if (Math.abs(value - start) < .001) return true;
                probe = structuredClone(original);
                if (!commands.setCabinetSize(axis, value, false)) return false;
                const applied = probe.wardrobes.find(c => c.id === cabinet.id)!.state[axis];
                return Math.abs(applied - value) < .001;
            };
            const endpoint = (target: number) => {
                if (accepts(target)) return target;
                const direction = Math.sign(target - start);
                let lo = 0, hi = Math.ceil(Math.abs(target - start) * 10);
                while (hi - lo > 1) {
                    const mid = Math.floor((lo + hi) / 2), value = Math.round((start + direction * mid / 10) * 10) / 10;
                    if (accepts(value)) lo = mid; else hi = mid;
                }
                return Math.round((start + direction * lo / 10) * 10) / 10;
            };
            result[axis] = [endpoint(Math.min(start, catalogue[axis][0]!)), endpoint(Math.max(start, catalogue[axis][1]!))];
        }
        key = nextKey; cached = result;
        return result;
    };
}
