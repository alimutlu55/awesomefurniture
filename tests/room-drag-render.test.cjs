const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { ceilingClearance } = require('../src/domain/studio/studio-clearance.ts');
const { resolveShape, regularShape } = require('../src/domain/wardrobe/shape/wardrobe-shape.ts');
const { moveCeilingPoint } = require('../src/domain/studio/studio-ceiling.ts');
const { wallLine } = require('../src/domain/studio/studio.ts');
const { createCabinetGeometry } = require('../src/domain/geometry/cabinet-geometry.js');
const { studioObstacles } = require('../src/domain/studio/studio-obstacles.ts');

function fits(f) {
    const collision = createCabinetGeometry(() => f.model.scene.wardrobes, () => studioObstacles(f.model.scene.studio));
    for (const c of f.model.scene.wardrobes) {
        assert.equal(collision.cabinetCollides(c), false, 'wardrobes remain outside every wall and each other');
        assert.equal(ceilingClearance(f.model.scene.studio, { ...c, w: c.state.w, d: c.state.d })(resolveShape(c.state)), false,
            'the full physical top remains below the ceiling');
    }
}
const state = f => f.model.activeCabinet().state;
const roomHandles = f => f.nodes.labels.children.filter(el => el.classList.contains('room-handle'));
const wardrobeHandles = f => f.nodes.labels.children.filter(el => el.classList.contains('shape-handle') && !el.classList.contains('room-handle'));

