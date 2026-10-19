const { test } = require('node:test');
const assert = require('node:assert/strict');
const { phoneFraming, FILL } = require('../src/presentation/viewport/phone-framing.ts');

const piece = { x: 0, y: 0, z: 0, angle: 0 }, whole = { x: 0, y: 100, w: 200, h: 200, d: 60 };
// The distance at which the box fills the usable view (what the controller passes as `fit`).
const fit = 500;

test('a chosen piece at a workable size comes to the middle of the view at the same zoom', () => {
    const side = { ...piece, x: 330, z: -40 };
    assert.deepEqual(phoneFraming({ pose: side, box: whole, fit, dist: 1200, part: false }), { x: 330, y: 100, z: -40, dist: 1200 });
});

test('a piece too small to work on: the camera comes just close enough for it to fill about a third of the view', () => {
    assert.deepEqual(phoneFraming({ pose: piece, box: whole, fit, dist: 5000, part: false }), { x: 0, y: 100, z: 0, dist: fit / FILL.piece.aim });
});

test('a piece too close to see whole: the camera backs off to the same size, leaving room to move it', () => {
    assert.equal(phoneFraming({ pose: piece, box: whole, fit, dist: 300, part: false }).dist, fit / FILL.piece.aim);
});

test('a chosen fitting comes to the middle, turned with its wardrobe, and is brought to about a third of the view', () => {
    const turned = { x: 100, y: 0, z: 50, angle: Math.PI / 2 }, shelf = { x: 40, y: 80, w: 58, h: 27, d: 58 };
    const goal = phoneFraming({ pose: turned, box: shelf, fit: 200, dist: 3000, part: true });
    assert.ok(Math.abs(goal.x - 100) < 1e-9 && Math.abs(goal.z - 10) < 1e-9 && goal.y === 80);
    assert.equal(goal.dist, 200 / FILL.part.aim);
    assert.equal(phoneFraming({ pose: turned, box: shelf, fit: 200, dist: 400, part: true }).dist, 400, 'already big enough: same zoom');
});
