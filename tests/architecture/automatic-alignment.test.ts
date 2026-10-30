import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_ALIGN_CM, resolveAlignment } from '../../src/domain/geometry/alignment';
import { axisGuide, autoGuideTranslation } from '../../src/presentation/editor/smart-guides';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { setOpeningSize } from '../../src/domain/studio/studio-edit';
import { alignRoomField } from '../../src/presentation/editor/room-field-alignment';
import { autoProfileValue, snapCorner, snapMove } from '../../src/presentation/editor/surface-shape-snap';
import { createEditorGestures } from '../../src/presentation/editor/editor-gestures.js';
import type { Studio } from '../../src/domain/studio/studio';

const frame = (x: number, y: number) => ({ x, y, z: 0 });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('one millimetre is inclusive, submillimetres align, and neither zoom nor a prior lock widens the catch', () => {
    const target = { v: 100, label: 'target' };
    for (const d of [-.1, -.05, 0, .05, .1]) {
        assert.equal(resolveAlignment(100 + d, [target], { tolerance: AUTO_ALIGN_CM, lock: target, hold: 1 }), target);
        const guide = axisGuide('a', '', 'x', 100 + d, 100, [0, 80], frame);
        near(autoGuideTranslation([guide]).x, -d);
    }
    for (const d of [-.101, -.2, .101, .2]) {
        assert.equal(resolveAlignment(100 + d, [target], { tolerance: AUTO_ALIGN_CM, lock: target, hold: 1 }), null);
        near(autoGuideTranslation([axisGuide('a', '', 'x', 100 + d, 100, [0, 80], frame)]).x, 0);
    }
});

test('automatic corrections respect the active movement axes', () => {
    const x = axisGuide('x', '', 'x', 99.9, 100, [0, 80], frame);
    const y = axisGuide('y', '', 'y', 29.95, 30, [0, 80], frame);
    const d = autoGuideTranslation([x, y], ['x']); near(d.x, .1); near(d.y, 0); near(d.z, 0);
});

test('divider gap controls automatically match another shelf at 1 mm and release outside 1 mm', () => {
    const state = { ...createEditorState(), w: 200, h: 240, n: 2, sel: 0 }, geometry = createWardrobeGeometry(() => state);
    state.secs = [[], []];
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: geometry.widths()[0]!, y: 100 },
        { i: 1, orientation: 'horizontal', x0: 0, x1: geometry.widths()[1]!, y: 120 }];
    state.dividers.forEach(d => { d.area = { x0: 0, x1: geometry.widths()[d.i]!, y0: 0, y1: geometry.ih() }; });
    const commands = createDesignCommands(() => state);
    commands.setDividerClearance(0, 'before', 119); near(state.dividers[0]!.y!, 120);
    commands.setDividerClearance(0, 'before', 118.9); near(state.dividers[0]!.y!, 119.8);
});

test('centred cabinet resizing closes a 1 mm side gap, but leaves a 1.5 mm gap and supports cancellation', () => {
    const state = { ...createEditorState(), w: 100, h: 200, n: 1 }, model = createEditorModel({ wardrobes: [
        { id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, state },
        { id: 2, name: 'B', x: 101, y: 0, z: 0, angle: 0, state: structuredClone(state) }], activeWardrobe: 1, nextWardrobeId: 3 });
    const edits = createTactileEdits({ model, checkpoint() {} }), before = model.snapshot();
    edits.beginDimension('w'); near(edits.previewDimension(1.7)!, 101.7); near(edits.previewDimension(1.8)!, 102);
    near(edits.previewDimension(1.9)!, 102); near(edits.previewDimension(1.7)!, 101.7);
    edits.finish(true); assert.equal(model.snapshot(), before);
});

test('interior fitting pointer preview aligns a 1 mm gap, leaves larger gaps and supports Alt precision', () => {
    const state = { ...createEditorState(), w: 104, h: 200, n: 1, sel: 0, item: 0, doors: 'none' as const };
    state.secs[0] = [{ k: 'drawer', h: 20, w: 30, x: 0, y: 20 }, { k: 'sdrawer', h: 20, w: 20, x: 31, y: 20 }];
    const model = createEditorModel({ wardrobes: [{ id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 });
    const geometry = createWardrobeGeometry(() => state), interactionState = { drag: { from: { i: 0, j: 0 }, offsetX: 0, offsetY: 0 } };
    const before = model.snapshot(), node = { hidden: true, innerHTML: '', classList: { toggle() {} } };
    const gestures = createEditorGestures({ model, geometry, interactionState, cameraState: {}, camera: {}, picking: { frontPoint: (e: unknown) => e },
        dom: { $: () => node }, inspector: {}, resources: { cv: { style: {} } }, rendering: { holdOverlay() {}, clearPreview() {},
            updatePreviewOutlines() {}, drawClearances() {}, dropPreviewLabels() {} } } as never);
    for (const [x, altKey, expected] of [[.9, false, 1], [.8, false, .8], [.9, true, .9]] as const) {
        gestures.previewAt({ x: -52 + 1.8 + 15 + x, y: geometry.interiorFloor() + 30, altKey } as never);
        const plan = (interactionState as unknown as { previewPlan: { valid: boolean; layouts: { x0: number }[][]; index: number } }).previewPlan;
        assert.ok(plan.valid); near(plan.layouts[0]![plan.index]!.x0, expected);
    }
    assert.equal(model.snapshot(), before, 'preview remains reversible');
});

test('room height fields snap at 1 mm, ignore targets outside 1 mm, and skip blocked alignments', () => {
    const base = createStudio('bedroom'), wall = base.walls[0]!.id;
    const room = { ...base, openings: [
        { id: 'a', kind: 'window' as const, wall, offset: 100, width: 40, sill: 50, height: 60 },
        { id: 'b', kind: 'window' as const, wall, offset: 220, width: 40, sill: 50, height: 80 }] };
    const edit = (r: Studio, v: number) => setOpeningSize(r, 'a', { height: v });
    const run = (v: number, allowed = true) => alignRoomField(room, { kind: 'opening', id: 'a' }, 'height', v,
        edit, () => allowed)!.openings.find(o => o.id === 'a')!.height;
    near(run(79.9), 80); near(run(79.8), 79.8); near(run(79.9, false), 79.9);
});

test('profile pointer and typed edits catch at 1 mm at every zoom and do not pull from farther away', () => {
    const bounds = { minX: 0, maxX: 300, minY: 0, maxY: 260 }, room = { top: 260, from: 0, to: 300 };
    const points = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }];
    for (const px of [.01, .1, 1, 10]) {
        near(snapCorner(points, 2, { x: 90, y: 259.9 }, bounds, room, px, .1).at.y, 260);
        near(snapCorner(points, 2, { x: 90, y: 259.8 }, bounds, room, px, .1).at.y, 259.8);
        near(snapMove(points, -19.9, 0, bounds, room, px, .1).dx, -20);
    }
    const edit = (v: number) => points.map(p => p.y === 80 ? { ...p, y: v } : p);
    near(autoProfileValue(259.9, edit, bounds, room), 260); near(autoProfileValue(259.8, edit, bounds, room), 259.8);
});
