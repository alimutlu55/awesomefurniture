import test from 'node:test';
import assert from 'node:assert/strict';
import { axisGuide, selectSmartGuides } from '../../src/presentation/editor/smart-guides';
import { fittingSmartGuides, boardSmartGuides } from '../../src/presentation/editor/interior-smart-guides';
import { cabinetSmartGuides, rotationSmartGuides, outlineSmartGuides } from '../../src/presentation/editor/scene-smart-guides';
import { roomSmartGuides } from '../../src/presentation/editor/room-smart-guides';
import { snapCorner, snapSlide, snapMove } from '../../src/presentation/editor/surface-shape-snap';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { addCeiling } from '../../src/domain/studio/studio-ceiling';
import { addFixture } from '../../src/domain/studio/fixtures/fixture-edit';
import { bindSizeSlider, bindSizeNumber } from '../../src/presentation/editor/size-control';

const frame = (x: number, y: number) => ({ x, y, z: 0 });
const project = (p: { x: number; y: number }) => ({ x: p.x * 10, y: p.y * 10 });
const bounds = { minX: 0, maxX: 300, minY: 0, maxY: 260 };
const room = { top: 260, from: 0, to: 300, points: [] };
const points = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }];

test('nearby guides use screen distance and retain an exact millimetre gap without writing geometry', () => {
    const guide = axisGuide('a', 'Level', 'y', 99.9, 100, [0, 80], frame), before = JSON.stringify(guide);
    const shown = selectSmartGuides([guide], project);
    assert.equal(shown.length, 1); assert.ok(Math.abs(shown[0]!.delta + .1) < 1e-8);
    assert.equal(JSON.stringify(guide), before);
    assert.equal(selectSmartGuides([guide], p => ({ x: p.x * 100, y: p.y * 100 })).length, 0, 'zoom changes the physical catch distance');
});

test('nearby guides hold briefly, release beyond the screen threshold and offer one reference per axis', () => {
    const a = axisGuide('a', 'First', 'x', 0, 1.1, [0, 80], frame);
    const b = axisGuide('b', 'Second', 'x', 0, .9, [0, 80], frame);
    assert.equal(selectSmartGuides([a, b], project)[0]!.id, 'b');
    assert.equal(selectSmartGuides([a, b], project, new Set(['a']))[0]!.id, 'a');
    assert.equal(selectSmartGuides([{ ...a, target: frame(1.4, 40) }], project, new Set(['a'])).length, 0);
    assert.equal(selectSmartGuides([a], () => ({ x: NaN, y: 0 })).length, 0);
    assert.equal(selectSmartGuides([a], () => ({ x: 0, y: 0, visible: false })).length, 0);
});

function interior() {
    const state = { ...createEditorState(), w: 200, h: 240, n: 2, sel: 0, item: 0 };
    state.secs = [[{ k: 'drawer', w: 30, h: 20, x: 10, y: 20 }], [{ k: 'sdrawer', w: 30, h: 20, x: 10, y: 50 }]];
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 90, y: 119.9 },
        { i: 1, orientation: 'horizontal', x0: 0, x1: 90, y: 120 }];
    return { state, geometry: createWardrobeGeometry(() => state) };
}

test('interior moves and all four resize edges offer frame, neighbour and matching-size references', () => {
    const { state, geometry } = interior(), before = JSON.stringify(state);
    const rect = { x0: 10, x1: 40, y0: 30, y1: 50 };
    const move = fittingSmartGuides(state, geometry, 0, 0, rect, frame);
    assert.ok(move.some(g => g.id.startsWith('other:1:') && g.group === 'y'), 'neighbouring bay heights');
    for (const edge of ['left', 'right', 'top', 'bottom']) {
        const axis = edge === 'top' || edge === 'bottom' ? 'y' : 'x';
        const guides = fittingSmartGuides(state, geometry, 0, 0, rect, frame, axis, edge);
        assert.ok(guides.length > 0); assert.ok(guides.every(g => g.group === axis));
        assert.ok(guides.some(g => /Same (width|height)/.test(g.label)), edge);
    }
    assert.equal(JSON.stringify(state), before);
});

test('board pointer and gap-slider references are available before exact alignment and are read-only', () => {
    const { state, geometry } = interior(), before = JSON.stringify(state);
    const guides = boardSmartGuides(state, geometry, 0, frame), shelf = guides.find(g => g.label === 'Level with shelf')!;
    assert.ok(shelf); assert.ok(Math.abs(shelf.delta + .1) < 1e-8);
    assert.ok(selectSmartGuides(guides, project).length > 0);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(boardSmartGuides(state, geometry, 99, frame), []);
});

test('cabinet movement, dimensions and elevation expose neighbour, contact and centring guides', () => {
    const model = createEditorModel(), c = model.activeCabinet(); c.state.w = 100; c.state.h = 200; c.state.n = 1;
    model.scene.wardrobes.push({ ...structuredClone(c), id: 2, name: 'Neighbour', x: c.x + 105, state: { ...structuredClone(c.state), h: 200.1 } });
    const before = model.snapshot();
    for (const axis of [undefined, 'w', 'h', 'd', 'y']) {
        const guides = cabinetSmartGuides(model.scene, c, axis);
        assert.ok(guides.length > 0, axis);
        if (axis === 'h') assert.ok(guides.some(g => g.label === 'Tops level' && Math.abs(g.delta + .1) < 1e-8));
        if (axis === 'd') assert.ok(guides.some(g => g.label === 'Fronts aligned'));
    }
    assert.equal(model.snapshot(), before);
});

