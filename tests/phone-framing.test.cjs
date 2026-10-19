const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PerspectiveCamera } = require('three');
const { phoneFraming, FILL, BARS } = require('../src/presentation/viewport/phone-framing.ts');

// A phone view: 375 × 640, the camera looking at `tgt` from `dist` at a turn and tilt, as the editor places it.
const view = { left: 0, top: 0, right: 375, bottom: 640, width: 375, height: 640 };
function camera({ az = 0, el = .3, dist, tgt = { x: 0, y: 100, z: 0 } }) {
    const cam = new PerspectiveCamera(35, view.width / view.height, 5, 50000);
    cam.position.set(tgt.x + dist * Math.cos(el) * Math.sin(az), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.cos(az));
    cam.lookAt(tgt.x, tgt.y, tgt.z);
    return cam;
}
const piece = { x: 0, y: 0, z: 0, angle: 0 }, whole = { x: 0, y: 100, w: 200, h: 200, d: 60 };
// The distance at which the box fills the usable view (what the controller passes as `fit`).
const fit = 500;

test('a chosen piece already in view at a workable size: the camera stays where it is', () => {
    assert.equal(phoneFraming({ cam: camera({ dist: 800 }), view, pose: piece, box: whole, fit, dist: 800, part: false }), null);
});

test('a piece seen tiny from far away: the camera comes just close enough for it to fill about a third of the view', () => {
    const goal = phoneFraming({ cam: camera({ dist: 5000 }), view, pose: piece, box: whole, fit, dist: 5000, part: false });
    assert.deepEqual(goal, { x: 0, y: 100, z: 0, dist: fit / FILL.piece.aim });
});

test('a piece too close to see whole: the camera backs off to the same size, leaving room to move it', () => {
    const goal = phoneFraming({ cam: camera({ dist: 300 }), view, pose: piece, box: whole, fit, dist: 300, part: false });
    assert.equal(goal.dist, fit / FILL.piece.aim);
});

test('the right size but partly out of view (or under the toolbar): the camera only slides over to it', () => {
    const side = { ...piece, x: 330 };
    const goal = phoneFraming({ cam: camera({ dist: 800 }), view, pose: side, box: whole, fit, dist: 800, part: false });
    assert.deepEqual(goal, { x: 330, y: 100, z: 0, dist: 800 });
    const low = phoneFraming({ cam: camera({ dist: 800, tgt: { x: 0, y: 230, z: 0 } }), view, pose: piece, box: whole, fit, dist: 800, part: false });
    assert.equal(low.dist, 800, 'a piece reaching under the bottom bar is brought up, not zoomed');
    assert.ok(BARS.bottom > 0);
});

test('a chosen fitting is framed less closely than before: about a third of the view, centred on it, in the piece\'s frame', () => {
    const turned = { x: 100, y: 0, z: 50, angle: Math.PI / 2 }, shelf = { x: 40, y: 80, w: 58, h: 27, d: 58 };
    const goal = phoneFraming({ cam: camera({ dist: 3000 }), view, pose: turned, box: shelf, fit: 200, dist: 3000, part: true });
    assert.ok(Math.abs(goal.x - 100) < 1e-9 && Math.abs(goal.z - 10) < 1e-9 && goal.y === 80, 'centred on the fitting, turned with its wardrobe');
    assert.equal(goal.dist, 200 / FILL.part.aim);
});
