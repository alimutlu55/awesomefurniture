const { test } = require('node:test');
const assert = require('node:assert/strict');
const { zoomOutTarget } = require('../src/presentation/viewport/zoom-out.ts');

const corner = { x: 300, y: 40, z: -200 }, overview = { x: 0, y: 130, z: 50, dist: 2000 };
const near = (a, b) => ['x', 'y', 'z'].forEach(k => assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k}: ${a[k]} != ${b[k]}`));

test('zooming out from a corner reaches the middle of the studio exactly when all of it fits', () => {
    near(zoomOutTarget(corner, overview, 500, 2000), overview);
    near(zoomOutTarget(corner, overview, 500, 1250), { x: 150, y: 85, z: -75 });
});

test('zooming out in small steps arrives at the same place as one step', () => {
    let target = corner, dist = 500;
    for (const next of [600, 800, 1100, 1500, 2000]) { target = zoomOutTarget(target, overview, dist, next); dist = next; }
    near(target, overview);
});

test('beyond the whole-studio view zooming out stays on its middle; zooming in leaves the target alone', () => {
    near(zoomOutTarget(corner, overview, 2500, 3000), overview);
    near(zoomOutTarget(corner, overview, 1500, 3000), overview);
    near(zoomOutTarget(corner, overview, 800, 600), corner);
});