for (const [width, pointerType] of [[1280, 'mouse'], [375, 'touch']]) {
    test(`${pointerType}: ceiling handle keeps capture across wardrobe rebuilds and follows the entire drag`, async t => {
        const f = roomRenderFixture(t, { width }), button = f.handle(1);
        button.onpointerdown(f.event(pointerType));
        button.onpointermove(f.event(pointerType, 0, 20));
        assert.equal(button.hasPointerCapture(1), true, 'rebuilding the wardrobe must not detach the captured room handle');
        await Promise.resolve();
        assert.equal(f.editor.dragging(), true);
        assert.equal(f.checkpoints.length, 0, 'a held gesture is still a preview');
        button.onpointermove(f.event(pointerType, 25, 60));
        const point = f.model.scene.studio.ceilings[0].profile[1];
        assert.equal(point.t, 201); assert.equal(point.y, 145, 'second movement reaches the requested ceiling height');
        assert.equal(f.model.activeCabinet().state.shape.template, 'room');
        assert.equal(f.handle(1), button, 'the same DOM handle survives every rebuild');
        button.onpointerup();
        assert.equal(f.editor.dragging(), false); assert.equal(f.checkpoints.length, 1);
        fits(f);
    });

    test(`${pointerType}: a ceiling can lower into the old wardrobe height, reverse, and undo/redo both together`, t => {
        const f = roomRenderFixture(t, { width }), before = f.model.snapshot(), button = f.handle(1);
        const original = structuredClone(state(f).shape);
        button.onpointerdown(f.event(pointerType));
        for (const y of [20, 40, 70]) {
            button.onpointermove(f.event(pointerType, 0, y));
            assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 205 - y);
            assert.equal(button.hasPointerCapture(1), true); fits(f);
        }
        assert.notDeepEqual(state(f).shape, original, 'ceiling reshapes the wardrobe rather than being blocked by its old shape');
        button.onpointermove(f.event(pointerType, 0, -30));
        assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 235); fits(f);
        button.onpointerup();
        const after = f.model.snapshot();
        assert.deepEqual(f.checkpoints, [before]);
        assert.equal(f.history.undo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), before);
        assert.equal(f.history.redo(), true); f.renderer.build(); assert.equal(f.model.snapshot(), after); fits(f);
    });

    test(`${pointerType}: cancellation restores room, wardrobes and fittings without a history entry`, t => {
        const f = roomRenderFixture(t, { width, wardrobes: 2 });
        state(f).secs[0] = [{ k: 'drawer', h: 22 }, { k: 'folded', h: 28 }, { k: 'short', h: 106 }];
        const before = f.model.snapshot(), items = structuredClone(state(f).secs), button = f.handle(1);
        button.onpointerdown(f.event(pointerType)); button.onpointermove(f.event(pointerType, 0, 90));
        assert.notEqual(f.model.snapshot(), before);
        assert.deepEqual(state(f).secs, items, 'live previews never destroy fittings');
        button.onpointercancel();
        assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0);
        assert.equal(f.editor.dragging(), false); assert.equal(button.hasPointerCapture(1), false); fits(f);
    });

    test(`${pointerType}: lifting the ceiling surface reshapes multiple wardrobes throughout the gesture`, t => {
        const f = roomRenderFixture(t, { width, wardrobes: 2 }), before = f.model.snapshot();
        const tops = f.model.scene.wardrobes.map(c => structuredClone(c.state.shape));
        assert.equal(f.editor.grab(f.event(pointerType), { point: { x: 0, y: 150, z: 100 },
            object: { userData: { studioCeiling: 'k1' } } }, f.nodes.c), true);
        for (const y of [10, 30, 50]) {
            f.editor.move(f.event(pointerType, 0, y));
            assert.equal(f.editor.dragging(), true); assert.equal(f.nodes.c.hasPointerCapture(1), true);
            f.model.scene.wardrobes.forEach((c, i) => {
                assert.equal(c.state.shape.template, 'room');
                assert.ok(c.state.h < Math.max(...tops[i].top.map(p => p.y)), 'each wardrobe follows the lower ceiling');
            });
            fits(f);
        }
        f.editor.end(); assert.deepEqual(f.checkpoints, [before]);
    });

    test(`${pointerType}: the ceiling depth grip can uncover and cover a wardrobe without losing capture`, t => {
        const f = roomRenderFixture(t, { width });
        f.model.activeCabinet().z = 110; f.commands.followCeilings(); f.renderer.build();
        const button = roomHandles(f).find(el => el.getAttribute('aria-label').startsWith('How far'));
        button.onpointerdown(f.event(pointerType));
        button.onpointermove(f.event(pointerType, -40, -30));
        assert.equal(f.model.scene.studio.ceilings[0].depth, 60);
        assert.equal(state(f).shape, undefined, 'outside the ceiling, the wardrobe becomes regular');
        assert.equal(button.hasPointerCapture(1), true);
        button.onpointermove(f.event(pointerType, 0, 0));
        assert.equal(f.model.scene.studio.ceilings[0].depth, 160);
        assert.equal(state(f).shape.template, 'room'); fits(f);
        button.onpointerup(); assert.equal(f.history.undoCount, 0, 'returning to the original room adds no undo step');
    });

    test(`${pointerType}: a moving wall carries its fitted wardrobes across repeated renderer rebuilds`, t => {
        const f = roomRenderFixture(t, { width, wardrobes: 2 }), before = f.model.snapshot();
        f.editor.select({ kind: 'wall', id: 'w1' }); f.renderer.build();
        const buttons = roomHandles(f), z = f.model.scene.wardrobes.map(c => c.z);
        assert.equal(f.commands.standingAgainst('w1').list.length, 2);
        assert.equal(f.editor.grab(f.event(pointerType), { point: { x: 0, y: 150, z: 0 },
            object: { userData: { studioWall: 'w1' } } }, f.nodes.c), true);
        for (const delta of [10, 20, -10]) {
            f.editor.move(f.event(pointerType, delta * .4, delta * .3));
            f.model.scene.wardrobes.forEach((c, i) => assert.equal(c.z, z[i] + delta));
            assert.ok(buttons.every(el => el.isConnected)); assert.equal(f.editor.dragging(), true); fits(f);
        }
        f.editor.end(); assert.deepEqual(f.checkpoints, [before]);
        f.history.undo(); f.renderer.build(); assert.equal(f.model.snapshot(), before);
    });

    test(`${pointerType}: a wall corner remains captured when moving it changes the ceiling over a wardrobe`, async t => {
        const f = roomRenderFixture(t, { width }); f.editor.select({ kind: 'wall', id: 'w1' }); f.renderer.build();
        const button = roomHandles(f)[0], before = structuredClone(state(f).shape);
        button.onpointerdown(f.event(pointerType));
        button.onpointermove(f.event(pointerType, -20, -20));
        assert.equal(button.hasPointerCapture(1), true); await Promise.resolve();
        assert.equal(f.editor.dragging(), true);
        button.onpointermove(f.event(pointerType, -40, -40));
        assert.notDeepEqual(state(f).shape, before, 'moving the supporting wall changes the fitted profile');
        assert.equal(f.model.scene.studio.corners[0].x, -246);
        assert.equal(f.model.scene.studio.corners[0].z, -46);
        button.onpointerup(); assert.equal(f.history.undoCount, 1); fits(f);
    });
}

test('sloped roof endpoints stay captured through automatic wardrobe rebuilds', t => {
    const f = roomRenderFixture(t, { run: 'across' }), button = f.handle(0);
    button.onpointerdown(f.event('touch'));
    for (const y of [10, 20, 30]) {
        button.onpointermove(f.event('touch', 0, y));
        assert.equal(f.model.scene.studio.ceilings[0].profile[0].y, 100 - y);
        assert.ok(Math.abs(state(f).h - (100 - y)) <= .11, 'auto fitting rounds to a tenth of a centimetre');
        assert.equal(button.hasPointerCapture(1), true); fits(f);
    }
    button.onpointerup(); assert.equal(f.history.undoCount, 1);
});

