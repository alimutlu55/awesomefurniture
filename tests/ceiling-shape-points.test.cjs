const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CEILING_SHAPES, addCeiling, splitCeilingPanel, profileAt, ceilingProblems } = require('../src/domain/studio/studio-ceiling.ts');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { resolveShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { ceilingHandles, pointAt } = require('../src/presentation/editor/studio-ceiling-drag.ts');
const { ceilingFrame } = require('../src/domain/studio/studio-ceiling.ts');
const { createCeilingSplitCursor } = require('../src/presentation/editor/studio-ceiling-split.ts');

const pluses = f => f.nodes.labels.children.filter(el => el.getAttribute('aria-label')?.startsWith('Add a ceiling shape point here'));
function fixture(t, shape, width) {
    const f = roomRenderFixture(t, { width });
    f.model.scene.studio = addCeiling(f.model.scene.studio, 'w1', shape.id);
    f.model.scene.studio.ceilings[0].id = 'k1';
    f.commands.followCeilings(); f.renderer.build();
    return f;
}
function fits(f) {
    assert.deepEqual(ceilingProblems(f.model.scene.studio, f.model.scene.studio.ceilings[0]), []);
    for (const c of f.model.scene.wardrobes) assert.equal(ceilingClearance(f.model.scene.studio, { ...c, w: c.state.w, d: c.state.d })(resolveShape(c.state)), false);
}

for (const shape of CEILING_SHAPES) {
    test(`${shape.name}: inserting a bend preserves the ceiling surface and survives JSON persistence`, () => {
        const room = addCeiling(rectangleStudio(400, 200), 'w1', shape.id), before = room.ceilings[0];
        const next = splitCeilingPanel(room, before.id, 0), after = next.ceilings[0];
        assert.equal(after.profile.length, before.profile.length + 1);
        assert.equal(before.profile.length, shape.id === 'landing' ? 4 : 2, 'input is immutable');
        for (let t = before.profile[0].t; t <= before.profile.at(-1).t; t += .5) {
            assert.ok(Math.abs(profileAt(before.profile, t) - profileAt(after.profile, t)) <= .06);
        }
        assert.equal(after.depth, before.depth); assert.equal(after.run, before.run);
        assert.deepEqual(ceilingProblems(next, after), []);
        assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
    });
    for (const [width, pointerType] of [[1280, 'mouse'], [375, 'touch']]) {
        test(`${pointerType}: ${shape.name} gets a new movable bend, retains capture and reshapes wardrobes`, async t => {
            const f = fixture(t, shape, width), before = f.model.snapshot(), c = f.model.scene.studio.ceilings[0];
            const k = f.editor.handles().find(h => h.kind === 'ceiling-split').index;
            const added = { t: (c.profile[k].t + c.profile[k + 1].t) / 2, y: (c.profile[k].y + c.profile[k + 1].y) / 2 };
            const plus = pluses(f)[0]; assert.ok(plus);
            plus.onpointerdown(f.event(pointerType)); plus.onpointerup();
            assert.equal(f.checkpoints.length, 1); assert.deepEqual(f.model.scene.studio.ceilings[0].profile[k + 1], added);
            assert.equal(f.history.undo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), before);
            assert.equal(f.history.redo(), true); f.renderer.build();
            const split = f.model.snapshot(), dot = f.handle(k + 1);
            dot.onpointerdown(f.event(pointerType));
            for (const dy of [10, 20, 30]) {
                dot.onpointermove(f.event(pointerType, 0, dy));
                await Promise.resolve();
                assert.equal(dot.hasPointerCapture(1), true); assert.equal(f.handle(k + 1), dot);
                assert.equal(f.model.scene.studio.ceilings[0].profile[k + 1].y, added.y - dy);
                assert.equal(f.checkpoints.length, 1, 'previews do not create extra history'); fits(f);
            }
            dot.onpointerup(); const after = f.model.snapshot();
            assert.equal(f.checkpoints.length, 2);
            assert.equal(f.history.undo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), split);
            assert.equal(f.history.redo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), after); fits(f);
        });
    }
}

test('steps and panels shorter than 10 cm have no split handle or insertable point', t => {
    const f = roomRenderFixture(t);
    f.model.scene.studio.ceilings[0].profile = [{ t: 6, y: 205 }, { t: 6, y: 100 }, { t: 14, y: 100 }, { t: 406, y: 100 }];
    f.commands.followCeilings(); f.renderer.build();
    assert.equal(pluses(f).length, 1);
    assert.equal(splitCeilingPanel(f.model.scene.studio, 'k1', 0), null);
    assert.equal(splitCeilingPanel(f.model.scene.studio, 'k1', 1), null);
    assert.equal(splitCeilingPanel(f.model.scene.studio, 'k1', 99), null);
});

