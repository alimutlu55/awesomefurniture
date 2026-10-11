import type { EditorScene, EditorState, EditorCabinet } from '../projects/editor-scene';
import { createEditorState } from '../projects/editor-state';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { createDesignCommands } from './design-commands.js';
import { createFromTemplate } from '../../domain/wardrobe/shape/shape-templates';
import { friendlyProblem, isRegularShape, maxHeight, minimumShapeHeight, resizeShape, shapeProblems, type ShapeTemplateId, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
/** Whole-cabinet edits share the same centimetre model and collision rules. */
interface SceneCommandOptions {
    initialDesign?: () => EditorState;
    checkpoint?: () => void;
    discardCheckpoint?: () => void;
    report?: (message: string) => void;
}
export function createSceneCommands(getScene: () => EditorScene, { initialDesign = createEditorState, checkpoint = () => { }, discardCheckpoint = () => { }, report = () => { } }: SceneCommandOptions = {}) {
    const active = (): EditorCabinet => { const cabinet = getScene().wardrobes.find(w => w.id === getScene().activeWardrobe); if (!cabinet)
        throw new Error('Active wardrobe is missing.'); return cabinet; };
    const collision = createCabinetGeometry(() => getScene().wardrobes);
    const geometry = createWardrobeGeometry(() => active().state);
    const design = createDesignCommands(() => active().state, { report });
    return {
        addCabinet(copy = false, template?: ShapeTemplateId) {
            checkpoint();
            const scene = getScene(), original = active(), bounds = collision.sceneBounds(), id = scene.nextWardrobeId++;
            const state = copy ? structuredClone(original.state) : initialDesign();
            if (!copy && template && template !== 'regular') {
                const start = createFromTemplate(template, { w: state.w, h: state.h, maxN: 6 });
                Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
            }
            const cabinet = { id, name: 'Wardrobe ' + id, x: 0, y: copy ? (original.y || 0) : 0, z: original.z, angle: copy ? original.angle : 0, state };
            cabinet.x = Math.round((bounds.x + bounds.w / 2 + collision.cabinetBounds(cabinet).hw + 15) * 10) / 10;
            scene.wardrobes.push(cabinet);
            scene.activeWardrobe = id;
            return cabinet;
        },
        removeCabinet() {
            const scene = getScene();
            if (scene.wardrobes.length < 2) {
                return false;
            }
            checkpoint();
            const index = scene.wardrobes.findIndex(w => w.id === scene.activeWardrobe), removed = scene.wardrobes.splice(index, 1)[0];
            scene.activeWardrobe = scene.wardrobes[Math.min(index, scene.wardrobes.length - 1)]!.id;
            const state = active().state;
            state.item = -1;
            state.divider = -1;
            state.space = null;
            return removed!.name;
        },
        previewRotation(id: number, angle: number) {
            const cabinet = getScene().wardrobes.find(w => w.id === id);
            if (!cabinet) {
                return false;
            }
            cabinet.angle = collision.safeCabinetRotation(cabinet, angle);
            return true;
        },
        previewTranslation(id: number, pose: Pick<EditorCabinet, 'x' | 'y' | 'z'>) {
            const cabinet = getScene().wardrobes.find(w => w.id === id);
            if (!cabinet) {
                return false;
            }
            Object.assign(cabinet, collision.safeCabinetTranslation(cabinet, pose));
            return true;
        },
        restorePose(id: number, pose: Partial<Pick<EditorCabinet, 'x' | 'y' | 'z' | 'angle'>>) {
            const cabinet = getScene().wardrobes.find(w => w.id === id);
            if (cabinet) {
                Object.assign(cabinet, pose);
            }
        },
        setCabinetPose(key: string, value: number) {
            if ((key !== 'x' && key !== 'y' && key !== 'z' && key !== 'angle') || !Number.isFinite(value)) {
                return false;
            }
            value = key === 'angle' ? ((value % 360) + 360) % 360 : Math.max(key === 'y' ? 0 : -5000, Math.min(5000, value));
            const cabinet = active();
            if (cabinet[key] === value) {
                return false;
            }
            const pose: Partial<Pick<EditorCabinet, 'x' | 'y' | 'z' | 'angle'>> = key === 'angle' ? { angle: collision.safeCabinetRotation(cabinet, value) } : collision.safeCabinetTranslation(cabinet, { x: cabinet.x, y: cabinet.y || 0, z: cabinet.z, [key]: value });
            if (key === 'angle' ? Math.abs(pose.angle! - cabinet.angle) < 1e-5 : (['x', 'y', 'z'] as const).every(k => Math.abs((cabinet[k] || 0) - pose[k]!) < 1e-5)) {
                return false;
            }
            checkpoint();
            Object.assign(cabinet, pose);
            return true;
        },
        setCabinetSize(key: string, value: number, recordHistory = true) {
            const state = active().state, shaped = !isRegularShape(state.shape);
            const ranges = { w: [80, 400], h: [shaped && state.shape ? Math.max(60, Math.ceil(minimumShapeHeight(state.shape))) : 180, 280], d: [35, 80] }, range = ranges[key as keyof typeof ranges];
            if (!range || !Number.isFinite(value)) {
                return false;
            }
            let requested = Math.max(range[0]!, Math.min(range[1]!, Math.round(value)));
            if (key === 'w') {
                requested = Math.max(requested, geometry.minTotal());
            }
            if (state[key as 'w' | 'h' | 'd'] === requested) return false;
            if (collision.cabinetCollides({ ...active(), state: { ...state, [key]: requested } })) {
                report('That size would overlap another wardrobe. Move it first.');
                return false;
            }
            const previous = structuredClone(state);
            if (state.shape && key !== 'd') {
                const next = resizeShape(state.shape, state.w, key === 'w' ? requested : state.w, state.h, key === 'h' ? requested : state.h), problem = shapeProblems(next, key === 'w' ? requested : state.w)[0];
                if (problem) {
                    report(friendlyProblem(problem));
                    return false;
                }
            }
            if (recordHistory) checkpoint();
            if (state.shape && key !== 'd') state.shape = resizeShape(state.shape, state.w, key === 'w' ? requested : state.w, state.h, key === 'h' ? requested : state.h);
            state[key as 'w' | 'h' | 'd'] = requested;
            // The skeleton's tallest point is the cabinet height.
            if (state.shape) state.h = maxHeight(state.shape);
            state.n = Math.min(state.n, geometry.maxN());
            state.sel = Math.min(state.sel, state.n - 1);
            if (key === 'w') {
                const minimum = geometry.minTotal();
                if (state.w < minimum) {
                    state.w = minimum;
                    report('Narrowest width that keeps all your modules: ' + minimum + ' cm');
                }
            }
            if (state.shape && key === 'w') {
                // Clamping to the narrowest width must keep the skeleton in step.
                state.shape = resizeShape(state.shape, state.shape.top[state.shape.top.length - 1]!.x, state.w, state.h, state.h);
            }
            design.refitAfterSize();
            if ((state.dividers || []).some((d, j) => !geometry.dividerValid(d, j))) {
                Object.assign(state, previous);
                if (recordHistory) discardCheckpoint();
                report('Move the dividers or items before reducing the wardrobe size');
                return false;
            }
            return true;
        },
        /** Replace the skeleton with a template's starting geometry. An empty
         * wardrobe also takes the template's sections; fittings are refitted. */
        applyShapeTemplate(template: ShapeTemplateId) {
            const cabinet = active(), state = cabinet.state, empty = !state.secs.some(items => items.length) && !state.dividers.length;
            const start = createFromTemplate(template, { w: state.w, h: state.h, maxN: geometry.maxN() });
            const next = structuredClone(state);
            if (empty) Object.assign(next, { n: start.n, wt: start.wt, sel: Math.min(state.sel, start.n - 1) });
            const shape = structuredClone(start.shape);
            // Anchored steps follow existing partitions only when those partitions exist.
            if (!empty) shape.top.forEach(p => { if (p.partition !== undefined && p.partition >= next.n - 1) delete p.partition; });
            if (shapeProblems(shape, state.w).length) {
                report('This shape does not fit a ' + state.w + ' cm wide wardrobe.');
                return false;
            }
            if (template === 'regular') delete next.shape;
            else next.shape = shape;
            next.h = maxHeight(shape);
            if (collision.cabinetCollides({ ...cabinet, state: next })) {
                report('That shape would overlap another wardrobe. Move it first.');
                return false;
            }
            checkpoint();
            Object.assign(state, next);
            if (template === 'regular') delete state.shape;
            state.proposal = null;
            design.fitToShape();
            return true;
        },
        /** Commit an edited skeleton. Invalid geometry is rejected with its reason;
         * fittings and shelf boards that no longer fit are compacted or removed. */
        setShape(shape: WardrobeShape, recordHistory = true, refit = true) {
            const cabinet = active(), state = cabinet.state, problem = shapeProblems(shape, state.w)[0];
            if (problem) {
                report(friendlyProblem(problem));
                return false;
            }
            const h = maxHeight(shape);
            if (JSON.stringify(shape) === JSON.stringify(state.shape)) return false;
            if (collision.cabinetCollides({ ...cabinet, state: { ...state, h } })) {
                report('That height would overlap another wardrobe. Move it first.');
                return false;
            }
            if (recordHistory) checkpoint();
            state.shape = structuredClone(shape);
            state.h = h;
            state.proposal = null;
            // Live previews skip refitting so a drag never destroys fittings; the
            // final commit refits once.
            if (refit) design.fitToShape();
            return true;
        },
        resetCabinet() {
            const state = initialDesign();
            if (collision.cabinetCollides({ ...active(), state })) {
                report('Move this wardrobe before resetting its size.');
                return false;
            }
            checkpoint();
            Object.assign(active().state, state, { open: false });
            return true;
        },
    };
}
