const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
const { createDesignCommands } = require('../src/application/commands/design-commands.ts');

function fixture(t, width, wardrobes = 1) {
    const f = roomRenderFixture(t, { width, wardrobes });
    const state = () => f.model.activeCabinet().state;
    f.inspector.inside = () => f.selectionState.deep || state().item >= 0;
    f.inspector.editableItemClearance = () => {};
    f.inspector.editableDividerClearance = () => {};
    const opened = [];
    f.inspector.openPillMenu = () => opened.push({ wardrobe: f.model.scene.activeWardrobe, section: state().sel });
    f.selectionState.room = null;
    f.selectionState.focusOn = true;
    const buttons = () => f.nodes.labels.children.filter(el => el.classList.contains('add'));
    const build = () => { f.renderer.build(); return buttons(); };
    return { ...f, state, opened, buttons, build, geometry: createWardrobeGeometry(state) };
}

for (const width of [375, 1280]) {
    test(`${width}px: the selected wardrobe has Add item without entering a section`, t => {
        const f = fixture(t, width), before = f.model.snapshot();
        assert.equal(f.selectionState.deep, false); assert.equal(f.selectionState.pillOn, false);
        const [button] = f.build();
        assert.equal(f.buttons().length, 1);
        assert.equal(button.getAttribute('aria-label'), 'Add item to section 1');
        assert.equal(button.style.display, 'block');
        assert.equal(f.model.snapshot(), before, 'rendering the control leaves the design untouched');
        button.onpointerdown(); button.onclick({ isTrusted: true, detail: 1, stopPropagation() {} });
        assert.deepEqual(f.opened, [{ wardrobe: 1, section: 0 }]);
        assert.ok(f.geometry.sectionSpaceMeasurements(0).h >= 15, 'opening Add targets usable space below the roof sliver');
        const current = JSON.parse(f.model.snapshot()), original = JSON.parse(before);
        current.wardrobes[0].state.space = original.wardrobes[0].state.space;
        assert.deepEqual(current, original, 'opening Add item changes only its target space');
    });

    test(`${width}px: Add item returns after leaving a section or resizing a low wardrobe`, t => {
        const f = fixture(t, width);
        f.model.scene.studio.ceilings[0].profile = [{ t: 0, y: 145.7 }, { t: 400, y: 145.7 }];
        f.commands.followCeilings();
        assert.equal(f.state().h, 145.7);
        f.selectionState.deep = f.selectionState.pillOn = true;
        assert.equal(f.build().length, 1);
        f.selectionState.deep = f.selectionState.pillOn = false;
        f.state().d = 55;
        assert.equal(f.build().length, 1, 'overall wardrobe selection keeps the existing Add item button');
        assert.equal(f.nodes.labels.dataset.assist, undefined);
        f.selectionState.pillOn = false; f.selectionState.deep = true;
        assert.equal(f.build().length, 1, 'an old pill flag cannot hide the action for an empty selection');
    });

    test(`${width}px: Add item targets only the selected wardrobe and section`, t => {
        const f = fixture(t, width, 2);
        const commands = createDesignCommands(f.state);
        commands.changeSections(1); f.state().sel = 1;
        const [button] = f.build();
        assert.equal(f.buttons().length, 1);
        assert.equal(button.getAttribute('aria-label'), 'Add item to section 2');
        button.onclick({ detail: 0, stopPropagation() {} });
        assert.deepEqual(f.opened, [{ wardrobe: 1, section: 1 }]);
        commands.addMod('drawer');
        assert.equal(f.state().secs[0].length, 0);
        assert.equal(f.state().secs[1].length, 1);
        assert.equal(f.geometry.sectionLayoutValid(1), true, 'the added fitting clears the slope');
        assert.equal(f.model.scene.wardrobes[1].state.secs[0].length, 0);
        f.model.select(2);
        assert.equal(f.build().length, 1);
        assert.equal(f.buttons()[0].getAttribute('aria-label'), 'Add item to section 1');
    });

    test(`${width}px: deselecting or removing wardrobes leaves no Add item control`, t => {
        const f = fixture(t, width);
        assert.equal(f.build().length, 1);
        f.selectionState.focusOn = false;
        assert.equal(f.build().length, 0);
        f.selectionState.room = { kind: 'ceiling', id: 'k1' };
        assert.equal(f.build().length, 0);
        f.model.scene.wardrobes = [];
        f.selectionState.focusOn = true;
        assert.equal(f.build().length, 0);
    });

    test(`${width}px: item editing, divider editing and item movement suppress Add item`, t => {
        const f = fixture(t, width);
        f.selectionState.deep = f.selectionState.pillOn = true;
        const commands = createDesignCommands(f.state);
        commands.addMod('drawer'); f.state().secs[0][0].h = 22; f.state().item = 0;
        assert.equal(f.build().length, 0);
        f.state().item = -1;
        assert.equal(f.build().length, 1);
        f.buttons()[0].onclick({ detail: 0, stopPropagation() {} });
        commands.addMod('shelf');
        assert.equal(f.state().dividers.length, 1);
        f.state().divider = 0;
        assert.equal(f.build().length, 0);
        f.state().divider = -1;
        f.interactionState.moveMode = 'move';
        assert.equal(f.build().length, 0);
        f.interactionState.moveMode = false;
        assert.equal(f.build().length, 1);
    });
}

