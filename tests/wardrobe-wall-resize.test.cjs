const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createEditorModel } = require('../src/application/projects/editor-model.ts');
const { createSceneCommands } = require('../src/application/commands/scene-commands.ts');
const { createSceneHistory } = require('../src/application/history/scene-history.ts');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { studioObstacles } = require('../src/domain/studio/studio-obstacles.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { resolveShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { resizeHeightMinimum } = require('../src/domain/wardrobe/cabinet-size-limits.ts');
const { bindCabinetDimensions } = require('../src/presentation/editor/bindings/cabinet.js');
const { syncCabinetHeightMinimum } = require('../src/presentation/editor/resize-fields.js');

function fixture({ x = 0, y = 0, z = 30, angle = 0, w = 200, h = 230, d = 60, room = true } = {}) {
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const world = (x, z) => ({ x: c * x + s * z, z: -s * x + c * z });
    const studio = room ? rectangleStudio(400, 300, 300) : undefined;
    if (studio) studio.corners.forEach(p => Object.assign(p, world(p.x, p.z)));
    const model = createEditorModel({ studio, wardrobes: [{ id: 1, name: 'Wardrobe 1', ...world(x, z), y, angle,
        state: { ...createEditorState(), w, h, d } }], activeWardrobe: 1, nextWardrobeId: 2 });
    const history = createSceneHistory(model.snapshot, model.restore), messages = [];
    const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint(model.snapshot()),
        discardCheckpoint: () => history.discardCheckpoint(), report: message => messages.push(message) });
    const cabinet = () => model.activeCabinet();
    const collision = createCabinetGeometry(() => model.scene.wardrobes, () => studioObstacles(model.scene.studio));
    const local = () => ({ x: c * cabinet().x - s * cabinet().z, z: s * cabinet().x + c * cabinet().z });
    const fits = () => {
        assert.equal(collision.cabinetCollides(cabinet()), false);
        const b = cabinet();
        assert.equal(ceilingClearance(model.scene.studio, { ...b, w: b.state.w, d: b.state.d })(resolveShape(b.state)), false);
    };
    return { model, history, commands, messages, cabinet, collision, local, fits };
}
const close = (a, b, text) => assert.ok(Math.abs(a - b) < 1e-6, `${text}: ${a} vs ${b}`);

for (const angle of [0, 17, 90, 180, 270]) {
    for (const side of ['left', 'right']) {
        test(`width grows from the free ${side === 'left' ? 'right' : 'left'} side at ${angle} degrees`, () => {
            const f = fixture({ x: side === 'left' ? -100 : 100, angle }), before = f.model.snapshot();
            const sign = side === 'left' ? -1 : 1, face = f.local().x + sign * f.cabinet().state.w / 2;
            assert.equal(f.commands.setCabinetSize('w', 260), true);
            assert.equal(f.cabinet().state.w, 260);
            close(f.local().x + sign * 130, face, 'the touching side stays put');
            close(f.local().z, 30, 'the back stays against the back wall'); f.fits();
            assert.equal(f.history.undoCount, 1);
            const after = f.model.snapshot();
            assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before);
            assert.equal(f.history.redo(), true); assert.equal(f.model.snapshot(), after); f.fits();
        });
    }
    for (const side of ['back', 'front']) {
        test(`depth grows from the free ${side === 'back' ? 'front' : 'back'} face at ${angle} degrees`, () => {
            const f = fixture({ z: side === 'back' ? 30 : 270, angle });
            const sign = side === 'back' ? -1 : 1, face = f.local().z + sign * 30;
            assert.equal(f.commands.setCabinetSize('d', 80), true);
            assert.equal(f.cabinet().state.d, 80);
            close(f.local().z + sign * 40, face, 'the wall face stays put');
            close(f.local().x, 0, 'depth resizing does not move sideways'); f.fits();
        });
    }
}

test('height grows upward while side and back walls remain touching', () => {
    const f = fixture({ x: -100 });
    const pose = { x: f.cabinet().x, y: f.cabinet().y, z: f.cabinet().z };
    assert.equal(f.commands.setCabinetSize('h', 260), true);
    assert.equal(f.cabinet().state.h, 260);
    assert.deepEqual({ x: f.cabinet().x, y: f.cabinet().y, z: f.cabinet().z }, pose); f.fits();
});

test('unobstructed resizing retains its centred footprint and floor anchor', () => {
    const f = fixture({ x: 20, z: 70, room: false });
    for (const [key, value] of [['w', 280], ['d', 80], ['h', 250]]) {
        assert.equal(f.commands.setCabinetSize(key, value), true);
        assert.deepEqual(f.local(), { x: 20, z: 70 }); assert.equal(f.cabinet().y, 0); f.fits();
    }
});

