import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { drawerBoardOffset, drawerRunnerForBoard } from '../../src/domain/make/drawer-installation';
import { assemblyTimeline, playhead } from '../../src/domain/make/make-timeline';
import { createMakePlayer } from '../../src/presentation/make/make-player';
import { drawerRunnerMeshes } from '../../src/presentation/make/drawer-runner-3d';
import { entryOf } from '../../src/domain/make/make-fixing';

const make = (design = createKitchenDesign('base', 'drawers')) => makePiece({ pieces: [
  { id: 1, name: 'Drawers', x: 0, y: 0, z: 0, angle: 0, design },
] }, 1)!;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('drawer sequence builds the box, mounts the runners, engages the box, attaches the front and tests travel', () => {
  const piece = make(), stages = piece.steps.map(s => s.stage);
  const expected = ['drawer-boxes', 'drawer-runners', 'drawers', 'fronts', 'drawer-test'] as const;
  for (let i = 1; i < expected.length; i++) assert.ok(stages.indexOf(expected[i]!) > stages.indexOf(expected[i - 1]!));
  for (const step of piece.steps) for (const board of step.boards)
    if (piece.boards[board]!.note === 'drawer box') assert.equal(step.stage, 'drawer-boxes');
  const plain = make({ ...createInitialDesign(), secs: [[{ k: 'shelf', h: 50 }]], doors: 'none' });
  assert.ok(!plain.steps.some(s => expected.filter(v => v !== 'fronts').includes(s.stage as never)), 'no phantom drawer chapters');
});

test('rail screws are short, driven from inside and owned by the correct runner installation stage', () => {
  const piece = make(), tl = assemblyTimeline(piece), rails = piece.fittings.filter(f => f.runner);
  assert.ok(rails.length > 1);
  for (const rail of rails) {
    assert.equal(rail.runner!.fixed.length, 2);
    assert.equal(rail.runner!.moving.length, 2);
    for (const id of rail.runner!.fixed) assert.notEqual(piece.boards[id]!.note, 'drawer box');
    for (const id of rail.runner!.moving) assert.equal(piece.boards[id]!.name, 'Box side');
  }
  const mounts = piece.fittings.flatMap((f, i) => f.purpose === 'runner-mount' ? [i] : []);
  assert.ok(mounts.length >= rails.length * 8, 'both cabinet members and both drawer members are fixed');
  for (const i of mounts) {
    const fitting = piece.fittings[i]!, hole = piece.holes.find(h => h.of === i)!;
    assert.equal(fitting.kind, 'screw'); assert.equal(fitting.size, '4 × 12');
    assert.equal(hole.d, 2.5); assert.equal(hole.depth, 12);
    assert.equal(piece.steps[tl.itemStep[i]!]!.stage, 'drawer-runners');
    const b = piece.boards[hole.board]!;
    assert.ok(hole.at[0] + hole.sign * 1.2 > b.x0 && hole.at[0] + hole.sign * 1.2 < b.x1, 'screw stays within the 18 mm panel');
  }
});

test('boxes are assembled outside, inserted as rigid groups and opened one at a time with their fronts', () => {
  const piece = make(), tl = assemblyTimeline(piece), k = (stage: string) => piece.steps.findIndex(s => s.stage === stage);
  const offset = (time: number, id: number) => drawerBoardOffset(piece, tl, playhead(tl, time), id)[2];
  const rails = piece.fittings.filter(f => f.runner), mount = tl.steps[k('drawer-runners')]!, insert = tl.steps[k('drawers')]!, demo = tl.steps[k('drawer-test')]!;
  for (const rail of rails) {
    const ids = piece.boards.flatMap((_, i) => drawerRunnerForBoard(piece, i) === rail ? [i] : []);
    const boxes = ids.filter(i => piece.boards[i]!.note === 'drawer box');
    assert.equal(boxes.length, 5);
    for (const i of boxes) {
      near(offset(mount.start, i), Number(rail.size) / 10 + 8);
      near(offset((insert.place[0] + insert.place[1]) / 2, i), (Number(rail.size) / 10 + 8) / 2);
      near(offset(insert.end, i), 0);
    }
  }
  const span = (demo.place[1] - demo.place[0]) / rails.length;
  rails.forEach((rail, index) => {
    const time = demo.place[0] + (index + .45) * span;
    piece.boards.forEach((_, id) => {
      const owner = drawerRunnerForBoard(piece, id), motion = piece.motions[id];
      if (motion?.kind !== 'slide') { near(offset(time, id), 0); return; }
      near(offset(time, id), owner === rail ? motion.by : 0);
      near(offset(demo.place[0] + (index + .97) * span, id), 0);
    });
  });
  piece.boards.forEach((_, id) => near(offset(tl.duration, id), 0));
});

