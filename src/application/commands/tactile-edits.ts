import type { createEditorModel } from '../projects/editor-model';
import { createSceneCommands } from './scene-commands';
import { changeAccordionShelf } from './accordion-shelves';
import { resolveShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { editProfilePoint } from '../../domain/wardrobe/shape/shape-handle-edit';
import { AUTO_ALIGN_CM } from '../../domain/geometry/alignment';
import { sizeTargets } from './align-commands';
import { cabinetResizeTravel } from './millimetre-alignment';

export type ScrubDimension = 'w' | 'd' | 'h' | 'h-left' | 'h-right';
interface Ports {
    model: Pick<ReturnType<typeof createEditorModel>, 'activeCabinet' | 'snapshot' | 'restore' | 'scene'>;
    checkpoint(before: string): void;
}
/** A reversible preview transaction. Every preview starts from the same design,
 * so returning a finger to its origin also restores any fitted contents. */
export function createTactileEdits({ model, checkpoint }: Ports) {
    const commands = createSceneCommands(() => model.scene);
    type Gesture = { before: string; id: number; dimension: ScrubDimension; start: number }
        | { before: string; id: number; section: number; x: number; y: number; applied: number };
    let gesture: Gesture | null = null;
    const value = (key: ScrubDimension) => {
        const state = model.activeCabinet().state;
        if (key === 'h-left' || key === 'h-right') {
            const top = resolveShape(state).top; return top[key === 'h-left' ? 0 : top.length - 1]!.y;
        }
        return state[key];
    };
    function finish(cancel = false) {
        const g = gesture; gesture = null;
        if (!g) return false;
        if (cancel || ('section' in g && g.applied === 0)) { model.restore(g.before); return false; }
        const changed = model.snapshot() !== g.before;
        if (changed) checkpoint(g.before);
        return changed;
    }
    function previewDimension(delta: number) {
        const g = gesture;
        if (!g || !('dimension' in g) || !Number.isFinite(delta)) return null;
        const apply = (amount: number) => {
            model.restore(g.before);
            if (Math.abs(amount) < .01) return true;
            if (g.dimension === 'h-left' || g.dimension === 'h-right') {
                const shape = resolveShape(model.activeCabinet().state), index = g.dimension === 'h-left' ? 0 : shape.top.length - 1;
                const next = editProfilePoint(shape, 'front', index, { y: Math.round((g.start + amount) * 10) / 10 });
                return commands.setShape({ ...commands.growFrontShape(next, shape), template: 'custom' }, false);
            }
            return commands.setCabinetSize(g.dimension, g.start + amount, false);
        };
        if (!apply(delta)) {
            // Search whole millimetres, so a large pointer jump cannot leave a
            // visible remainder at a wall after a fixed number of iterations.
            const sign = Math.sign(delta);
            let lo = 0, hi = Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(Math.abs(delta) * 10));
            while (hi - lo > 1) {
                const mid = Math.floor(lo + (hi - lo) / 2);
                if (apply(sign * mid / 10)) lo = mid; else hi = mid;
            }
            apply(sign * lo / 10);
        }
        if (g.dimension === 'w' || g.dimension === 'h' || g.dimension === 'd') {
            const raw = model.snapshot(), before = structuredClone(model.activeCabinet()), key = g.dimension;
            const limit = key === 'h' ? AUTO_ALIGN_CM : AUTO_ALIGN_CM * 2;
            const targets = sizeTargets(model.scene, before, key).filter(t => Math.abs(t.v - before.state[key]) <= limit + 1e-6)
                .sort((a, b) => Math.abs(a.v - before.state[key]) - Math.abs(b.v - before.state[key]));
            for (const target of targets) {
                if (Math.abs(target.v - before.state[key]) < 1e-6) continue;
                if (apply(target.v - g.start) && Math.abs(value(key) - target.v) < .001
                    && cabinetResizeTravel(before, model.activeCabinet()) <= AUTO_ALIGN_CM + 1e-6) return value(key);
                model.restore(raw);
            }
        }
        return value(g.dimension);
    }
    return {
        value, finish, previewDimension, active: () => gesture !== null,
        beginDimension(dimension: ScrubDimension) {
            finish(true);
            const cabinet = model.activeCabinet();
            gesture = { before: model.snapshot(), id: cabinet.id, dimension, start: value(dimension) };
        },
        beginShelves(section: number, x: number, y: number, cabinetId = model.activeCabinet().id) {
            finish(true);
            const before = model.snapshot();
            if (!model.scene.wardrobes.some(c => c.id === cabinetId)) return;
            model.scene.activeWardrobe = cabinetId;
            gesture = { before, id: cabinetId, section, x, y, applied: 0 };
        },
        previewShelves(count: number) {
            const g = gesture;
            if (!g || !('section' in g) || !Number.isFinite(count)) return 0;
            model.restore(g.before);
            model.scene.activeWardrobe = g.id;
            let applied = 0;
            for (let n = 0; n < Math.min(8, Math.abs(Math.trunc(count))); n++) {
                if (!changeAccordionShelf(model.activeCabinet().state, g.section, g.x, g.y, Math.sign(count))) break;
                applied += Math.sign(count);
            }
            g.applied = applied; return applied;
        },
    };
}
