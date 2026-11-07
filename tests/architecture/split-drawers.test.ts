import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { drawerBoardOffset } from '../../src/domain/make/drawer-installation';
import { assemblyTimeline, playhead } from '../../src/domain/make/make-timeline';
import { stagingLayout } from '../../src/domain/make/make-staging';
import { drawerRunnerMeshes } from '../../src/presentation/make/drawer-runner-3d';
import { planShots, type DirectorCamera, type Pose } from '../../src/presentation/make/make-director';

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
  cameraSample(a, b, t) {
    return Object.fromEntries(Object.keys(a).map(key => [key, a[key as keyof Pose] + (b[key as keyof Pose] - a[key as keyof Pose]) * t])) as unknown as Pose;
  },
};

test('drilling and placing a drawer chapter stay close: never the whole floor of waiting parts at once', () => {
  const piece = split(), tl = assemblyTimeline(piece), shots = planShots(camera, piece, tl, stagingLayout(piece), p => p, 0);
  for (const stage of ['drawer-boxes', 'drawer-sides', 'drawer-back']) {
    const s = tl.steps[piece.steps.findIndex(x => x.stage === stage)]!;
    for (const [from, to] of [s.drill, s.place]) for (let f = .1; f < 1; f += .1) {
      const dist = shots(from + (to - from) * f).dist;
      assert.ok(dist <= 190, `${stage} at ${f.toFixed(1)}: framed ${dist.toFixed(0)} cm across`);
    }
  }
});