test('front screws fasten the decorative face from inside the box, without breaking out', () => {
  const piece = make(), fixings = piece.fittings.filter(f => f.purpose === 'drawer-front');
  assert.equal(fixings.length, piece.fittings.filter(f => f.runner).length * 2);
  for (const f of fixings) {
    const end = piece.boards[f.boards[0]!]!, front = piece.boards[f.boards[1]!]!;
    assert.equal(end.name, 'Box end'); assert.equal(front.stock, 'front');
    near(f.at[2], end.z0);
    assert.ok(f.at[2] + 3 > front.z0 && f.at[2] + 3 < front.z1);
  }
});

test('runner geometry has two stationary outer members, two telescoping members and two drawer members', () => {
  const piece = make(), fitting = piece.fittings.find(f => f.runner)!, geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const rails = drawerRunnerMeshes(piece, fitting, geometry, material);
  assert.equal(rails.length, 6);
  assert.equal(rails.filter(r => fitting.runner!.moving.includes(r.board)).length, 2);
  assert.equal(rails.filter(r => r.moving !== undefined && r.ratio === .5).length, 2);
  assert.equal(rails.filter(r => fitting.runner!.fixed.includes(r.board) && r.moving === undefined).length, 2);
  assert.ok(rails.every(r => r.mesh.children.length >= 3), 'nested channel flanges are modeled');
  geometry.dispose(); material.dispose();
});

test('seeking and reverse playback reproduce the same drawer offsets and fitting visibility', () => {
  const piece = make(), p = createMakePlayer(); p.load(piece);
  const k = piece.steps.findIndex(s => s.stage === 'drawer-test'), phase = p.timeline!.steps[k]!.place;
  const time = phase[0] + (phase[1] - phase[0]) * .15;
  p.seek(time); const film = p.film()!, expected = piece.boards.map((_, i) => film.nudge!(i));
  p.seek(time + 1); p.direction(-1); p.toggle(); p.advance(1);
  assert.deepEqual(piece.boards.map((_, i) => p.film()!.nudge!(i)), expected);
  p.seek(0);
  for (const [index, f] of piece.fittings.entries()) if (f.runner) assert.equal(p.film()!.item(index), null, 'runners are not preinstalled');
});

test('open and close demonstrations animate and pause exactly at their target, including reverse opening', () => {
  const piece = make(), p = createMakePlayer(); p.load(piece);
  const k = piece.steps.findIndex(s => s.stage === 'drawer-test'), span = p.timeline!.steps[k]!.place;
  const length = (span[1] - span[0]) / piece.fittings.filter(f => f.runner).length;
  const open = span[0] + length * .45, closed = span[0] + length * .97;
  p.seek(span[0]); p.animateTo(open); p.advance(.2);
  assert.ok(p.time > span[0] && p.time < open); assert.equal(p.playing, true);
  p.advance(1000); near(p.time, open); assert.equal(p.playing, false);
  p.animateTo(closed); p.advance(1000); near(p.time, closed); assert.equal(p.playing, false);
  p.animateTo(open); assert.equal(p.rate, -1); p.advance(1000); near(p.time, open); assert.equal(p.playing, false);
});

test('drawer bottom nails enter upwards from underneath, even with a grooved cabinet back', () => {
  const piece = make({ ...createKitchenDesign('base', 'drawers'), construction: { joints: 'confirmat', back: 'grooved' } });
  const nails = piece.fittings.flatMap((f, i) => f.kind === 'nail' && piece.boards[f.boards[0]!]!.name === 'Box bottom' ? [i] : []);
  assert.ok(nails.length > 0);
  for (const i of nails) {
    const f = piece.fittings[i]!, b = piece.boards[f.boards[0]!]!, entry = entryOf(piece, i)!;
    assert.equal(f.axis, 1); assert.deepEqual(entry.dir, [0, 1, 0]); near(entry.at[1], b.y0);
  }
});