test('rotation guides use a neighbour orientation, rather than only multiples of ninety degrees', () => {
    const model = createEditorModel(), c = model.activeCabinet(); c.angle = 17.5;
    model.scene.wardrobes.push({ ...structuredClone(c), id: 2, name: 'Reference', angle: 17 });
    const before = model.snapshot(), guides = rotationSmartGuides(model.scene, c);
    assert.ok(guides.some(g => g.label === 'Parallel with Reference' && g.delta === .5));
    c.angle = 107.5;
    assert.ok(rotationSmartGuides(model.scene, c).some(g => g.label === 'Perpendicular with Reference' && g.delta === .5));
    c.angle = 17.5; assert.equal(model.snapshot(), before);
});

test('room Size fields expose guides for walls and every existing opening on its own wall', () => {
    const studio = createStudio('bedroom'), before = JSON.stringify(studio);
    for (const field of ['height', 'length', 'thickness']) {
        assert.ok(roomSmartGuides(studio, { kind: 'wall', id: studio.walls[0]!.id }, field).length > 0);
    }
    for (const o of studio.openings) for (const field of ['width', 'height', 'left', 'right', 'sill', 'top']) {
        const guides = roomSmartGuides(studio, { kind: 'opening', id: o.id }, field);
        assert.ok(guides.length > 0);
        if (field === 'height') assert.ok(guides.every(g => g.current.y === o.sill + o.height), 'stationary sill cannot win height guides');
    }
    assert.equal(JSON.stringify(studio), before);
});

test('profile boundary snaps always provide a visible guide, including whole-shape movement', () => {
    const corner = snapCorner(points, 2, { x: 90, y: 259.9 }, bounds, room, .1, .1);
    assert.equal(corner.at.y, 260); assert.ok(corner.guides.some(g => g.a.y === 260 && g.b.y === 260));
    const edge = snapSlide(points, 2, 179.9, bounds, room, .1, .1);
    assert.equal(edge.d, 180); assert.ok(edge.guides.length > 0);
    const move = snapMove(points, -19.9, 0, bounds, room, .1, .1);
    assert.equal(move.dx, -20); assert.ok(move.guides.some(g => g.a.x === 0 && g.b.x === 0));
});

test('ceiling and fixture sizing fields share scene guide coverage, including depth', () => {
    let studio = createStudio('bedroom'); const wall = studio.walls[0]!.id;
    studio = addCeiling(studio, wall, 'box')!;
    const ceiling = studio.ceilings!.at(-1)!;
    studio = addCeiling(studio, wall, 'box')!;
    for (const field of ['outer', 'depth', 'p0']) {
        assert.ok(roomSmartGuides(studio, { kind: 'ceiling', id: ceiling.id }, field).length > 0, field);
    }
    studio = addFixture(studio, wall, 'basin', 100)!;
    const fixture = studio.fixtures!.at(-1)!;
    studio = addFixture(studio, wall, 'basin', 250)!;
    const before = JSON.stringify(studio);
    for (const field of ['width', 'height', 'depth', 'left', 'right']) {
        assert.ok(roomSmartGuides(studio, { kind: 'fixture', id: fixture.id }, field).length > 0, field);
    }
    assert.equal(JSON.stringify(studio), before);
});

test('an opening cannot align to its own changed edge', () => {
    const studio = createStudio('bedroom'), opening = studio.openings[0]!;
    const solo = { ...studio, openings: [{ ...opening, sill: 33.7, height: 121.2 }], ceilings: [] };
    const guides = roomSmartGuides(solo, { kind: 'opening', id: opening.id }, 'height');
    assert.ok(guides.length > 0);
    assert.ok(guides.every(g => Math.abs(g.delta) > .001), 'self-references must not claim alignment on every edit');
});

test('front and rear outline numeric fields share height, position and angle guides with the model handles', () => {
    const model = createEditorModel(), c = model.activeCabinet(), before = model.snapshot();
    for (const side of ['front', 'rear'] as const) for (const axis of ['x', 'y', 'angle']) {
        const guides = outlineSmartGuides(model.scene, c, 0, side, axis);
        assert.ok(guides.length > 0, side + ':' + axis);
        assert.ok(guides.every(g => g.group === axis));
    }
    assert.equal(model.snapshot(), before);
});

test('slider guide sessions clear on finish, cancellation and capture loss; numeric blur clears too', () => {
    for (const end of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
        const handlers = new Map<string, (e: Event) => void>(), attributes = new Set<string>();
        const input = { valueAsNumber: 10, toggleAttribute(name: string, on: boolean) { if (on) attributes.add(name); else attributes.delete(name); } };
        const lifetime = { listen(_target: EventTarget, key: string, fn: (e: Event) => void) { handlers.set(key, fn); } };
        bindSizeSlider({ range: input as HTMLInputElement, lifetime, model: { snapshot: () => 'initial', restore() {} },
            history: { checkpoint() {} }, preview() {}, refresh() {} });
        handlers.get('pointerdown')!({} as Event); assert.ok(attributes.has('data-smart-guide-active'));
        handlers.get(end)!({} as Event); assert.equal(attributes.size, 0, end);
        bindSizeNumber({ input: input as HTMLInputElement, lifetime, commit() {} });
        handlers.get('focus')!({} as Event); assert.ok(attributes.has('data-smart-guide-active'));
        handlers.get('blur')!({} as Event); assert.equal(attributes.size, 0);
    }
});
