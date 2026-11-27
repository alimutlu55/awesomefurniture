import { reconcileInstallation } from '../projects/installation-reconciliation';
import type { EditorCabinet, EditorScene, EditorState } from '../projects/editor-scene';
import { createCabinetGeometry } from '../../domain/geometry/cabinet-geometry';
import { createWardrobeGeometry } from '../../domain/geometry/wardrobe-geometry';
import { isKitchen } from '../../domain/furniture/furniture';
import { piecePreset } from '../../domain/furniture/piece-presets';
import type { Pose } from '../../domain/pieces/piece-model';
import { pieceOf, roomOf } from '../../domain/pieces/pieces';
import { sectionsUnder } from '../../domain/studio/studio-fit';
import { applyMaxReach } from '../../domain/wardrobe/max-reach';
import { createFromTemplate } from '../../domain/wardrobe/shape/shape-templates';
import { friendlyProblem, resolveShape, regularShape, shapePanels, maxHeight, resizeShape, shapeProblems, type ShapeTemplateId, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { applyPiecePreset } from './piece-preset-commands';
import { placeCreatedCabinet, type CreationSize } from './place-created-cabinet';
import type { createCeilingCommands } from './ceiling-commands';
import { createDesignCommands } from './design-commands';

interface CabinetCommandOptions {
  checkpoint(): void;
  discardCheckpoint(): void;
  report(message: string): void;
  active(): EditorCabinet;
  initialDesign(): EditorState;
  collision: ReturnType<typeof createCabinetGeometry>;
  ceilings: ReturnType<typeof createCeilingCommands>;
  geometry: ReturnType<typeof createWardrobeGeometry>;
  design: ReturnType<typeof createDesignCommands>;
  blockedMessage(change: string, candidate: EditorCabinet): string;
  growFrontShape(cabinet: EditorCabinet, shape: WardrobeShape, original: WardrobeShape, frame: { w: number; x: number; z: number }): WardrobeShape;
  duplicateKitchenUnit(id?: number): EditorCabinet | null;
}

/** Cabinet construction and installation adapters for the shared piece commands. */
export function createCabinetPieceCommands(getScene: () => EditorScene, options: CabinetCommandOptions) {
  const { active, initialDesign, collision, ceilings, blockedMessage, growFrontShape, duplicateKitchenUnit,
    checkpoint, discardCheckpoint, report } = options;
  const room = () => roomOf(getScene().studio, getScene().wardrobes);

  function commitPose(cabinet: EditorCabinet, pose: Pose) {
    const before = { x: cabinet.x, y: cabinet.y, z: cabinet.z, angle: cabinet.angle };
    const next = { ...pose, y: pose.y ?? cabinet.y };
    if ((['x', 'y', 'z', 'angle'] as const).every(key => Math.abs(next[key] - before[key]) < 1e-5)) return false;
    checkpoint();
    Object.assign(cabinet, next);
    const problem = ceilings.follow(cabinet);
    if (!problem) return true;
    Object.assign(cabinet, before);
    discardCheckpoint();
    report(problem);
    return false;
  }
  return {
    /** A wardrobe dropped after a drag or a turn takes the ceiling over it. Returns why it cannot stand there. */
    settleCabinet(id: number) {
        const cabinet = getScene().wardrobes.find(w => w.id === id);
        const problem = cabinet && collision.cabinetCollides(cabinet)
            ? 'That placement overlaps another cabinet or its corner installation parts.' : cabinet ? ceilings.follow(cabinet) : null;
        if (problem) report(problem);
        else if (!reconcileInstallation(getScene())) report('An installation strip or separator does not fit. Adjust the cabinets manually.');
        return problem;
    },
    /** Adds a wardrobe beside the others, or in a room against the first free wall. Given a `wall`, it
     * fills that wall's free stretch instead, as wide as it allows. */
    addCabinet(copy = false, template?: ShapeTemplateId, wall?: string, size: CreationSize = {}, source = active()) {
        // A kitchen unit is copied along its run, without its appliances.
        if (copy && isKitchen(source.state)) return duplicateKitchenUnit(source.id);
        const scene = getScene(), original = source, bounds = collision.sceneBounds(), id = scene.nextWardrobeId;
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
            const label = copy ? original.name : piecePreset(size.preset)?.name ?? 'Wardrobe';
            report(wall || (size.placementWall && !size.fallbackToRoom) ? label + ' does not fit on the selected wall.'
                : label + ' does not fit in the available room space.');
            return null;
        }
        cabinet = placed;
        if (wall && !copy && cabinet.state.shape) {
            const geometry = createWardrobeGeometry(() => cabinet.state);
            Object.assign(cabinet.state, sectionsUnder(cabinet.state.shape, cabinet.state.w, geometry.maxN()));
            cabinet.state.sel = Math.min(cabinet.state.sel, cabinet.state.n - 1);
        }
        createDesignCommands(() => cabinet.state, { report }).fitToShape(); if (!copy && size.preset) applyPiecePreset(cabinet, size.preset);
        checkpoint();
        applyMaxReach(cabinet.state, scene.maxReach);
        scene.wardrobes.push(cabinet);
        scene.activeWardrobe = id;
        scene.nextWardrobeId++;
        return cabinet;
    },
    removeCabinet(id = getScene().activeWardrobe) {
        const scene = getScene(), index = scene.wardrobes.findIndex(piece => piece.id === id);
        if (index < 0) return false;
        checkpoint();
        const removed = scene.wardrobes.splice(index, 1)[0]!;
        if (scene.activeWardrobe === id) {
            scene.activeWardrobe = scene.wardrobes[Math.min(index, scene.wardrobes.length - 1)]?.id ?? 0;
            const state = active().state;
            state.item = -1;
            state.divider = -1;
            state.space = null;
        }
        return removed.name;
    },
    /** Turns a piece about its centre. Given `from` (where the turn started), a piece against a wall slides
     * straight out of the walls it would cut into, the shortest way, and comes back to `from` when turned back.
     * Otherwise, or when other furniture is in the way, it turns as far as it is free to. */
    previewRotation(id: number, angle: number, from?: Pick<EditorCabinet, 'x' | 'z'>) {
        const cabinet = getScene().wardrobes.find(piece => piece.id === id);
        if (!cabinet) return false;
        const { x, z, angle: turn } = pieceOf(cabinet).turnFrom(room(), angle, from);
        Object.assign(cabinet, { x, z, angle: turn });
        return true;
    },
    previewTranslation(id: number, pose: Pick<EditorCabinet, 'x' | 'y' | 'z'>) {
        const cabinet = getScene().wardrobes.find(piece => piece.id === id);
        if (!cabinet) return false;
        const moved = pieceOf(cabinet).move(room(), { ...pose, angle: cabinet.angle }).value;
        if (!moved) return false;
        const { x, y, z } = moved;
        Object.assign(cabinet, { x, y, z });
        return true;
    },
    restorePose(id: number, pose: Partial<Pick<EditorCabinet, 'x' | 'y' | 'z' | 'angle'>>) {
        const cabinet = getScene().wardrobes.find(w => w.id === id);
        if (cabinet) {
            Object.assign(cabinet, pose);
        }
    },
    setCabinetPose(key: string, value: number, cabinet = active()) {
        if ((key !== 'x' && key !== 'y' && key !== 'z' && key !== 'angle') || !Number.isFinite(value)) return false;
        value = key === 'angle' ? ((value % 360) + 360) % 360 : Math.max(key === 'y' ? 0 : -5000, Math.min(5000, value));
        if (cabinet[key] === value) return false;
        const piece = pieceOf(cabinet), scene = room();
        const next = key === 'angle' ? piece.turnFrom(scene, value) : piece.move(scene, { ...piece.body(scene.studio), [key]: value }, { exact: true }).value;
        return !!next && commitPose(cabinet, next);
    },
    commitCabinetMove(cabinet: EditorCabinet, to: Pose) {
        const next = pieceOf(cabinet).move(room(), to).value;
        return !!next && commitPose(cabinet, next);
    },
    commitCabinetTurn(cabinet: EditorCabinet, angle: number, from?: Pick<Pose, 'x' | 'z'>) {
        return commitPose(cabinet, pieceOf(cabinet).turnFrom(room(), angle, from));
    },
    setCabinetFinish(cabinet: EditorCabinet, group: string, id: string, recordHistory = true) {
        const next = pieceOf(cabinet).withFinish(group, id);
        if (!next || JSON.stringify(next.state) === JSON.stringify(cabinet.state)) return false;
        if (recordHistory) checkpoint();
        Object.assign(cabinet.state, next.state);
        return true;
    },
    setCabinetSize(key: string, value: number, recordHistory = true, cabinet = active()) {
        const state = cabinet.state, selected = cabinet.id === getScene().activeWardrobe;
        const geometry = selected ? options.geometry : createWardrobeGeometry(() => state);
        const design = selected ? options.design : createDesignCommands(() => state, { report });
        const piece = pieceOf(cabinet), axis = key === 'w' ? 'width' : key === 'd' ? 'depth' : key === 'h' ? 'height' : null;
        const range = axis && piece.limits()[axis];
        if (!axis || !range || !Number.isFinite(value)) {
            return false;
        }
        let requested = Math.max(range[0]!, Math.min(range[1]!, Math.round(value * 10) / 10));
        if (key === 'w') {
            requested = design.limitWidth(Math.max(requested, geometry.minTotal())); // an appliance housing: no wider than its appliance
        }
        if (state[key as 'w' | 'h' | 'd'] === requested) return false;
        const fitted = piece.resize(room(), { [axis]: requested }).value;
        if (!fitted) {
            report(blockedMessage('That size', { ...cabinet, state: { ...state, [key]: requested } }));
            return false;
        }
        const pose = { x: fitted.x, y: fitted.y, z: fitted.z };
        const previous = structuredClone(state), previousPose = { x: cabinet.x, y: cabinet.y, z: cabinet.z };
        let next = state.shape && key !== 'd' ? resizeShape(state.shape, state.w, key === 'w' ? requested : state.w, state.h, key === 'h' ? requested : state.h) : state.shape;
        if (key === 'h') {
            const top = next ?? regularShape(state.w, requested);
            let blocked = ceilings.shapeBlocked({ ...cabinet, ...pose }, top);
            if (blocked && requested > state.h) {
                const original = resolveShape(state), front = growFrontShape(cabinet,
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
        design.refitAfterSize(key === 'h' ? state.h - previous.h : 0);
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
  };
}