test('oversized growth between opposing walls is refused without moving or changing history', () => {
    const f = fixture({ x: -100 });
    // 400 cm fits exactly, but another wardrobe occupies the otherwise free side.
    f.model.scene.wardrobes.push({ id: 2, name: 'Other', x: 150, y: 0, z: 30, angle: 0,
        state: { ...createEditorState(), w: 100 } });
    const before = f.model.snapshot();
    assert.equal(f.commands.setCabinetSize('w', 400), false);
    assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0); f.fits();
    f.model.scene.wardrobes.pop();
    f.model.scene.studio = rectangleStudio(220, 300, 300); f.cabinet().x = 0;
    const narrow = f.model.snapshot();
    assert.equal(f.commands.setCabinetSize('w', 250), false);
    assert.equal(f.model.snapshot(), narrow); assert.equal(f.history.undoCount, 0);
});

test('width still cannot overlap a neighbour when there is no wall to anchor it', () => {
    const f = fixture({ room: false });
    f.model.scene.wardrobes.push({ id: 2, name: 'Other', x: 230, y: 0, z: 30, angle: 0, state: createEditorState() });
    const before = f.model.snapshot();
    assert.equal(f.commands.setCabinetSize('w', 300), false);
    assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0);
});

test('width previews remain at the wall and follow a sloped ceiling at the enlarged footprint', () => {
    const f = fixture({ x: -125, w: 150 });
    f.model.scene.studio.ceilings = [{ id: 'k1', wall: 'w1', run: 'along', depth: 80,
        profile: [{ t: 0, y: 205 }, { t: 156, y: 205 }, { t: 306, y: 100 }, { t: 406, y: 100 }] }];
    f.commands.followCeilings();
    for (const width of [170, 190, 220]) {
        assert.equal(f.commands.setCabinetSize('w', width, false), true);
        close(f.local().x - width / 2, -200, 'left side remains at the wall');
        assert.equal(f.cabinet().state.shape.template, 'room'); f.fits();
    }
    assert.equal(f.history.undoCount, 0);
    assert.equal(f.commands.setCabinetSize('w', 240), true); f.fits();
    assert.equal(f.history.undoCount, 1);
});

test('height grows only at the free front under an across-depth slope; rear contact is preserved', () => {
    const f = fixture({ x: -100 });
    f.model.scene.studio.ceilings = [{ id: 'k1', wall: 'w1', run: 'across', depth: 160,
        profile: [{ t: 0, y: 100 }, { t: 160, y: 260 }] }];
    f.commands.followCeilings();
    const rear = resolveShape(f.cabinet().state).top.map(p => p.y), before = f.model.snapshot();
    assert.ok(f.cabinet().state.h < 180);
    assert.equal(resizeHeightMinimum(f.cabinet().state), 60);
    assert.equal(f.commands.setCabinetSize('h', 140), true);
    assert.equal(f.cabinet().state.h, 140);
    assert.deepEqual(f.cabinet().state.shape.back, rear);
    assert.equal(f.cabinet().state.shape.template, 'custom'); f.fits();
    assert.equal(f.commands.setCabinetSize('h', 150, false), true);
    assert.deepEqual(f.cabinet().state.shape.back, rear); f.fits();
    const valid = f.model.snapshot();
    assert.equal(f.commands.setCabinetSize('h', 200, false), false);
    assert.equal(f.model.snapshot(), valid); f.fits();
    assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before);
});

test('height can grow downward from a touching flat ceiling when there is floor clearance', () => {
    const f = fixture({ y: 70 });
    const top = f.cabinet().y + f.cabinet().state.h;
    assert.equal(top, 300);
    assert.equal(f.commands.setCabinetSize('h', 260), true);
    assert.equal(f.cabinet().y, 40); assert.equal(f.cabinet().state.h + f.cabinet().y, top); f.fits();
});

test('a wardrobe on the floor cannot grow through a flat ceiling', () => {
    const f = fixture(); f.model.scene.studio.walls.forEach(wall => wall.height = 240);
    const before = f.model.snapshot();
    assert.equal(f.commands.setCabinetSize('h', 250, false), false);
    assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0); f.fits();
});

test('a short wardrobe can reduce height without jumping up to 180 cm', () => {
    const f = fixture({ h: 145.7, room: false });
    assert.equal(resizeHeightMinimum(f.cabinet().state), 60);
    assert.equal(f.commands.setCabinetSize('h', 120), true);
    assert.equal(f.cabinet().state.h, 120);
    assert.equal(resizeHeightMinimum(createEditorState()), 180);
});

