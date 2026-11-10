import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { drawerBoardOffset } from '../../src/domain/make/drawer-installation';
import { assemblyTimeline, playhead } from '../../src/domain/make/make-timeline';
import { stagingLayout } from '../../src/domain/make/make-staging';
import { drawerRunnerMeshes } from '../../src/presentation/make/drawer-runner-3d';
import { planShots, type DirectorCamera } from '../../src/presentation/make/make-director';

// One wide bay without doors: two deep drawers and four shallow ones side by side either side of a divider.
const split = () => makePiece({ pieces: [{ id: 1, name: 'Split', x: 0, y: 0, z: 0, angle: 0, design: {
  ...createInitialDesign(), w: 160, h: 210, d: 60, n: 1, wt: [160], doors: 'none',
  dividers: [{ i: 0, orientation: 'vertical', x: 79, y0: 60, y1: 112 }],
  secs: [[{ k: 'shelf', h: 30, y: 26 }, { k: 'drawer', h: 25, w: 78, x: 0, y: 60 }, { k: 'drawer', h: 25, w: 78, x: 0, y: 86 },
    { k: 'drawer', h: 12.5, w: 79, x: 80, y: 60 }, { k: 'drawer', h: 12.5, w: 79, x: 80, y: 73 },
    { k: 'drawer', h: 12.5, w: 79, x: 80, y: 86 }, { k: 'drawer', h: 12.5, w: 79, x: 80, y: 99 }, { k: 'shelf', h: 80, y: 113 }]],
} as never }] }, 1)!;

test('every drawer front has a box behind it, the shallow ones too', () => {
  const piece = split(), fronts = piece.boards.filter(b => b.name === 'Drawer front');
  assert.equal(fronts.length, 6);
  assert.equal(piece.drawers.length, 6, 'a front with no box would slide on nothing');
  assert.equal(piece.fittings.filter(f => f.runner).length, 6);
});