test('375px: a shape session hides Add item and closing it restores the existing control', t => {
    const f = fixture(t, 375);
    f.selectionState.shapeEditing = true;
    assert.equal(f.build().length, 0);
    f.selectionState.shapeEditing = false;
    assert.equal(f.build().length, 1);
});

test('375px: a newly rendered Add item cannot consume the tap that selected the wardrobe', t => {
    const f = fixture(t, 375), [button] = f.build();
    const click = detail => ({ isTrusted: true, detail, stopPropagation() {} });
    button.onclick(click(1));
    assert.equal(f.opened.length, 0);
    button.onpointerdown(); button.onclick(click(1));
    assert.equal(f.opened.length, 1);
    button.onclick(click(1));
    assert.equal(f.opened.length, 1);
    button.onclick(click(0));
    assert.equal(f.opened.length, 2, 'keyboard activation still works');
});

test('a filled section with less than 15 cm free still omits Add item', t => {
    const f = fixture(t, 375);
    f.model.scene.studio = null; f.state().shape = undefined;
    const space = f.geometry.sectionSpaceMeasurements(0);
    f.state().secs[0] = [{ k: 'drawer', h: space.h - 10, x: 0, y: 0, w: space.w }];
    assert.ok(f.geometry.sectionSpaceMeasurements(0).h < 15);
    assert.equal(f.build().length, 0);
});

test('an explicitly selected tiny space is not silently replaced with another space', t => {
    const f = fixture(t, 375), space = f.geometry.sectionSpaceMeasurements(0);
    assert.ok(space.h < 15);
    const c = f.geometry.spaceCentre(0, space);
    f.state().space = { i: 0, x: c.x, y: c.y };
    assert.equal(f.build().length, 0);
});

for (const width of [375, 1280]) {
    test(`${width}px: selecting a frame panel still offers Add item in the usable space`, t => {
        const f = fixture(t, width);
        for (const point of [{ i: 0, x: -1, y: 100 }, { i: 0, x: 50, y: f.state().h }]) {
            f.state().space = point;
            const [button] = f.build();
            assert.equal(f.buttons().length, 1);
            button.onpointerdown(); button.onclick({ isTrusted: true, detail: 1, stopPropagation() {} });
            assert.ok(f.geometry.sectionSpaceMeasurements(0).h >= 15);
        }
    });

    test(`${width}px: a free-standing wardrobe keeps Add item through rebuilds`, t => {
        const f = fixture(t, width);
        f.model.scene.studio = null; f.state().shape = undefined;
        const before = f.model.snapshot();
        assert.equal(f.build().length, 1);
        const commands = createDesignCommands(f.state, { checkpoint: () => f.history.checkpoint(f.model.snapshot()) });
        commands.addMod('drawer'); f.build();
        assert.equal(f.state().secs[0].length, 1);
        assert.equal(f.geometry.sectionLayoutValid(0), true);
        assert.equal(f.history.undo(), true);
        assert.equal(f.model.snapshot(), before);
        assert.equal(f.build().length, 1);
    });
}
