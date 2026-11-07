import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePiece } from '../../src/domain/make/make-parts';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { assemblyTimeline, playhead } from '../../src/domain/make/make-timeline';
import { stagingLayout } from '../../src/domain/make/make-staging';
import { drawerBoardOffset } from '../../src/domain/make/drawer-installation';
import { entryOf } from '../../src/domain/make/make-fixing';
import { planShots, type DirectorCamera, type Pose } from '../../src/presentation/make/make-director';

const camera: DirectorCamera = {
  fittedCamera: (az, el, _padding, b) => ({ az, el, dist: Math.max(b.w, b.h, b.d), x: b.x, y: b.y, z: b.z }),
  cameraSample(a, b, t) {
    return Object.fromEntries(Object.keys(a).map(key => {
      const k = key as keyof Pose; return [k, a[k] + (b[k] - a[k]) * t];
    })) as unknown as Pose;
  },
};
function fixture() {
  const piece = makePiece({ pieces: [{ id: 1, name: 'Drawers', x: 0, y: 0, z: 0, angle: 0, design: createKitchenDesign('base', 'drawers') }] }, 1)!;
  const tl = assemblyTimeline(piece), shots = planShots(camera, piece, tl, stagingLayout(piece), p => p, 0);
  return { piece, tl, shots };
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('runner drilling camera follows drawer holes outside the cabinet', () => {
  const { piece, tl, shots } = fixture(), k = piece.steps.findIndex(s => s.stage === 'drawer-runners'), s = tl.steps[k]!;
  const time = s.drill[0] + (s.drill[1] - s.drill[0]) * .45, ph = playhead(tl, time);
  const zs = piece.holes.filter((_, i) => tl.holeStep[i] === k).map(h => h.at[2] + drawerBoardOffset(piece, tl, ph, h.board)[2] - piece.size.d / 2);
  near(shots(time).z, (Math.min(...zs) + Math.max(...zs)) / 2);
});

test('insertion camera frames the actual inserted position, rather than the box position at chapter start', () => {
  const { piece, tl, shots } = fixture(), k = piece.steps.findIndex(s => s.stage === 'drawers'), s = tl.steps[k]!;
  const time = s.place[0] + (s.place[1] - s.place[0]) * .9, ph = playhead(tl, time);
  const zs = piece.boards.flatMap((b, i) => tl.boardStep[i]! >= k ? [] : [b.z0, b.z1]
    .map(z => z + drawerBoardOffset(piece, tl, ph, i)[2] - piece.size.d / 2));
  near(shots(time).z, (Math.min(...zs) + Math.max(...zs)) / 2);
});

test('runner screws go into the cabinet only, and are viewed from inside it, where they go in', () => {
  const { piece, tl, shots } = fixture(), k = piece.steps.findIndex(s => s.stage === 'drawer-runners');
  const fixes = tl.steps[k]!.fixes.filter(f => f.items.every(i => piece.fittings[i]!.purpose === 'runner-mount'));
  assert.ok(fixes.length >= 2);
  assert.ok(fixes.every(f => f.board !== null && piece.boards[f.board]!.note !== 'drawer box'), 'bottom-mounted runners: nothing is screwed into the box');
  for (const fix of fixes) {
    const time = fix.at[0] + (fix.at[1] - fix.at[0]) * .2, pose = shots(time), e = entryOf(piece, fix.items[0]!)!;
    assert.ok(Math.sin(pose.az) * -e.dir[0] + Math.cos(pose.az) * -e.dir[2] > .2,
      'camera must face the screw heads, not look through the cabinet side');
  }
});

test('opening and closing hold the same camera shot for each drawer, including reverse seeking', () => {
  const { piece, tl, shots } = fixture(), k = piece.steps.findIndex(s => s.stage === 'drawer-test'), s = tl.steps[k]!;
  const count = piece.fittings.filter(f => f.runner).length, duration = (s.place[1] - s.place[0]) / count;
  for (let drawer = 0; drawer < count; drawer++) {
    const start = s.place[0] + duration * drawer, expected = shots(start + duration * .45);
    for (const fraction of [.1, .35, .55, .8, .95, .35, .1]) {
      const actual = shots(start + duration * fraction);
      for (const key of Object.keys(expected) as (keyof Pose)[]) near(actual[key], expected[key]);
    }
  }
});

test('each drawer demo shot frames both the closed and open box, with finite poses across every chapter', () => {
  const { piece, tl, shots } = fixture(), k = piece.steps.findIndex(s => s.stage === 'drawer-test'), s = tl.steps[k]!;
  const runners = piece.fittings.filter(f => f.runner), duration = (s.place[1] - s.place[0]) / runners.length;
  runners.forEach((runner, j) => {
    const time = s.place[0] + duration * (j + .45), pose = shots(time);
    const side = piece.boards[runner.runner!.moving[0]!]!, offset = drawerBoardOffset(piece, tl, playhead(tl, time), runner.runner!.moving[0]!)[2];
    const closed = side.z0 - piece.size.d / 2, open = side.z1 + offset - piece.size.d / 2;
    assert.ok(pose.z > closed && pose.z < open);
    assert.ok(pose.dist >= open - closed, 'fit includes the complete path, not only the closed box');
  });
  for (let t = 0; t <= tl.duration; t += .2) {
    const pose = shots(t);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.dist > 0);
  }
});