test('keyboard activation adds one point; canceling its touch drag restores the room and wardrobes', t => {
    const f = fixture(t, CEILING_SHAPES.find(s => s.id === 'slope'), 375), plus = pluses(f)[0];
    plus.onclick({ detail: 0 });
    assert.equal(f.checkpoints.length, 1);
    const before = f.model.snapshot(), dot = f.handle(1);
    dot.onpointerdown(f.event('touch')); dot.onpointermove(f.event('touch', 0, 40));
    assert.notEqual(f.model.snapshot(), before);
    dot.onpointercancel(); assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 1);
    plus.onclick({ detail: 1 }); assert.equal(f.checkpoints.length, 1, 'native pointer click does not duplicate the pointer-up edit');
});

for (const shape of CEILING_SHAPES) test(`${shape.name}: one plus handle stays at the exact split midpoint after repeated divisions`, () => {
    let room = addCeiling(rectangleStudio(400, 200), 'w1', shape.id);
    for (let n = 0; n < 12; n++) {
        const c = room.ceilings[0], handles = ceilingHandles(room, c).filter(h => h.kind === 'ceiling-split');
        assert.equal(handles.length, 1);
        const largest = c.profile.slice(0, -1).map((p, k) => ({ k, span: c.profile[k + 1].t - p.t }))
            .filter(p => p.span >= 10).sort((a, b) => b.span - a.span || a.k - b.k).slice(0, 1).map(p => p.k).sort((a, b) => a - b);
        assert.deepEqual(handles.map(h => h.index), largest);
        for (const h of handles) {
            const a = pointAt(ceilingFrame(room, c), c, h.index), b = pointAt(ceilingFrame(room, c), c, h.index + 1);
            for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(h[axis] - (a[axis] + b[axis]) / 2) < 1e-8);
        }
        room = splitCeilingPanel(room, c.id, handles[0].index);
    }
});

test('overlapping phone point touch areas select the closest actual dot and capture that dot', t => {
    const f = fixture(t, CEILING_SHAPES.find(s => s.id === 'slope'), 375);
    pluses(f)[0].onclick({ detail: 0 });
    const middle = f.handle(1), last = f.handle(2), original = f.model.scene.studio.ceilings[0].profile[1].y;
    middle.getBoundingClientRect = () => ({ left: 185, top: 342, width: 26, height: 26 });
    last.getBoundingClientRect = () => ({ left: 168, top: 324, width: 26, height: 26 });
    last.onpointerdown(f.event('touch', 198, 355));
    assert.equal(middle.hasPointerCapture(1), true); assert.equal(last.hasPointerCapture(1), false);
    middle.onpointermove(f.event('touch', 198, 375));
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, original - 20);
    assert.equal(f.model.scene.studio.ceilings[0].profile[2].y, 260);
    middle.onpointerup(); fits(f);
});

test('a depth grip touch area cannot cover the centre of a ceiling point', t => {
    const f = fixture(t, CEILING_SHAPES.find(s => s.id === 'box'), 375);
    pluses(f)[0].onclick({ detail: 0 });
    const middle = f.handle(1), grip = f.nodes.labels.children.find(el => el.getAttribute('aria-label')?.startsWith('How far it reaches'));
    middle.getBoundingClientRect = () => ({ left: 185, top: 342, width: 26, height: 26 });
    grip.getBoundingClientRect = () => ({ left: 169, top: 339, width: 32, height: 32 });
    grip.onpointerdown(f.event('touch', 198, 355));
    assert.equal(middle.hasPointerCapture(1), true); assert.equal(grip.hasPointerCapture(1), false);
    middle.onpointermove(f.event('touch', 198, 375)); middle.onpointerup();
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 200); fits(f);
});

test('a plus touch area cannot cover a dot, and tapping the actual plus centre still divides its segment', t => {
    const f = fixture(t, CEILING_SHAPES.find(s => s.id === 'slope'), 375);
    pluses(f)[0].onclick({ detail: 0 });
    const middle = f.handle(1), plus = pluses(f)[0];
    const original = f.model.scene.studio.ceilings[0].profile[1].y;
    middle.getBoundingClientRect = () => ({ left: 185, top: 342, width: 26, height: 26 });
    plus.getBoundingClientRect = () => ({ left: 175, top: 330, width: 30, height: 30 });
    plus.onpointerdown(f.event('touch', 198, 355));
    assert.equal(middle.hasPointerCapture(1), true);
    middle.onpointermove(f.event('touch', 198, 375)); middle.onpointerup();
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, original - 20);
    const currentPlus = pluses(f)[0];
    currentPlus.getBoundingClientRect = () => ({ left: 175, top: 330, width: 30, height: 30 });
    currentPlus.onpointerdown(f.event('touch', 190, 345)); currentPlus.onpointerup();
    assert.equal(f.model.scene.studio.ceilings[0].profile.length, 4); assert.equal(pluses(f).length, 1); fits(f);
});

