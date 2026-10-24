import type { EditorCabinet } from '../../application/projects/editor-scene';
import type { createSceneCommands, ShapeFrame } from '../../application/commands/scene-commands';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { friendlyProblem, partitionPositions, resolveShape, shapeProblems, type WardrobeShape } from '../../domain/wardrobe/shape/wardrobe-shape';
import { moveShapeHandle, profileAt, type ShapeSide } from '../../domain/wardrobe/shape/shape-handle-edit';
import { alignTo, type Align } from '../../domain/geometry/alignment';
import { lengthText, unitSuffix } from './length-unit-state';

export interface ShapeHandlePorts {
    model: { activeCabinet(): EditorCabinet; snapshot(): string; restore(raw: string): void };
    sceneCommands: Pick<ReturnType<typeof createSceneCommands>, 'setShape' | 'shapeEditProblem' | 'growFrontShape'>;
    picking: { frontPoint(e: PointerEvent, side?: ShapeSide): { x: number; y: number } | null };
    callbacks: { refresh(): void; rebuild(): void; histUI(): void; frame?(): void };
}
interface HandleDrag {
    index: number; side: ShapeSide; pointer: number; target: HTMLElement; snapshot: string;
    start: { x: number; y: number }; original: WardrobeShape; last: WardrobeShape;
    frame: ShapeFrame; angle: number; dx: number; dy: number; moved: boolean;
    lockX: Align | null; lockY: Align | null;
    guides: { orient: 'h' | 'v'; pos: number; label: string }[];
    reason: string | null;
}
export function createShapeHandleEditing({ model, sceneCommands, picking, callbacks }: ShapeHandlePorts) {
    let drag: HandleDrag | null = null, pxPerCm = 4;
    let focusedPoint: number | null = null, focusedSide: ShapeSide = 'front';
    const state = () => model.activeCabinet().state;
    const current = () => resolveShape(state());
    const editable = (shape: WardrobeShape): WardrobeShape => ({ ...shape, template: 'custom' });
    const round = (v: number) => Math.round(v * 10) / 10;
    const tolerance = () => Math.max(.4, Math.min(4, 8 / pxPerCm));
    const profileSide = () => drag?.side ?? focusedSide;
    const profile = () => profileAt(drag?.last ?? current(), profileSide());
    function frameFor(frame: ShapeFrame, angle: number, offset: number, w: number): ShapeFrame {
        const a = angle * Math.PI / 180;
        return { w, x: frame.x + offset * Math.cos(a), z: frame.z - offset * Math.sin(a) };
    }
    function heightTargets(shape: WardrobeShape, index: number): Align[] {
        return shape.top.flatMap((p, k) => k === index ? [] : [{ v: p.y, label: 'Level with break ' + (k + 1) }]);
    }
    function positionTargets(shape: WardrobeShape, index: number): Align[] {
        const w = state().w, out: Align[] = [{ v: w / 2, label: 'Centred' }];
        for (const x of partitionPositions(state())) out.push({ v: x, label: 'Aligned with partition' }, { v: x + PANEL, label: 'Aligned with partition' });
        shape.top.forEach((p, k) => { if (k !== index) out.push({ v: p.x, label: 'Aligned with break ' + (k + 1) }); });
        return out;
    }
    function beginHandleDrag(e: PointerEvent, index: number, target: HTMLElement, side: ShapeSide = 'front') {
        if (drag) return;
        const start = picking.frontPoint(e, side);
        if (!start) return;
        e.preventDefault(); e.stopPropagation();
        const cabinet = model.activeCabinet(), original = current();
        focusedSide = side;
        drag = { index, side, pointer: e.pointerId, target, snapshot: model.snapshot(), start: { x: start.x, y: start.y },
            original, last: original, frame: { w: cabinet.state.w, x: cabinet.x, z: cabinet.z }, angle: cabinet.angle,
            dx: 0, dy: 0, moved: false, lockX: null, lockY: null, guides: [], reason: null };
        try { target.setPointerCapture(e.pointerId); } catch { /* pointer already ended */ }
    }
    function moveHandleDrag(e: PointerEvent) {
        const g = drag;
        if (!g || e.pointerId !== g.pointer) return;
        const p = picking.frontPoint(e, g.side);
        if (!p) return;
        const cabinet = model.activeCabinet(), a = g.angle * Math.PI / 180;
        // The width drag shifts the group centre. Convert back to the initial frame
        // so repeated pointer events follow the finger without accumulating drift.
        const x = p.x + (cabinet.x - g.frame.x) * Math.cos(a) - (cabinet.z - g.frame.z) * Math.sin(a);
        const o = profileAt(g.original, g.side), point = o.top[g.index]!;
        const rawY = point.y + p.y - g.start.y, rawX = point.x + x - g.start.x;
        const alignY = alignTo(rawY, heightTargets(o, g.index), g.lockY, tolerance());
        const interior = g.index > 0 && g.index < o.top.length - 1;
        const alignX = interior ? alignTo(rawX, positionTargets(o, g.index), g.lockX, tolerance()) : null;
        g.lockX = alignX; g.lockY = alignY;
        g.guides = [
            ...(alignY ? [{ orient: 'h' as const, pos: alignY.v, label: alignY.label }] : []),
            ...(alignX ? [{ orient: 'v' as const, pos: alignX.v, label: alignX.label }] : []),
        ];
        const dx = (alignX?.v ?? round(rawX)) - point.x, dy = (alignY?.v ?? round(rawY)) - point.y;
        if (!g.moved && Math.abs(dx) + Math.abs(dy) < .05) return;
        const candidate = (t: number) => {
            const atX = g.dx + (dx - g.dx) * t, atY = g.dy + (dy - g.dy) * t;
            const edit = moveShapeHandle(g.original, g.side, g.index, atX, atY, g.frame.w);
            const frame = frameFor(g.frame, g.angle, edit.offset, edit.w);
            const shape = g.side === 'front' ? sceneCommands.growFrontShape(edit.shape, g.original, frame) : edit.shape;
            return { shape: editable(shape), frame, dx: atX, dy: atY };
        };
        const want = candidate(1), problem = shapeProblems(want.shape, want.frame.w)[0];
        g.reason = problem ? friendlyProblem(problem) : null;
        const valid = (t: number) => {
            const edit = candidate(t);
            return sceneCommands.shapeEditProblem(edit.shape, edit.frame) === null ? edit : null;
        };
        let next = valid(1);
        if (!next) {
            let lo = 0, hi = 1;
            for (let n = 0; n < 14; n++) {
                const mid = (lo + hi) / 2, edit = valid(mid);
                if (edit) { lo = mid; next = edit; } else hi = mid;
            }
        }
        if (!next || (JSON.stringify(next.shape) === JSON.stringify(g.last) && next.frame.w === state().w)) {
            callbacks.rebuild(); return;
        }
        if (sceneCommands.setShape(next.shape, false, false, next.frame)) {
            g.last = next.shape; g.dx = next.dx; g.dy = next.dy; g.moved = true;
            callbacks.rebuild();
        }
    }
    function endHandleDrag(cancel = false) {
        if (!drag) return;
        const g = drag; drag = null;
        if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
        const cabinet = model.activeCabinet(), final = cabinet.state.shape;
        const frame = { w: cabinet.state.w, x: cabinet.x, z: cabinet.z };
        model.restore(g.snapshot);
        if (!cancel && g.moved && final) sceneCommands.setShape(final, true, true, frame);
        callbacks.histUI(); callbacks.refresh();
        if (!cancel && g.moved && frame.w !== g.frame.w) callbacks.frame?.();
    }
    function nudge(index: number, dx: number, dy: number, side: ShapeSide = 'front') {
        const cabinet = model.activeCabinet(), shape = current();
        if (!shape.top[index]) return;
        const oldWidth = state().w;
        const edit = moveShapeHandle(shape, side, index, dx, dy, oldWidth);
        const frame = frameFor({ w: state().w, x: cabinet.x, z: cabinet.z }, cabinet.angle, edit.offset, edit.w);
        const next = side === 'front' ? sceneCommands.growFrontShape(edit.shape, shape, frame) : edit.shape;
        sceneCommands.setShape(editable(next), true, true, frame);
        focusedSide = side; callbacks.refresh();
        if (state().w !== oldWidth) callbacks.frame?.();
    }
    function setFocusedPoint(index: number | null, side: ShapeSide = 'front') {
        if (focusedPoint === index && focusedSide === side) return;
        focusedPoint = index; focusedSide = side; callbacks.rebuild();
    }
    function dragRulers() {
        const index = drag?.index ?? focusedPoint, shape = profile();
        if (index === null || !shape.top[index]) return [];
        const p = shape.top[index]!, w = state().w, x = p.x - w / 2;
        const out: { a: { x: number; y: number }; b: { x: number; y: number }; text: string; axis: 'width' | 'height' }[] = [];
        if (index > 0 && index < shape.top.length - 1 && p.x > .5 && p.x < w - .5)
            out.push({ a: { x: -w / 2, y: p.y }, b: { x, y: p.y }, text: 'x ' + lengthText(p.x) + unitSuffix(), axis: 'width' });
        else out.push({ a: { x: -w / 2, y: p.y }, b: { x: w / 2, y: p.y }, text: 'W ' + lengthText(w) + unitSuffix(), axis: 'width' });
        out.push({ a: { x, y: 0 }, b: { x, y: p.y }, text: 'y ' + lengthText(p.y) + unitSuffix(), axis: 'height' });
        return out;
    }
    return { beginHandleDrag, moveHandleDrag, endHandleDrag, nudge, setFocusedPoint, dragRulers, profileSide,
        drag: () => drag, dragging: () => drag !== null, guides: () => drag?.guides ?? [], setScale: (v: number) => { pxPerCm = Math.max(.5, v); } };
}
