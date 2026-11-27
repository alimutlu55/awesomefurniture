import { noopAnalytics, type TrackEvent } from '../analytics/analytics-port';
import { createKitchenConstructionCommands } from './kitchen-construction';
import { growRearWithFront } from './front-growth';
import { ceilingClearance, CEILING_CLEARANCE_TOLERANCE } from '../../domain/studio/studio-clearance';
import type { EditorScene, EditorState, EditorCabinet } from '../projects/editor-scene';
import { createEditorState, resetCabinetState } from '../projects/editor-state';
import { emptyCabinet } from '../projects/editor-model';
import { startingScene } from '../projects/editor-mapper';
import { placeCreatedCabinet, type CreationSize } from './place-created-cabinet';
import { createStudioCommands } from './studio-commands';
import { createPieceCommands } from './piece-commands';
import { createCeilingCommands } from './ceiling-commands';
import { createAlignCommands } from './align-commands';
import { createFillCommands } from './fill-commands';
import { createReachCommands } from './reach-commands';
import { createKitchenCommands } from './kitchen-commands';
import { studioObstacles } from '../../domain/studio/studio-obstacles';
import { createStudioRoomEdits } from './studio-room-edits';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry.js';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry.js';
import { createDesignCommands } from './design-commands.js';
import { createFromTemplate } from '../../domain/wardrobe/shape/shape-templates';
import { friendlyProblem, resolveShape, maxHeight, shapeProblems, type ShapeTemplateId, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { furnitureModule } from '../../domain/furniture/furniture';
export interface ShapeFrame { w: number; x: number; z: number }
interface SceneCommandOptions {
    initialDesign?: () => EditorState;
    checkpoint?: () => void;
    discardCheckpoint?: () => void;
    report?: (message: string) => void;
    track?: TrackEvent;
}
export function createSceneCommands(getScene: () => EditorScene, { initialDesign = createEditorState, checkpoint = () => { }, discardCheckpoint = () => { }, report = () => { }, track = noopAnalytics.track }: SceneCommandOptions = {}) {
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
    const blockedMessage = (change: string, candidate: EditorCabinet) => {
        const hit = collision.cabinetObstruction(candidate);
        if (hit === 'furnishing') return change + ' would run into room furniture. Move it first.';
        if (hit === 'wall' || hit === 'fixture') return change + (hit === 'wall' ? ' would go through a wall of the room.' : ' would run into a toilet or basin. Move it first.');
        const other = getScene().wardrobes.find(c => c.id !== candidate.id && collision.cabinetOverlaps(candidate, c));
        return change + ' would overlap another ' + (other ? furnitureModule(other.state).noun : 'wardrobe') + '. Move it first.';
    };
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
    const growCabinetFront = (c: EditorCabinet, shape: WardrobeShape, original: WardrobeShape, frame?: ShapeFrame): WardrobeShape => {
        const w = frame?.w ?? c.state.w;
        const blocked = ceilingClearance(getScene().studio, { ...c, ...(frame ?? {}), w, d: c.state.d }, 0);
        return growRearWithFront(original, shape, next => shapeProblems(next, w).length > 0 || blocked({ ...next,
            top: next.top.map(p => ({ ...p, y: p.y - CEILING_CLEARANCE_TOLERANCE })) }));
    };
    const pieces = createPieceCommands(getScene, { checkpoint, report, track, cabinet: {
        active, initialDesign, collision, ceilings, geometry, design, blockedMessage, growFrontShape: growCabinetFront, discardCheckpoint,
        duplicateKitchenUnit: kitchen.duplicateKitchenUnit,
    }, addKitchenUnit: kitchen.addKitchenUnit });
    const align = createAlignCommands(getScene, collision);
    const late = { resize: (_width: number) => false };
    const fill = createFillCommands({ getScene, active, checkpoint, discardCheckpoint, report, resize: width => late.resize(width) });
    const commands = {
        ...createKitchenConstructionCommands(getScene, checkpoint, report),
        /** A new default design, replacing every wardrobe and the entire room in one undo step. */
        resetScene() {
            checkpoint();
            const scene = getScene();
            delete scene.studio;
            Object.assign(scene, startingScene());
        },
        shapeEditProblem,
        growFrontShape: (shape: WardrobeShape, original = resolveShape(active().state), frame?: ShapeFrame) => growCabinetFront(active(), shape, original, frame),
        /** A front handle can use its clearance while the rear stays at its previous height. */
        frontShape(shape: WardrobeShape, original = resolveShape(active().state)): WardrobeShape {
            if (shape.back || !original || !ceilings.shapeBlocked(active(), shape)) return shape;
            return { ...shape, back: original.back ?? original.top.map(p => p.y) };
        },
        ...studio,
        ...kitchen,
        ...pieces,
        ...align,
        ...fill,
        ...createReachCommands(getScene, { checkpoint, report }),
        /** Room edits reshape the wardrobes under any ceiling they move. */
        placeStudio(id: Parameters<typeof studio.placeStudio>[0]) {
            const ok = studio.placeStudio(id);
            if (ok) ceilings.followAll();
            return ok;
        },
        ...createStudioRoomEdits(getScene, studio, ceilings),
        addStudioCeiling(shape: string, wall?: string) {
            const id = studio.addStudioCeiling(shape, wall);
            if (id) ceilings.followAll();
            return id;
        },
        /** After a live room drag (`refit` false) and when it is committed. True when a wardrobe changed. */
        followCeilings: (refit = true) => ceilings.followAll(refit),
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
            const cabinet = active(), state = resetCabinetState(cabinet.state, initialDesign);
            if (collision.cabinetCollides({ ...cabinet, state })) {
                report('Move this ' + furnitureModule(cabinet.state).noun + ' before resetting it.');
                return false;
            }
            checkpoint();
            Object.assign(cabinet.state, state);
            return true;
        },
    };
    late.resize = width => commands.setCabinetSize('w', width, false);
    return commands;
}