test('keyboard and numeric ceiling edits reshape wardrobes and keep the selected handle', t => {
    const f = roomRenderFixture(t), button = f.handle(1);
    button.onkeydown({ key: 'ArrowDown', shiftKey: true, preventDefault() {}, stopPropagation() {} });
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 195); assert.equal(f.handle(1), button);
    assert.equal(f.commands.editStudio(r => moveCeilingPoint(r, 'k1', 1, 200, 165)), true); f.renderer.build();
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 165); assert.equal(f.handle(1), button);
    assert.equal(f.history.undoCount, 2); fits(f);
});

test('room handle ownership preserves last-wardrobe cleanup and works in an empty room', t => {
    const f = roomRenderFixture(t); f.selectionState.shapeEditing = true; f.renderer.build();
    const old = wardrobeHandles(f), ceilingButton = f.handle(1);
    assert.ok(old.length > 0);
    f.commands.removeCabinet(); f.renderer.build();
    assert.equal(f.selectionState.shapeEditing, false);
    assert.ok(old.every(el => !el.isConnected), 'orphaned wardrobe points and split markers disappear');
    assert.equal(f.handle(1), ceilingButton); assert.ok(ceilingButton.isConnected);
    ceilingButton.onpointerdown(f.event()); ceilingButton.onpointermove(f.event('mouse', 0, 50)); ceilingButton.onpointerup();
    assert.equal(f.model.scene.studio.ceilings[0].profile[1].y, 155);
    f.editor.act('remove'); assert.equal(roomHandles(f).length, 0, 'removing the ceiling prunes its own handles');
});

test('leaving wardrobe shape mode removes only its handles; deselecting the room removes room handles', t => {
    const f = roomRenderFixture(t); f.selectionState.shapeEditing = true; f.renderer.build();
    const old = wardrobeHandles(f), ceilingButton = f.handle(1);
    f.selectionState.shapeEditing = false; f.renderer.build();
    assert.ok(old.length > 0 && old.every(el => !el.isConnected)); assert.equal(f.handle(1), ceilingButton);
    f.editor.select(null); f.renderer.build(); assert.equal(roomHandles(f).length, 0);
});

test('free front reshaping still works after roof editing while rear contact and collision limits remain enforced', t => {
    const f = roomRenderFixture(t, { run: 'across' }), roofButton = f.handle(0);
    roofButton.onpointerdown(f.event()); roofButton.onpointermove(f.event('mouse', 0, 10)); roofButton.onpointerup();
    f.editor.select(null); f.selectionState.shapeEditing = true; f.renderer.build();
    const button = wardrobeHandles(f).find(el => el.getAttribute('aria-label').startsWith('Break point 1,'));
    const rear = state(f).shape.top.map(p => p.y), start = rear[0];
    f.point({ x: -80, y: start }); button.onpointerdown(f.event());
    f.point({ x: -80, y: start + 40 }); button.onpointermove(f.event());
    assert.equal(state(f).shape.top[0].y, start + 40); assert.deepEqual(state(f).shape.back, rear);
    assert.equal(button.hasPointerCapture(1), true);
    f.point({ x: -80, y: 200 }); button.onpointermove(f.event());
    assert.ok(state(f).shape.top[0].y < 155, 'front still stops at its own ceiling');
    f.point({ x: -80, y: 125 }); button.onpointermove(f.event()); button.onpointerup(); fits(f);
    const edited = structuredClone(state(f).shape);
    f.editor.select({ kind: 'ceiling', id: 'k1' }); f.selectionState.shapeEditing = false; f.renderer.build();
    const button2 = f.handle(0); button2.onpointerdown(f.event()); button2.onpointermove(f.event('mouse', 0, -10)); button2.onpointerup();
    assert.deepEqual(state(f).shape, edited, 'a valid manual front shape survives raising the roof');
    button2.onpointerdown(f.event()); button2.onpointermove(f.event('mouse', 0, 40)); button2.onpointerup();
    assert.equal(state(f).shape.template, 'room', 'lowering into the manual shape refits it'); fits(f);
    const snapshot = f.model.snapshot();
    assert.equal(f.commands.setShape(regularShape(160, 240)), false); assert.equal(f.model.snapshot(), snapshot);
});

test('room editing still stops walls that would cut through an unrelated wardrobe', t => {
    const f = roomRenderFixture(t); f.model.activeCabinet().z = 80; f.commands.followCeilings();
    f.editor.select({ kind: 'wall', id: 'w1' }); f.renderer.build();
    assert.equal(f.commands.standingAgainst('w1').list.length, 0);
    f.editor.grab(f.event(), { point: { x: 0, y: 150, z: 0 }, object: { userData: { studioWall: 'w1' } } }, f.nodes.c);
    f.editor.move(f.event('mouse', 40, 30));
    const wall = wallLine(f.model.scene.studio, f.model.scene.studio.walls[0]);
    assert.ok(wall.a.z < 45, 'wall stops before crossing the wardrobe rear at z=50');
    assert.equal(f.model.activeCabinet().z, 80); fits(f); f.editor.end();
});
