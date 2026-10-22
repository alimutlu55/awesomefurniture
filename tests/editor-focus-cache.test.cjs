const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const { createScenePicking } = require('../src/presentation/editor/scene-picking.js');
const { createMeasurementInspector } = require('../src/presentation/editor/measurement-inspector.js');
const { currentLengthUnit, setLengthUnit } = require('../src/presentation/editor/length-unit-state.ts');

test('switching empty spaces in the same bay rebuilds its Add button and space rulers', t => {
    const f = roomRenderFixture(t), state = f.model.activeCabinet().state;
    state.secs = Array.from({ length: 6 }, () => []);
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 156.4, y: 90 }];
    Object.assign(f.selectionState, { focusOn: true, deep: false, room: null });
    f.renderer.build();
    const whole = f.renderState.Gr;
    f.selectionState.deep = true;
    state.space = { i: 0, x: 20, y: 50 };
    f.renderer.build();
    assert.notEqual(f.renderState.Gr, whole, 'entering an empty space leaves the whole-piece cache');
    const low = f.renderState.labs.find(l => l.el.classList.contains('add'));
    const lowerGroup = f.renderState.Gr;
    state.space = { i: 0, x: 20, y: 140 };
    f.renderer.build();
    const high = f.renderState.labs.find(l => l.el.classList.contains('add'));
    assert.notEqual(f.renderState.Gr, lowerGroup);
    assert.ok(high.p.y > low.p.y + 30, 'Add follows the newly chosen opening');
    const unchanged = f.renderState.Gr;
    f.renderer.build();
    assert.equal(f.renderState.Gr, unchanged, 'unchanged selection still reuses the cache');
});

test('picking reads new canvas bounds immediately after a sheet or keyboard layout change', () => {
    let rect = { left: 0, top: 0, width: 100, height: 100 }, ndc;
    const ray = { setFromCamera: p => { ndc = p; }, intersectObjects: () => [] };
    const picking = createScenePicking({ resources: { cv: { getBoundingClientRect: () => rect }, cam: {} }, interactionState: { ray } });
    picking.cast({ clientX: 50, clientY: 50 }, []);
    assert.deepEqual(ndc, { x: 0, y: 0 });
    rect = { left: 10, top: 10, width: 200, height: 200 };
    picking.cast({ clientX: 110, clientY: 110 }, []);
    assert.deepEqual(ndc, { x: 0, y: 0 });
});

test('transparent hit volumes do not count as the visible furniture frame', () => {
    const group = new THREE.Group(); group.userData.wardrobe = 1;
    const volume = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
    group.add(volume);
    const picking = createScenePicking({ resources: { cv: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }, cam: {} },
        interactionState: { ray: { setFromCamera() {}, intersectObjects: () => [{ object: volume }] } }, renderState: { wardrobeGroups: [group] } });
    assert.equal(picking.pieceAt({ clientX: 50, clientY: 50 }), undefined);
    volume.material.opacity = 1;
    assert.equal(picking.pieceAt({ clientX: 50, clientY: 50 }), 1);
});

test('divider slider values remain centimetres when measurement badges use millimetres', t => {
    const f = roomRenderFixture(t), state = f.model.activeCabinet().state;
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 156.4, y: 90 }]; state.divider = 0;
    const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
    const geometry = createWardrobeGeometry(() => state), Node = f.nodes.app.constructor;
    const dom = { $: selector => f.nodes[selector.slice(1)] ??= new Node(), document: { querySelector: () => null } };
    const unit = currentLengthUnit(); t.after(() => setLengthUnit(unit)); setLengthUnit('mm');
    createMeasurementInspector({ dom, model: f.model, geometry, callbacks: { divWord: () => 'shelf' } }).dividerUI(true);
    const m = geometry.dividerMeasurements(0);
    assert.equal(Number(f.nodes.dgap0.value), m.before);
    assert.equal(Number(f.nodes.dgap1.value), m.after);
    assert.equal(Number(f.nodes.dgap0.max), m.before + m.after);
});
