const { test } = require('node:test'), assert = require('node:assert/strict');
const THREE = require('three');
const { rulerScreenPlacement: place } = require('../src/presentation/viewport/ruler-layout.js');
const { createLabelDimMeasurer, createCvRectCache } = require('../src/presentation/viewport/cabinet-build-cache.js');
const { roomRenderFixture } = require('./helpers/room-render-fixture.cjs');
const bounds = { left: 0, right: 800, bottom: 600 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('ruler spacing is fixed in pixels and perpendicular to the projected edge at every zoom and angle', () => {
 for (const axis of ['width', 'height', 'depth', 'under', 'height-left']) for (const k of [.1, 1, 3]) for (const angle of [0, .4, 1.2, 2.8]) {
  const a = { x: 350, y: 250 }, b = { x: 350 + Math.cos(angle) * k * 80, y: 250 + Math.sin(angle) * k * 80 };
  const q = place(a, b, axis, 60, 18, bounds);
  close(Math.hypot(q.a.x - a.x, q.a.y - a.y), 8);
  close((q.a.x - a.x) * (b.x - a.x) + (q.a.y - a.y) * (b.y - a.y), 0);
  close(q.b.x - q.a.x, b.x - a.x); close(q.b.y - q.a.y, b.y - a.y);
 }
});
test('viewport clamping moves only the value, preserving both geometric endpoints', () => {
 const a = { x: 780, y: 200 }, b = { x: 780, y: 100 };
 const q = place(a, b, 'height', 60, 18, bounds);
 assert.equal(q.x, 770); assert.equal(q.a.x, 788); assert.equal(q.b.x, 788);
 assert.equal(q.a.y, a.y); assert.equal(q.b.y, b.y);
});
test('height value has no placement jump when its projected edge crosses 80 pixels', () => {
 const a = { x: 300, y: 100 }, small = place(a, { x: 300, y: 179.99 }, 'height', 60, 18, bounds);
 const large = place(a, { x: 300, y: 180.01 }, 'height', 60, 18, bounds);
 close(large.y - small.y, .01); close(large.x, small.x);
});
test('label measurements follow CSS and inline editing changes without text changes', () => {
 const measure = createLabelDimMeasurer(), l = { el: { offsetWidth: 60, offsetHeight: 18, textContent: 'W 200' } };
 assert.deepEqual(measure(l), { w: 60, h: 18 });
 l.el.offsetWidth = 90; l.el.offsetHeight = 28;
 assert.deepEqual(measure(l), { w: 90, h: 28 });
});
test('label bounds follow sheet layout changes immediately', () => {
 let r = { width: 375, height: 812 }; const get = createCvRectCache({ getBoundingClientRect: () => r });
 assert.equal(get().height, 812); r = { width: 375, height: 420 }; assert.equal(get().height, 420);
});
test('whole furniture rulers start at the actual corners and cached strokes reattach after a rebuild', t => {
 const f = roomRenderFixture(t, { wardrobes: 2 }), s = f.model.activeCabinet().state;
 Object.assign(f.selectionState, { focusOn: true, showDimensions: true, deep: false, room: null });
 f.renderer.build();
 const width = f.renderState.labs.find(l => l.el.classList.contains('scrub-w'));
 assert.ok(width?.ruler);
 assert.deepEqual(width.ruler.a.toArray(), [-s.w / 2, 0, s.d / 2]);
 assert.deepEqual(width.ruler.b.toArray(), [s.w / 2, 0, s.d / 2]);
 const stroke = width.rulerNode; assert.ok(stroke.isConnected);
 // Changing the other piece triggers a scene rebuild while this piece reuses its cache.
 f.model.scene.wardrobes[1].state.w += 10; f.renderer.build();
 const reused = f.renderState.labs.find(l => l.el.classList.contains('scrub-w'));
 assert.equal(reused.rulerNode, stroke); assert.ok(stroke.isConnected);
});
test('rulers behind the camera are hidden rather than mirrored and pinned to the screen', t => {
 const f = roomRenderFixture(t);
 Object.assign(f.selectionState, { focusOn: true, showDimensions: true, deep: false, room: null }); f.renderer.build();
 // Put the owner behind a camera looking along -Z, with freshly updated matrices.
 const l = f.renderState.labs.find(l => l.ruler), cam = new THREE.PerspectiveCamera(35, 1, 1, 10000);
 cam.position.set(0, 100, -1000); cam.lookAt(0, 100, -2000); cam.updateMatrixWorld();
 const { createDimensionRenderer } = require('../src/presentation/viewport/dimension-renderer.js');
 const d = createDimensionRenderer({ dom: { document: {}, $: () => f.nodes.labels }, renderState: f.renderState, resources: { cam } });
 assert.equal(d.drawScreenRuler(l, { width: 800, height: 600 }, 60, 18, bounds).visible, false);
 d.finishScreenRuler(l); assert.equal(l.rulerNode.style.display, 'none');
});

test('overlap offsets reset every frame and the leader follows the final label without moving corners', t => {
 const f = roomRenderFixture(t);
 f.nodes.c.getBoundingClientRect = () => ({ left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 });
 f.nodes.toolbar.getBoundingClientRect = () => ({ top: 720, height: 0 });
 Object.assign(f.selectionState, { focusOn: true, showDimensions: true, deep: false, room: null }); f.renderer.build();
 const l = f.renderState.labs.find(l => l.el.classList.contains('scrub-w')), el = l.el;
 const q = l.rulerLayout;
 const control = { style: {}, offsetParent: {}, getBoundingClientRect: () => ({ left: q.x - 12, right: q.x + 12, top: q.y - 12, bottom: q.y + 12 }) };
 el.offsetParent = {}; el.hasAttribute = k => el.getAttribute(k) !== null;
 f.nodes.labels.querySelectorAll = selector => selector.includes('dim') ? [el] : [];
 f.nodes.labels.getRootNode = () => ({ querySelectorAll: () => [control] });
 const transforms = [], paths = [];
 for (let i = 0; i < 120; i++) {
  f.renderer.positionLabels(); transforms.push(el.style.transform); paths.push(l.rulerNode.firstChild.getAttribute('d'));
 }
 assert.equal(new Set(transforms).size, 1, 'resting frames cannot accumulate overlap translations');
 assert.equal(new Set(paths).size, 1, 'ruler remains stable with the value');
 const numbers = paths[0].match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g).map(Number);
 close(numbers[0], q.sourceA.x); close(numbers[1], q.sourceA.y);
 close(numbers[4], q.sourceB.x); close(numbers[5], q.sourceB.y);
 assert.equal((transforms[0].match(/translate\(/g) || []).length, 3, 'one overlap displacement is applied');
 el.classList.add('held');
 const { deconflictLabels } = require('../src/presentation/viewport/label-deconflict.ts');
 assert.equal(deconflictLabels(f.nodes.labels, f.nodes.c.getBoundingClientRect()).has(el), false,
  'measurements held hidden during a drag cannot displace its live figures');
});

test('cleared assistant figures remain hidden and pooled figures rejoin rebuilt label layers', t => {
 const f = roomRenderFixture(t);
 const { createAssistOverlay } = require('../src/presentation/viewport/assist-overlay.ts');
 const overlay = createAssistOverlay({ document: { createElement: tag => new f.nodes.labels.constructor(tag) }, labels: () => f.nodes.labels,
  scene: new THREE.Scene(), renderState: f.renderState });
 t.after(() => overlay.dispose());
 const gap = { side: 'left', distance: 30, from: { x: 0, y: 100, z: 0 }, to: { x: 30, y: 100, z: 0 } };
 overlay.draw([gap]); const l = f.renderState.labs.find(l => l.el.classList.contains('assist-gap'));
 assert.equal(l.visible, true); overlay.clear(); f.renderer.positionLabels(); assert.equal(l.el.style.display, 'none');
 l.el.remove(); f.renderState.labs = f.renderState.labs.filter(q => q !== l);
 overlay.draw([gap]); assert.ok(f.renderState.labs.includes(l)); assert.ok(l.el.isConnected); assert.equal(l.visible, true);
});

test('badge values use precise geometry in every display unit, including both slope ends', t => {
 const { decorateDimensionScrubber } = require('../src/presentation/viewport/dimension-scrubber-label.ts');
 const { currentLengthUnit, setLengthUnit } = require('../src/presentation/editor/length-unit-state.ts');
 const { measureNumber, unitSuffix } = require('../src/presentation/editor/editor-format.js');
 const unit = currentLengthUnit(); t.after(() => setLengthUnit(unit));
 const f = roomRenderFixture(t), design = { ...f.model.activeCabinet().state, w: 160.37, h: 230.19, d: 57.63,
  shape: { template: 'custom', top: [{ x: 0, y: 230.19 }, { x: 160.37, y: 170.83 }] } };
 for (const unit of ['cm', 'mm', 'in']) for (const [axis, value] of [['w', 160.37], ['d', 57.63], ['h-left', 230.19], ['h-right', 170.83]]) {
  setLengthUnit(unit);
  const el = new f.nodes.labels.constructor(); el.className = 'lbl dim dimension-scrubber scrub-' + axis;
  el.textContent = axis[0].toUpperCase() + ' ' + measureNumber(value) + unitSuffix();
  const text = el.textContent; decorateDimensionScrubber(el, design);
  assert.equal(Number(el.getAttribute('aria-valuenow')), value);
  assert.equal(el.textContent, text, 'model precision is retained independently of displayed rounding');
 }
});

test('drag preview sizes and positive gaps share anchored rulers and disappear when the drag ends', t => {
 const f = roomRenderFixture(t), s = f.model.activeCabinet().state;
 s.secs = [[{ k: 'shelf', h: 35, w: 90, x: 0, y: 20 }]]; f.renderer.build();
 const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');
 const { fittingDepth } = require('../src/domain/wardrobe/carcass.ts');
 const geometry = createWardrobeGeometry(() => s), layouts = s.secs.map((_, i) => geometry.computeLayout(i));
 const keep = new Set(); f.renderer.drawClearances({ to: 0, index: 0, layouts }, s.secs[0][0], keep);
 const preview = Object.values(f.renderState.prevLab);
 assert.ok(preview.length >= 3);
 const front = fittingDepth(s.d).z1 - s.d / 2;
 for (const key of ['width', 'height']) {
  const l = f.renderState.prevLab[key].entry;
  close(l.ruler.a.z, front); close(l.ruler.b.z, front);
 }
 f.renderer.positionLabels();
 const nodes = preview.map(p => p.entry.rulerNode).filter(Boolean);
 assert.ok(nodes.length >= 3);
 f.renderer.clearPreview();
 assert.ok(nodes.every(node => !node.isConnected));
 assert.ok(preview.every(p => !f.renderState.labs.includes(p.entry)));
});