test('each box side runs on the upright beside it, either side of the divider', () => {
  const piece = split();
  for (const runner of piece.fittings.filter(f => f.runner)) {
    const [left, right] = runner.runner!.fixed.map(i => piece.boards[i]!), [l, r] = runner.runner!.moving.map(i => piece.boards[i]!);
    assert.ok(left!.x1 <= l!.x0 && right!.x0 >= r!.x1, 'uprights listed left then right, outside the box');
    const meshes = drawerRunnerMeshes(piece, runner, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    // A rail's foot reaches only from its upright to under the box side, never across the bay.
    for (const { mesh } of meshes) for (const bar of mesh.children) assert.ok(bar.scale.x < 4, `rail ${bar.scale.x} cm wide`);
  }
});

test('in the travel test only the drawer being tested moves, front and box together', () => {
  const piece = split(), tl = assemblyTimeline(piece), k = piece.steps.findIndex(s => s.stage === 'drawer-test'), s = tl.steps[k]!;
  const count = piece.fittings.filter(f => f.runner).length;
  for (let j = 0; j < count; j++) {
    const ph = playhead(tl, s.place[0] + (s.place[1] - s.place[0]) * (j + .45) / count);
    const moving = piece.drawers.filter(d => drawerBoardOffset(piece, tl, ph, d.front)[2] > 1);
    assert.equal(moving.length, 1, `drawer ${j + 1}`);
    const d = moving[0]!, by = drawerBoardOffset(piece, tl, ph, d.front)[2];
    for (const part of [d.back, d.bottom, ...d.sides]) assert.ok(Math.abs(drawerBoardOffset(piece, tl, ph, part)[2] - by) < 1e-6);
  }
});

const camera: DirectorCamera = {
  fittedCamera: (az, el, _padding, b) => ({ az, el, dist: Math.max(b.w, b.h, b.d), x: b.x, y: b.y, z: b.z }),
};

test('drilling and placing a drawer chapter stay close: never the whole floor of waiting parts at once', () => {
  const piece = split(), tl = assemblyTimeline(piece), shots = planShots(camera, piece, tl, stagingLayout(piece), p => p, 0).at;
  for (const stage of ['drawer-boxes', 'drawer-sides', 'drawer-back']) {
    const s = tl.steps[piece.steps.findIndex(x => x.stage === stage)]!;
    for (const [from, to] of [s.drill, s.place]) for (let f = .1; f < 1; f += .1) {
      const dist = shots(from + (to - from) * f).dist;
      assert.ok(dist <= 190, `${stage} at ${f.toFixed(1)}: framed ${dist.toFixed(0)} cm across`);
    }
  }
});

// A 2 m bay without doors: four drawers on the left and a trouser pull-out beside them, nothing between the two.
const column = () => makePiece({ pieces: [{ id: 1, name: 'Column', x: 0, y: 0, z: 0, angle: 0, design: {
  ...createInitialDesign(), w: 200, h: 210, d: 60, n: 1, wt: [200], doors: 'none', dividers: [],
  secs: [[...[0, 1, 2, 3].map(() => ({ k: 'drawer', h: 21, w: 103, ax: 'l' })), { k: 'pants', h: 70, w: 93, ax: 'r', y: 0 }]],
} as never }] }, 1)!;

test('a drawer stack with open space beside it gets its own side, and its drawers run between that and the cabinet side', () => {
  const piece = column(), fronts = piece.boards.filter(b => b.name === 'Drawer front'), right = Math.max(...fronts.map(f => f.x1));
  const sides = piece.boards.filter(b => b.name === 'Divider');
  assert.equal(sides.length, 1, 'one side for the stack');
  const side = sides[0]!;
  assert.ok(side.x1 <= right + .25 && side.x0 >= right - 3, 'at the stack\'s open edge, behind its fronts');
  assert.equal(piece.drawers.length, 4);
  for (const d of piece.drawers) {
    assert.equal(d.applied, null, 'a wardrobe drawer\'s own front is its box front');
    for (const part of [d.back, d.bottom, ...d.sides]) assert.ok(piece.boards[part]!.x1 <= side.x0 + .01, 'the box stays inside the stack');
  }
  for (const runner of piece.fittings.filter(f => f.runner)) assert.deepEqual(runner.runner!.fixed.map(i => piece.boards[i]!.name), ['Side', 'Divider']);
  // The boards between the drawers stop at the side; nothing of the stack reaches into the trouser pull-out.
  for (const b of piece.boards.filter(b => b.name === 'Shelf' && b.y0 > side.y0 && b.y1 < side.y1)) assert.ok(b.x1 <= side.x0 + .01 || b.x0 >= side.x1 - .01, `shelf at ${b.y0} crosses the side`);
});

// Three drawers placed 3.2 cm apart, as the editor lets them be: a chest of drawers, not three boxed drawers.
const spaced = (gap: number) => makePiece({ pieces: [{ id: 1, name: 'Chest', x: 0, y: 0, z: 0, angle: 0, design: {
  ...createInitialDesign(), w: 80, h: 210, d: 60, n: 1, wt: [80], doors: 'none', dividers: [],
  secs: [[0, 1, 2].map(n => ({ k: 'drawer', h: 21, y: n * (21 + gap) }))],
} as never }] }, 1)!;

test('drawers one above another are one stack: no board between them, fronts at one even reveal, boxes alike', () => {
  const piece = spaced(3.2), fronts = piece.boards.filter(b => b.name === 'Drawer front').sort((p, q) => p.y0 - q.y0);
  const low = fronts[0]!.y0, high = fronts.at(-1)!.y1;
  const between = piece.boards.filter(b => b.name === 'Shelf' && b.y0 > low && b.y1 < high);
  assert.deepEqual(between, [], 'runners carry the drawers: no board between them');
  const shelves = piece.boards.filter(b => b.name === 'Shelf');
  assert.equal(shelves.length, 1, 'only the board over the stack (the base is under it)');
  const reveals = fronts.slice(1).map((f, n) => Math.round((f.y0 - fronts[n]!.y1) * 10) / 10);
  assert.ok(reveals.every(r => r === reveals[0] && r < 1.5), `fronts at one small reveal (${reveals})`);
  assert.equal(new Set(fronts.map(f => (f.y1 - f.y0).toFixed(2))).size, 1, 'equal fronts');
  assert.equal(piece.parts.filter(p => p.name === 'Box side').length, 2, 'every box alike: a left and a right side');
  assert.equal(piece.parts.filter(p => p.name === 'Drawer front').length, 1, 'every front alike, drilled alike');
});

test('drawers far apart are separate, each with its own boards', () => {
  const piece = spaced(30);
  assert.ok(piece.boards.filter(b => b.name === 'Shelf').length >= 4, 'boards under and over drawers that stand apart');
});
