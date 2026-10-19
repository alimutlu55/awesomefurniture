const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vector3 } = require('three');
const { createTouchCamera, EDGE_ZONE } = require('../src/presentation/editor/touch-camera.ts');

function fixture(pieces = [], chosen = false) {
    const calls = [], frames = [], cleanups = [];
    const view = { left: 0, top: 0, right: 375, bottom: 812, width: 375, height: 812 }, bar = { top: 735, height: 70 };
    const dom = { $: id => ({ getBoundingClientRect: () => id === '#toolbar' ? bar : view }) };
    const cameraState = { az: 0, el: .3, dist: 1000, tgt: new Vector3(0, 100, 0), tgtY: 100, panned: false };
    const model = { scene: { wardrobes: pieces }, activeCabinet: () => pieces[0] }, selectionState = { focusOn: chosen };
    let anchors = 0;
    const camera = {
        panBy: (dx, dy) => calls.push(['pan', dx, dy]),
        cameraZoomPoint: p => { anchors++; return { x: p.clientX, y: p.clientY, z: 0 }; },
        cameraDistance: d => Math.max(120, Math.min(15000, d)),
        availableRoom: () => ({ w: 347, h: 697 }),
        cameraFitDistance: (b) => Math.max(b.w, b.h) * 1.6,
        cameraZoomDistance: (d, anchor) => { calls.push(['zoom', d, anchor]); cameraState.dist = d; },
        zoomOutTo: d => { calls.push(['out', d]); cameraState.dist = d; }
    };
    const lifetime = { frame: fn => { frames.push(fn); return frames.length; }, cancelFrame() {}, cleanup: fn => cleanups.push(fn) };
    const touch = createTouchCamera({ dom, camera, cameraState, lifetime, model, selectionState });
    const run = now => { const fn = frames.shift(); fn?.(now); };
    return { touch, calls, cameraState, frames, run, get anchors() { return anchors; } };
}
const at = (x, y) => ({ clientX: x, clientY: y });

test('a pinch zooms about the point that was between the fingers, by the change in their spread', () => {
    const f = fixture();
    f.touch.pinch([at(200, 400), at(300, 400)], [at(180, 400), at(320, 400)]);
    const zoom = f.calls.find(c => c[0] === 'zoom');
    assert.equal(zoom[1], 1000 * 100 / 140, 'spreading the fingers 1.4 times comes 1.4 times closer');
    assert.deepEqual(zoom[2], { x: 250, y: 400, z: 0 }, 'about the point between the fingers');
    assert.equal(f.cameraState.panned, true);
    f.touch.pinch([at(180, 400), at(320, 400)], [at(170, 410), at(330, 410)]);
    assert.equal(f.anchors, 1, 'one point for the whole pinch');
    assert.deepEqual(f.calls.filter(c => c[0] === 'pan').at(-1), ['pan', 0, 10], 'both fingers moving together pan the view');
    f.touch.release();
    f.touch.pinch([at(100, 100), at(200, 100)], [at(90, 100), at(210, 100)]);
    assert.equal(f.anchors, 2, 'a new pinch zooms about what is under its own fingers');
});

test('pinching the fingers together zooms out toward the middle of the studio, not about the fingers', () => {
    const f = fixture();
    f.touch.pinch([at(150, 400), at(250, 400)], [at(175, 400), at(225, 400)]);
    assert.deepEqual(f.calls.filter(c => c[0] !== 'pan'), [['out', 2000]]);
    assert.equal(f.anchors, 0, 'no point under the fingers is held');
    f.touch.pinch([at(175, 400), at(225, 400)], [at(150, 400), at(250, 400)]);
    assert.deepEqual(f.calls.at(-1), ['zoom', 1000, { x: 200, y: 400, z: 0 }], 'spreading again zooms in about the fingers');
});

test('a pinch never zooms past the nearest or furthest view', () => {
    const f = fixture();
    f.cameraState.dist = 130;
    f.touch.pinch([at(100, 400), at(110, 400)], [at(0, 400), at(375, 400)]);
    assert.equal(f.cameraState.dist, 120);
});

