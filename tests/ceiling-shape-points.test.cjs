const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CEILING_SHAPES, addCeiling, splitCeilingPanel, profileAt, ceilingProblems } = require('../src/domain/studio/studio-ceiling.ts');
const { rectangleStudio } = require('../src/domain/studio/studio-templates.ts');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { resolveShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { ceilingSplitOffsets } = require('../src/presentation/viewport/ceiling-handle-layout.ts');

const pluses = f => f.nodes.labels.children.filter(el => el.getAttribute('aria-label') === 'Add a ceiling shape point here');
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
            const added = { t: Math.round((c.profile[0].t + c.profile[1].t) * 5) / 10, y: Math.round((c.profile[0].y + c.profile[1].y) * 5) / 10 };
            const plus = pluses(f)[0]; assert.ok(plus);
            plus.onpointerdown(f.event(pointerType)); plus.onpointerup();
            assert.equal(f.checkpoints.length, 1); assert.deepEqual(f.model.scene.studio.ceilings[0].profile[1], added);
            assert.equal(f.history.undo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), before);
            assert.equal(f.history.redo(), true); f.renderer.build();
            const split = f.model.snapshot(), dot = f.handle(1);
            dot.onpointerdown(f.event(pointerType));
            for (const dy of [10, 20, 30]) {
                dot.onpointermove(f.event(pointerType, 0, dy));
                await Promise.resolve();
                assert.equal(dot.hasPointerCapture(1), true); assert.equal(f.handle(1), dot);
                assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, added.y - dy);
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

test('foreshortened phone handles keep add targets clear of every draggable dot and each other', () => {
    const handles = [
        { key: 'a', kind: 'ceiling', x: 181, y: 337 }, { key: 'b', kind: 'ceiling', x: 198, y: 355 },
        { key: 'c', kind: 'ceiling', x: 213, y: 373 },
        { key: 'ab', kind: 'ceiling-split', x: 190, y: 346 }, { key: 'bc', kind: 'ceiling-split', x: 206, y: 364 },
    ];
    const offsets = ceilingSplitOffsets(handles);
    const placed = handles.map(h => ({ ...h, x: h.x + (offsets.get(h.key)?.x ?? 0), y: h.y + (offsets.get(h.key)?.y ?? 0) }));
    for (const h of placed.filter(h => h.kind === 'ceiling-split')) {
        for (const p of placed.filter(p => p.key !== h.key)) assert.ok(Math.hypot(p.x - h.x, p.y - h.y) >= 48);
    }
    assert.deepEqual(ceilingSplitOffsets([{ key: 'a', kind: 'ceiling', x: 0, y: 0 },
        { key: 'b', kind: 'ceiling', x: 200, y: 0 }, { key: 'ab', kind: 'ceiling-split', x: 100, y: 0 }]).get('ab'), { x: 0, y: 0 });
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