for (const [width, pointerType] of [[1280, 'mouse'], [375, 'touch']]) for (const shape of CEILING_SHAPES) {
    test(`${pointerType}: the single ${shape.name} plus moves across panels without editing, then divides at its chosen position`, t => {
        const f = fixture(t, shape, width), before = f.model.snapshot(), c = f.model.scene.studio.ceilings[0];
        const original = f.editor.handles().find(h => h.kind === 'ceiling-split'), plus = pluses(f)[0];
        const k = 0, a = pointAt(ceilingFrame(f.model.scene.studio, c), c, k), b = pointAt(ceilingFrame(f.model.scene.studio, c), c, k + 1);
        const target = { x: a.x + (b.x - a.x) * .3, y: a.y + (b.y - a.y) * .3, z: a.z + (b.z - a.z) * .3 };
        const screen = p => ({ x: p.x + p.z * .4, y: -p.y + p.z * .3 });
        const start = screen(original), end = screen(target);
        plus.onpointerdown(f.event(pointerType));
        plus.onpointermove(f.event(pointerType, end.x - start.x, end.y - start.y));
        assert.equal(plus.hasPointerCapture(1), true); assert.equal(pluses(f)[0], plus);
        assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
        plus.onpointerup();
        const chosen = f.editor.handles().find(h => h.kind === 'ceiling-split');
        assert.equal(chosen.index, k); assert.ok(Math.abs(chosen.position - (c.profile[k].t + (c.profile[k + 1].t - c.profile[k].t) * .3)) < .11);
        pluses(f)[0].onclick({ detail: 0 });
        const inserted = f.model.scene.studio.ceilings[0].profile[k + 1];
        assert.equal(inserted.t, chosen.position); assert.ok(Math.abs(inserted.y - chosen.y) <= .051);
        assert.equal(f.checkpoints.length, 1); assert.equal(pluses(f).length, 1); fits(f);
        assert.equal(f.history.undo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), before);
    });
}

test('canceling a movable plus restores its position, and keyboard movement has no undo entry', t => {
    const f = fixture(t, CEILING_SHAPES.find(s => s.id === 'slope'), 375), before = f.model.snapshot();
    const h = f.editor.handles().find(h => h.kind === 'ceiling-split');
    f.editor.nudge(h, 'ArrowRight', true);
    const positioned = f.editor.handles().find(h => h.kind === 'ceiling-split');
    assert.ok(Math.abs(Math.hypot(positioned.x - h.x, positioned.y - h.y, positioned.z - h.z) - 10) < 1e-8);
    const plus = pluses(f)[0]; plus.onpointerdown(f.event('touch')); plus.onpointermove(f.event('touch', 15, 30));
    plus.onpointercancel();
    assert.equal(f.editor.handles().find(h => h.kind === 'ceiling-split').position, positioned.position);
    assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
});

test('a sloped ceiling cursor follows the chosen physical position in perspective', () => {
    const room = addCeiling(rectangleStudio(400, 200), 'w1', 'slope'), c = room.ceilings[0];
    const screen = p => ({ x: p.x * 600 / (p.z + 500), y: -p.y * 600 / (p.z + 500) });
    const cursor = createCeilingSplitCursor(screen), h = ceilingHandles(room, c).find(h => h.kind === 'ceiling-split');
    const a = pointAt(ceilingFrame(room, c), c, 0), b = pointAt(ceilingFrame(room, c), c, 1);
    const target = screen({ x: a.x + (b.x - a.x) * .25, y: a.y + (b.y - a.y) * .25, z: a.z + (b.z - a.z) * .25 });
    cursor.begin(); cursor.move(room, h, target.x - screen(h).x, target.y - screen(h).y);
    assert.ok(Math.abs(cursor.position(c.id) - c.profile[1].t * .25) < .11);
    assert.equal(splitCeilingPanel(room, c.id, 0, -1), null);
    assert.equal(splitCeilingPanel(room, c.id, 0, NaN), null);
});
