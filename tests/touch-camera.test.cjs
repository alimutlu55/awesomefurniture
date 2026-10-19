const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Vector3 } = require('three');
const { createTouchCamera, EDGE_ZONE, TURN_RATE } = require('../src/presentation/editor/touch-camera.ts');

function fixture(surface = null) {
    const calls = [], frames = [], cleanups = [];
    const view = { left: 0, top: 0, right: 375, bottom: 812, width: 375, height: 812 }, bar = { top: 735, height: 70 };
    const dom = { $: id => ({ getBoundingClientRect: () => id === '#toolbar' ? bar : view }) };
    const cameraState = { az: 0, el: .3, dist: 1000, tgt: new Vector3(0, 100, 0), tgtY: 100, panned: false };
    const picking = { surfaceAlong: (from, toward, far) => surface && surface(from, toward, far) };
    let anchors = 0;
    const camera = {
        panBy: (dx, dy) => calls.push(['pan', dx, dy]),
        cameraZoomPoint: p => { anchors++; return { x: p.clientX, y: p.clientY, z: 0 }; },
        cameraDistance: d => Math.max(120, Math.min(15000, d)),
        cameraZoomDistance: (d, anchor) => { calls.push(['zoom', d, anchor]); cameraState.dist = d; },
        zoomOutTo: d => { calls.push(['out', d]); cameraState.dist = d; }
    };
    const lifetime = { frame: fn => { frames.push(fn); return frames.length; }, cancelFrame() {}, cleanup: fn => cleanups.push(fn) };
    const touch = createTouchCamera({ dom, camera, cameraState, lifetime, picking });
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

const eye = s => { const { az, el, dist, tgt } = s; return [tgt.x + dist * Math.cos(el) * Math.sin(az), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.cos(az)]; };
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} != ${b}`));

test('a swipe turns the view around the surface in the middle of it, without moving anything on screen when it starts', () => {
    // The wall the view looks at is 300 cm further than the point the view last turned around.
    const f = fixture((from, toward) => { const d = [toward.x - from.x, toward.y - from.y, toward.z - from.z], n = Math.hypot(...d);
        return { x: from.x + d[0] / n * 1300, y: from.y + d[1] / n * 1300, z: from.z + d[2] / n * 1300 }; });
    const before = eye(f.cameraState), dir = [f.cameraState.tgt.x - before[0], f.cameraState.tgt.y - before[1], f.cameraState.tgt.z - before[2]];
    f.touch.turn(1, 0);
    assert.ok(Math.abs(f.cameraState.dist - 1300) < 1e-6, 'the view turns around the wall');
    close(eye(f.cameraState), before);
    const now = [f.cameraState.tgt.x - before[0], f.cameraState.tgt.y - before[1], f.cameraState.tgt.z - before[2]], n0 = Math.hypot(...dir), n1 = Math.hypot(...now);
    close(now.map(v => v / n1), dir.map(v => v / n0));
});

test('a mostly sideways swipe only turns, a mostly upright one only tilts, and neither zooms or slides the view', () => {
    const f = fixture(), s = f.cameraState;
    for (let n = 0; n < 10; n++) f.touch.turn(10, 3);
    assert.equal(s.el, .3, 'a sideways swipe with a little wobble does not tilt');
    assert.ok(Math.abs(s.az + 90 * TURN_RATE) < 1e-9, 'it turns from the second move on, once its direction is known');
    assert.equal(s.dist, 1000); assert.deepEqual(s.tgt.toArray(), [0, 100, 0]);
    f.touch.release();
    const az = s.az;
    for (let n = 0; n < 6; n++) f.touch.turn(2, 8);
    assert.equal(s.az, az, 'an upright swipe does not turn');
    assert.ok(Math.abs(s.el - (.3 + 40 * TURN_RATE)) < 1e-9);
});

test('a diagonal swipe turns and tilts; a locked swipe that strays far the other way frees up', () => {
    const f = fixture(), s = f.cameraState;
    f.touch.turn(8, 8); f.touch.turn(8, 8);
    assert.ok(s.az < 0 && s.el > .3, 'both at once');
    f.touch.release(); const el = s.el;
    for (let n = 0; n < 4; n++) f.touch.turn(10, 0);
    for (let n = 0; n < 4; n++) f.touch.turn(0, 8);
    assert.equal(s.el, el, 'small strays stay locked');
    for (let n = 0; n < 4; n++) f.touch.turn(0, 8);
    assert.ok(s.el > el, 'past 40 px it tilts too');
});