function controls(f) {
    const elements = new Map(), listeners = new Map(), selectionState = { editingSize: false };
    const $ = id => {
        if (!elements.has(id)) elements.set(id, { value: '', get valueAsNumber() { return Number(this.value); },
            insertAdjacentHTML() {}, setAttribute(k, v) { this[k] = v; } });
        return elements.get(id);
    };
    const sync = () => {
        for (const key of ['w', 'h', 'd']) { $('#' + key).value = f.cabinet().state[key]; $('#' + key + '-range').value = f.cabinet().state[key]; }
    };
    bindCabinetDimensions({ dom: { $ }, selectionState, model: f.model, sceneCommands: f.commands, history: f.history,
        rendering: { build() {} }, inspector: { update: sync },
        lifetime: { listen: (el, type, fn) => { if (!listeners.has(el)) listeners.set(el, new Map()); listeners.get(el).set(type, fn); } } });
    sync();
    return { selectionState, $, emit: (id, type, value) => {
        const el = $(id); if (value !== undefined) el.value = value;
        listeners.get(el).get(type)({ target: el });
    } };
}

test('height slider bounds stay fixed during growth under a slope, then refresh at release', () => {
    const f = fixture(), number = { min: '' }, range = { min: '' };
    const dom = { $: () => number, document: { querySelector: () => range } };
    f.model.scene.studio.ceilings = [{ id: 'k1', wall: 'w1', run: 'across', depth: 160,
        profile: [{ t: 0, y: 100 }, { t: 160, y: 260 }] }];
    f.commands.followCeilings();
    syncCabinetHeightMinimum(dom, f.cabinet().state, false);
    assert.equal(range.min, '60');
    for (const value of [120, 140, 150]) {
        assert.equal(f.commands.setCabinetSize('h', value, false), true);
        syncCabinetHeightMinimum(dom, f.cabinet().state, 'h');
        assert.equal(range.min, '60', 'the thumb does not change scale under the pointer'); f.fits();
    }
    syncCabinetHeightMinimum(dom, f.cabinet().state, false);
    assert.equal(range.min, number.min);
    assert.ok(Number(range.min) > 60, 'after release the scale reflects the newly shaped wardrobe');
});

for (const width of [375, 1280]) {
    test(`${width}px: numeric width/height controls resize at a wall and undo restores size and placement`, () => {
        const f = fixture({ x: -100 }), ui = controls(f), before = f.model.snapshot();
        ui.emit('#w', 'change', 260); ui.emit('#h', 'change', 250);
        assert.equal(f.cabinet().state.w, 260); assert.equal(f.cabinet().state.h, 250);
        close(f.local().x - 130, -200, 'the wall side remains fixed');
        assert.equal(ui.$('#w').value, 260); assert.equal(f.history.undoCount, 2); f.fits();
        f.history.undo(); f.history.undo(); assert.equal(f.model.snapshot(), before);
    });

    test(`${width}px: slider growth at a wall is continuous and commits one undo step`, () => {
        const f = fixture({ x: -100 }), ui = controls(f), before = f.model.snapshot();
        for (const value of [220, 240, 280]) {
            ui.emit('#w-range', 'input', value);
            assert.equal(f.cabinet().state.w, value);
            close(f.local().x - value / 2, -200, 'each preview keeps the touching face fixed');
            assert.equal(ui.selectionState.editingSize, 'w'); assert.equal(f.history.undoCount, 0); f.fits();
        }
        ui.emit('#w-range', 'change'); ui.emit('#w-range', 'blur');
        assert.equal(f.history.undoCount, 1); assert.equal(ui.selectionState.editingSize, false);
        f.history.undo(); assert.equal(f.model.snapshot(), before);
        f.history.redo(); assert.equal(f.cabinet().state.w, 280); f.fits();
    });

    test(`${width}px: canceling a resize restores the touching side, shape and fittings`, () => {
        const f = fixture({ x: -100 }), ui = controls(f);
        f.cabinet().state.secs[0] = [{ k: 'drawer', h: 22 }];
        const before = f.model.snapshot();
        ui.emit('#w-range', 'input', 260); ui.emit('#w-range', 'input', 280);
        ui.emit('#w-range', 'pointercancel'); ui.emit('#w-range', 'blur');
        assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0);
        assert.equal(ui.selectionState.editingSize, false); assert.equal(ui.$('#w-range').value, 200); f.fits();
    });
}
