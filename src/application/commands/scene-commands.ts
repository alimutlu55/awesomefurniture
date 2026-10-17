import { growRearWithFront } from './front-growth';
import { ceilingClearance, CEILING_CLEARANCE_TOLERANCE } from '../../domain/studio/studio-clearance';
import type { EditorScene, EditorState, EditorCabinet } from '../projects/editor-scene';
import { createEditorState } from '../projects/editor-state';
import { emptyCabinet } from '../projects/editor-model';
import { startingScene } from '../projects/editor-mapper';
import { placeCreatedCabinet, type CreationSize } from './place-created-cabinet';
import { createStudioCommands } from './studio-commands';
import { createCeilingCommands } from './ceiling-commands';
import { createAlignCommands } from './align-commands';
import { createKitchenCommands } from './kitchen-commands';
import { sectionsUnder } from '../../domain/studio/studio-fit';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { createDesignCommands } from './design-commands.js';
import { createFromTemplate } from '../../domain/wardrobe/shape/shape-templates';
import { friendlyProblem, resolveShape, regularShape, shapePanels, maxHeight, resizeShape, shapeProblems, type ShapeTemplateId, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { furnitureModule, isKitchen } from '../../domain/furniture/furniture';
export interface ShapeFrame { w: number; x: number; z: number }
/** Whole-cabinet edits share the same centimetre model and collision rules. */
interface SceneCommandOptions {
    initialDesign?: () => EditorState;
    checkpoint?: () => void;
    discardCheckpoint?: () => void;
    report?: (message: string) => void;
}
export function createSceneCommands(getScene: () => EditorScene, { initialDesign = createEditorState, checkpoint = () => { }, discardCheckpoint = () => { }, report = () => { } }: SceneCommandOptions = {}) {
    let spare: EditorCabinet | null = null;
    const active = (): EditorCabinet => { if (!getScene().wardrobes.length) return spare ??= emptyCabinet();
        const cabinet = getScene().wardrobes.find(w => w.id === getScene().activeWardrobe); if (!cabinet)
        throw new Error('Active wardrobe is missing.'); return cabinet; };
    const collision = createCabinetGeometry(() => getScene().wardrobes, () => studioObstacles(getScene().studio));
    const geometry = createWardrobeGeometry(() => active().state);
    const design = createDesignCommands(() => active().state, { report });
    const studio = createStudioCommands(getScene, { checkpoint, discardCheckpoint, report });
    const ceilings = createCeilingCommands(getScene, report);
    /** A cabinet with nothing to stand beside goes where a new wardrobe would: beside the others, or against a free
     * wall (the wall in view, from the point in view, when `placement` names them). */
    const placeAlone = (cabinet: EditorCabinet, placement: CreationSize = {}) => {
        const scene = getScene(), bounds = collision.sceneBounds();
        if (scene.wardrobes.length) cabinet.x = Math.round((bounds.x + bounds.w / 2 + collision.cabinetBounds(cabinet).hw + 15) * 10) / 10;
        const placed = placeCreatedCabinet(scene, cabinet, false, undefined, placement);
        if (placed) createDesignCommands(() => placed.state, { report }).fitToShape();
        return placed;
    };
    const kitchen = createKitchenCommands(getScene, { checkpoint, report, placeAlone });
    /** Why a change is refused: it would run into a wall of the room, or into another piece of furniture (named by its kind). */
    const blockedMessage = (change: string, candidate: EditorCabinet) => {
        if (collision.cabinetObstruction(candidate) === 'wall') return change + ' would go through a wall of the room.';
        const other = getScene().wardrobes.find(c => c.id !== candidate.id && collision.cabinetOverlaps(candidate, c));
        return change + ' would overlap another ' + (other ? furnitureModule(other.state).noun : 'wardrobe') + '. Move it first.';
    };
    /** The same constraints apply to numeric edits, keyboard nudges and live handles. */
    const shapeEditProblem = (shape: WardrobeShape, frame?: ShapeFrame): string | null => {
        const cabinet = active(), w = frame?.w ?? cabinet.state.w;
        const [minW, maxW] = furnitureModule(cabinet.state).sizes(cabinet.state).w;
        if (!Number.isFinite(w) || (w !== cabinet.state.w && (w < Math.max(minW, geometry.minTotal()) - .01 || w > maxW))) return 'Keep the wardrobe within its allowed width.';
        if (frame && (!Number.isFinite(frame.x) || !Number.isFinite(frame.z))) return 'Wardrobe position must be a number.';
        const problem = shapeProblems(shape, w)[0];
        if (problem) return friendlyProblem(problem);
        const candidate = { ...cabinet, ...(frame ? { x: frame.x, z: frame.z } : {}), state: { ...cabinet.state, w, shape, h: maxHeight(shape) } };
        const underCeiling = ceilings.shapeBlocked(candidate, shape);
        if (underCeiling) return underCeiling;
        return collision.cabinetCollides(candidate) ? blockedMessage('That shape', candidate) : null;
    };
    const growFrontShape = (shape: WardrobeShape, original = resolveShape(active().state), frame?: ShapeFrame): WardrobeShape => {
        const c = active(), w = frame?.w ?? c.state.w;
        const blocked = ceilingClearance(getScene().studio, { ...c, ...(frame ?? {}), w, d: c.state.d }, 0);
        return growRearWithFront(original, shape, next => shapeProblems(next, w).length > 0 || blocked({ ...next,
            top: next.top.map(p => ({ ...p, y: p.y - CEILING_CLEARANCE_TOLERANCE })) }));
    };
    return {
        /** A new default design, replacing every wardrobe and the entire room in one undo step. */
        resetScene() {
            checkpoint();
            const scene = getScene();
            delete scene.studio;
            Object.assign(scene, startingScene());
        },
        shapeEditProblem, growFrontShape,
        /** A front handle can use its clearance while the rear stays at its previous height. */
        frontShape(shape: WardrobeShape, original = resolveShape(active().state)): WardrobeShape {
            if (shape.back || !original || !ceilings.shapeBlocked(active(), shape)) return shape;
            return { ...shape, back: original.back ?? original.top.map(p => p.y) };
        },
        ...studio,
        ...kitchen,
        ...createAlignCommands(getScene, collision),
        /** Room edits reshape the wardrobes under any ceiling they move. */
        placeStudio(id: Parameters<typeof studio.placeStudio>[0]) {
            const ok = studio.placeStudio(id);
            if (ok) ceilings.followAll();
            return ok;
        },
        editStudio(edit: Parameters<typeof studio.editStudio>[0], recordHistory = true, quiet = false) {
            const ok = studio.editStudio(edit, recordHistory, quiet);
            if (ok) ceilings.followAll(recordHistory);
            return ok;
        },
        addStudioCeiling(shape: string, wall?: string) {
            const id = studio.addStudioCeiling(shape, wall);
            if (id) ceilings.followAll();
            return id;
        },
        /** After a live room drag (`refit` false) and when it is committed. True when a wardrobe changed. */
        followCeilings: (refit = true) => ceilings.followAll(refit),
        /** A wardrobe dropped after a drag or a turn takes the ceiling over it. Returns why it cannot stand there. */
        settleCabinet(id: number) {
            const cabinet = getScene().wardrobes.find(w => w.id === id), problem = cabinet ? ceilings.follow(cabinet) : null;
            if (problem) report(problem);
            return problem;
        },
        /** Adds a wardrobe beside the others, or in a room against the first free wall. Given a `wall`, it
         * fills that wall's free stretch instead, as wide as it allows. */
        addCabinet(copy = false, template?: ShapeTemplateId, wall?: string, size: CreationSize = {}) {
            // A kitchen unit is copied along its run, without its appliances.
            if (copy && isKitchen(active().state)) return kitchen.duplicateKitchenUnit();
            const scene = getScene(), original = active(), bounds = collision.sceneBounds(), id = scene.nextWardrobeId;
            const state = copy ? structuredClone(original.state) : initialDesign();
            // A size asked for (a design spec): set before the shape and the place are worked out.
            if (!copy) for (const k of ['w', 'h', 'd'] as const) if (size[k] !== undefined) state[k] = size[k]!;
            if (!copy && template && template !== 'regular') {
                const start = createFromTemplate(template, { w: state.w, h: state.h, maxN: 6 });
                Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
            }
            let cabinet: EditorCabinet = { id, name: 'Wardrobe ' + id, x: 0, y: copy ? (original.y || 0) : 0, z: original.z, angle: copy ? original.angle : 0, state };
            if (scene.wardrobes.length) cabinet.x = Math.round((bounds.x + bounds.w / 2 + collision.cabinetBounds(cabinet).hw + 15) * 10) / 10;
            const placed = placeCreatedCabinet(scene, cabinet, copy, wall, size);
            if (!placed) {
                report(wall || size.placementWall ? 'The wardrobe does not fit on this wall within the room and its ceiling.'
                    : 'The wardrobe does not fit in the available studio space.');
                return null;
            }
            cabinet = placed;
            if (wall && !copy && cabinet.state.shape) {
                const geometry = createWardrobeGeometry(() => cabinet.state);
                Object.assign(cabinet.state, sectionsUnder(cabinet.state.shape, cabinet.state.w, geometry.maxN()));
                cabinet.state.sel = Math.min(cabinet.state.sel, cabinet.state.n - 1);
            }
            createDesignCommands(() => cabinet.state, { report }).fitToShape();
            checkpoint();
            scene.wardrobes.push(cabinet);
            scene.activeWardrobe = id;
            scene.nextWardrobeId++;
            return cabinet;
        },
        removeCabinet() {
            const scene = getScene();
            if (!scene.wardrobes.length) {
                return false;
            }
            checkpoint();
            const index = scene.wardrobes.findIndex(w => w.id === scene.activeWardrobe), removed = scene.wardrobes.splice(index, 1)[0];
            // The last wardrobe leaves an empty floor or room. Nothing is active until a wardrobe is added.
            scene.activeWardrobe = scene.wardrobes[Math.min(index, scene.wardrobes.length - 1)]?.id ?? 0;
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
            // Pressed against a wall or a neighbour, it slides along it: the part of the move that is free still happens.
            const moves = [pose, { ...pose, z: cabinet.z }, { ...pose, x: cabinet.x }].map(p => collision.safeCabinetTranslation(cabinet, p));
            const travel = (p: Pick<EditorCabinet, 'x' | 'y' | 'z'>) => Math.hypot(p.x - cabinet.x, (p.y || 0) - (cabinet.y || 0), p.z - cabinet.z);
            Object.assign(cabinet, moves.reduce((best, p) => travel(p) > travel(best) + .01 ? p : best));
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
            const before = { x: cabinet.x, y: cabinet.y, z: cabinet.z, angle: cabinet.angle };
            Object.assign(cabinet, pose);
            const problem = ceilings.follow(cabinet);
            if (problem) {
                Object.assign(cabinet, before);
                discardCheckpoint();
                report(problem);
                return false;
            }
            return true;
        },
        setCabinetSize(key: string, value: number, recordHistory = true) {
            const cabinet = active(), state = cabinet.state;
            const ranges = furnitureModule(state).sizes(state), range = ranges[key as keyof typeof ranges];
            if (!range || !Number.isFinite(value)) {
                return false;
            }
            let requested = Math.max(range[0]!, Math.min(range[1]!, Math.round(value * 10) / 10));
            if (key === 'w') {
                requested = Math.max(requested, geometry.minTotal());
            }
            if (state[key as 'w' | 'h' | 'd'] === requested) return false;
            const pose = collision.cabinetResizePose(cabinet, key, requested);
            if (!pose) {
                report(blockedMessage('That size', { ...cabinet, state: { ...state, [key]: requested } }));
                return false;
            }
            const previous = structuredClone(state), previousPose = { x: cabinet.x, y: cabinet.y, z: cabinet.z };
            let next = state.shape && key !== 'd' ? resizeShape(state.shape, state.w, key === 'w' ? requested : state.w, state.h, key === 'h' ? requested : state.h) : state.shape;
            if (key === 'h') {
                const top = next ?? regularShape(state.w, requested);
                let blocked = ceilings.shapeBlocked({ ...cabinet, ...pose }, top);
                if (blocked && requested > state.h) {
                    const original = resolveShape(state), front = growFrontShape(
                        { ...top, template: 'custom', back: original.back ?? original.top.map(p => p.y) }, original, { w: state.w, x: pose.x, z: pose.z });
                    if (!ceilings.shapeBlocked({ ...cabinet, ...pose }, front)) { next = front; blocked = null; }
                    else if (pose.y >= requested - state.h) {
                        const lowered = { ...pose, y: pose.y - (requested - state.h) };
                        if (!collision.cabinetCollides({ ...cabinet, ...lowered, state: { ...state, h: requested } })
                            && !ceilings.shapeBlocked({ ...cabinet, ...lowered }, top)) { Object.assign(pose, lowered); blocked = null; }
                    }
                }
                if (blocked) return false;
            }
            if (next && key !== 'd') {
                const problem = shapeProblems(next, key === 'w' ? requested : state.w)[0];
                if (problem) {
                    report(friendlyProblem(problem));
                    return false;
                }
            }
            if (recordHistory) checkpoint();
            Object.assign(cabinet, pose);
            state.shape = next;
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
            // Preview and commit use the same fitted top at the new footprint and pose.
            if (state.shape?.template === 'room' && key === 'h') state.shape.template = 'custom';
            const ceilingProblem = ceilings.follow(cabinet, false);
            if (ceilingProblem) {
                Object.assign(state, previous); Object.assign(cabinet, previousPose);
                state.shape = previous.shape;
                if (recordHistory) discardCheckpoint();
                return false;
            }
            if (collision.cabinetCollides(cabinet)) {
                Object.assign(state, previous); Object.assign(cabinet, previousPose); state.shape = previous.shape;
                if (recordHistory) discardCheckpoint();
                return false;
            }
            design.refitAfterSize();
            if ((state.dividers || []).some((d, j) => !geometry.dividerValid(d, j))) {
                Object.assign(state, previous);
                state.shape = previous.shape;
                Object.assign(cabinet, previousPose);
                if (recordHistory) discardCheckpoint();
                report('Move the dividers or items before reducing the wardrobe size');
                return false;
            }
            // A width change scales slopes, so say what the slope is now.
            if (state.shape && key === 'w' && recordHistory && state.shape.template !== 'room') {
                const longest = shapePanels(state.shape).filter(p => p.kind === 'top').sort((a, b) => b.length - a.length)[0];
                if (longest) report('Width ' + state.w + ' cm · top panel now ' + Math.round(longest.angle) + '°');
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
            const underCeiling = ceilings.shapeBlocked(cabinet, template === 'regular' ? { template, top: [{ x: 0, y: state.h }, { x: state.w, y: state.h }] } : shape);
            if (underCeiling) {
                return false;
            }
            if (template === 'regular') delete next.shape;
            else next.shape = shape;
            next.h = maxHeight(shape);
            if (collision.cabinetCollides({ ...cabinet, state: next })) {
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
        setShape(shape: WardrobeShape, recordHistory = true, refit = true, frame?: ShapeFrame) {
            const cabinet = active(), state = cabinet.state, problem = shapeEditProblem(shape, frame);
            if (problem) {
                // Room boundaries silently stop the edit. Keep feedback for
                // malformed skeletons, such as a panel that is too narrow.
                const geometryProblem = shapeProblems(shape, frame?.w ?? state.w)[0];
                if (geometryProblem) report(friendlyProblem(geometryProblem));
                return false;
            }
            const h = maxHeight(shape), widthChanged = frame && frame.w !== state.w;
            if (JSON.stringify(shape) === JSON.stringify(state.shape) && (!frame || (frame.w === state.w && frame.x === cabinet.x && frame.z === cabinet.z))) return false;
            if (recordHistory) checkpoint();
            if (frame) { state.w = frame.w; cabinet.x = frame.x; cabinet.z = frame.z; }
            state.shape = structuredClone(shape);
            if (state.shape.template === 'room') state.shape.template = 'custom';
            state.h = h;
            state.proposal = null;
            // Live previews skip refitting so a drag never destroys fittings; the
            // final commit refits once.
            if (refit) {
                if (widthChanged) design.refitAfterSize();
                design.fitToShape();
            }
            return true;
        },
        resetCabinet() {
            // A kitchen cabinet goes back to an empty unit of its kind; a wardrobe to the new-wardrobe design.
            const current = active().state, module = furnitureModule(current), fresh = module.reset?.(current);
            const state = fresh ? { ...createEditorState(), ...fresh } : initialDesign();
            if (collision.cabinetCollides({ ...active(), state })) {
                report('Move this ' + module.noun + ' before resetting its size.');
                return false;
            }
            checkpoint();
            Object.assign(active().state, state, { open: false });
            return true;
        },
    };
}
