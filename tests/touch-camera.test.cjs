const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTouchCamera, EDGE_ZONE } = require('../src/presentation/editor/touch-camera.ts');

function fixture() {
    const calls = [], frames = [], cleanups = [];
    const view = { left: 0, top: 0, right: 375, bottom: 812, width: 375, height: 812 }, bar = { top: 735, height: 70 };
    const dom = { $: id => ({ getBoundingClientRect: () => id === '#toolbar' ? bar : view }) };
    const cameraState = { dist: 1000, panned: false };
    let anchors = 0;
    const camera = {
        panBy: (dx, dy) => calls.push(['pan', dx, dy]),
        cameraZoomPoint: p => { anchors++; return { x: p.clientX, y: p.clientY, z: 0 }; },
        cameraDistance: d => Math.max(120, Math.min(15000, d)),
        cameraZoomDistance: (d, anchor) => { calls.push(['zoom', d, anchor]); cameraState.dist = d; }
    };
    const lifetime = { frame: fn => { frames.push(fn); return frames.length; }, cancelFrame() {}, cleanup: fn => cleanups.push(fn) };
    const touch = createTouchCamera({ dom, camera, cameraState, lifetime });
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