test('a drag near an edge moves the view on and carries what is dragged with the finger', () => {
    const f = fixture();
    let holding = true, moved = 0;
    f.touch.followEdge(at(370, 400), () => moved++, () => holding);
    f.run(performance.now() + 16);
    const pan = f.calls.find(c => c[0] === 'pan');
    assert.ok(pan && pan[1] < 0 && pan[2] === 0, 'the view moves to show more on the right');
    assert.equal(moved, 1, 'the dragged piece is moved again from the same finger');
    f.touch.followEdge(at(187, 400), () => moved++, () => holding);
    f.run(performance.now() + 32);
    assert.equal(f.calls.filter(c => c[0] === 'pan').length, 1, 'away from the edges the view stays still');
    holding = false; f.run(performance.now() + 48);
    assert.equal(f.frames.length, 0, 'it stops once the drag ends');
});

test('the edge zone begins above the toolbar and is strongest at the edge', () => {
    const f = fixture();
    assert.deepEqual(f.touch.push(at(187, 400)), { x: 0, y: 0 });
    assert.equal(f.touch.push(at(0, 400)).x, 1);
    assert.equal(f.touch.push(at(375, 400)).x, -1);
    assert.equal(f.touch.push(at(187, 735)).y, -1, 'at the toolbar the view moves as at the screen edge');
    assert.equal(f.touch.push(at(187, 735 - EDGE_ZONE)).y, 0);
    assert.ok(f.touch.push(at(10, 400)).x < f.touch.push(at(2, 400)).x);
});

/** Where a point is seen from the camera: across, up, and how far in front (perspective-free view coordinates). */
function seen(state, p) {
    const { az, el, dist, tgt } = state, d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    const c = [tgt.x + dist * d[0], tgt.y + dist * d[1], tgt.z + dist * d[2]], v = [p.x - c[0], p.y - c[1], p.z - c[2]];
    const f = d.map(x => -x), r = [Math.cos(az), 0, -Math.sin(az)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    return { across: dot(v, r) / dot(v, f), up: dot(v, u) / dot(v, f), ahead: dot(v, f) };
}
const wardrobe = { id: 1, x: 0, y: 0, z: 30, angle: 0, state: { w: 200, h: 240, d: 60 } };

test('one finger turns the view around the furniture: after zooming into a corner it stays in view and comes to the middle', () => {
    const f = fixture([wardrobe]), middle = { x: 0, y: 120, z: 30 };
    // Zoomed into the room's corner: close, looking well to the side of the wardrobe.
    f.cameraState.tgt.set(260, 60, -40); f.cameraState.dist = 260;
    const start = seen(f.cameraState, middle);
    let previous = Math.hypot(start.across, start.up);
    for (let n = 0; n < 40; n++) {
        f.touch.orbit(.04, 0);
        const now = seen(f.cameraState, middle), off = Math.hypot(now.across, now.up);
        assert.ok(now.ahead > 0, 'the wardrobe stays in front of the camera');
        assert.ok(off <= previous + 1e-9, 'and keeps coming toward the middle of the view');
        previous = off;
    }
    assert.ok(previous < Math.hypot(start.across, start.up) * .15, 'after a turn of about 90 degrees it is nearly in the middle');
    assert.ok(f.cameraState.dist > 260, 'zoomed in closer than the wardrobe needs, the view backs off to see it whole');
});

test('the chosen piece is what the view turns around; tilting never takes the camera under the floor', () => {
    const other = { id: 2, x: 400, y: 0, z: 30, angle: 0, state: { w: 100, h: 90, d: 60 } };
    const f = fixture([wardrobe, other], true);
    f.cameraState.tgt.set(380, 40, 20);
    for (let n = 0; n < 60; n++) f.touch.orbit(.03, -.05);
    const near = seen(f.cameraState, { x: 0, y: 120, z: 30 });
    assert.ok(Math.hypot(near.across, near.up) < .1, 'the chosen wardrobe, not the nearer cabinet, ends near the middle');
    const { az, el, dist, tgt } = f.cameraState;
    assert.ok(tgt.y + dist * Math.sin(el) >= 0, 'the camera stays above the floor');
    assert.ok(el >= 0 && el <= 1.35);
});

test('without furniture one finger simply turns and tilts the view', () => {
    const f = fixture();
    f.touch.orbit(.2, .1);
    assert.equal(f.cameraState.az, .2); assert.ok(Math.abs(f.cameraState.el - .4) < 1e-12);
    assert.deepEqual(f.cameraState.tgt.toArray(), [0, 100, 0]);
});
