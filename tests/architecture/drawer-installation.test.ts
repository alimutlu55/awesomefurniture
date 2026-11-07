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

const wardrobe = () => make({ ...createInitialDesign(), w: 80, h: 200, d: 60, n: 1, wt: [1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'shelf', h: 35 }]] } as never);
const FLAT_PACK = ['drawer-boxes', 'drawer-sides', 'drawer-back', 'drawer-runners', 'drawers', 'drawer-lock', 'fronts', 'drawer-test'] as const;

test('a drawer goes together as a flat-pack drawer: front and bottom, sides, back, runners, on, locked, tested', () => {
  const piece = make(), stages = piece.steps.map(s => s.stage);
  for (let i = 1; i < FLAT_PACK.length; i++) assert.ok(stages.indexOf(FLAT_PACK[i]!) > stages.indexOf(FLAT_PACK[i - 1]!), FLAT_PACK[i]);
  const stageOf = (board: number) => piece.steps.find(s => s.boards.includes(board))!.stage;
  assert.equal(piece.drawers.length, 3);
  for (const d of piece.drawers) {
    assert.equal(stageOf(d.front), 'drawer-boxes'); assert.equal(stageOf(d.bottom), 'drawer-boxes');
    for (const side of d.sides) assert.equal(stageOf(side), 'drawer-sides');
    assert.equal(stageOf(d.back), 'drawer-back');
    assert.equal(stageOf(d.applied!), 'fronts', 'a kitchen drawer\'s applied front goes on last');
  }
  const plain = make({ ...createInitialDesign(), secs: [[{ k: 'shelf', h: 50 }]], doors: 'none' });
  assert.ok(!plain.steps.some(s => FLAT_PACK.filter(v => v !== 'fronts').includes(s.stage as never)), 'no phantom drawer chapters');
});

test('the box is joined as the instructions say: cam bolts in the front, cams and a dowel at each side, expanding dowels through the back', () => {
  for (const piece of [make(), wardrobe()]) {
    const tl = assemblyTimeline(piece), stage = (i: number) => piece.steps[tl.itemStep[i]!]!.stage;
    for (const d of piece.drawers) {
      const mine = piece.fittings.map((f, i) => ({ f, i })).filter(({ f }) => f.boards.some(b => [d.front, d.back, d.bottom, ...d.sides].includes(b)) && f.purpose);
      const of = (kind: string, purpose: string) => mine.filter(({ f }) => f.kind === kind && f.purpose === purpose);
      const bolts = of('bolt', 'box-front'), cams = of('cam', 'box-sides'), dowels = of('dowel', 'box-sides'), expanding = of('dowel', 'box-back');
      assert.equal(bolts.length, 4); assert.equal(cams.length, 4); assert.equal(dowels.length, 2); assert.equal(expanding.length, 4);
      for (const { f } of bolts) assert.equal(f.boards[0], d.front, 'the bolt is screwed into the front');
      for (const { f } of expanding) { assert.equal(f.boards[0], d.back); assert.match(f.size!, /expanding/); }
      for (const { i } of bolts) assert.equal(stage(i), 'drawer-boxes');
      for (const { i } of [...cams, ...dowels]) assert.equal(stage(i), 'drawer-sides');
      for (const { i } of expanding) assert.equal(stage(i), 'drawer-back');
      // The runner's hooks go into the back; its pins up through the bottom, under a plate, locked by a lever.
      assert.equal(piece.holes.filter(h => h.board === d.back && h.kind === 'runner').length, 2);
      assert.equal(piece.holes.filter(h => h.board === d.bottom && h.kind === 'runner' && h.axis === 1 && h.depth === 0).length, 2);
      const plates = of('drawerLock', 'drawer-plate'), levers = of('drawerLock', 'drawer-lock');
      assert.equal(plates.length, 2); assert.equal(levers.length, 2);
      for (const { i } of plates) assert.equal(stage(i), 'drawers');
      for (const { i } of levers) { assert.equal(stage(i), 'drawer-lock'); assert.deepEqual(entryOf(piece, i)!.dir, [0, 1, 0], 'from below'); }
      // Nothing joins a box board with the carcass's own connectors.
      assert.ok(!piece.fittings.some(f => f.kind === 'confirmat' && f.boards.some(b => [d.back, d.bottom, ...d.sides].includes(b))));
    }
  }
});

test('the bottom is captured in grooves in the front, both sides and the back, never nailed', () => {
  for (const piece of [make({ ...createKitchenDesign('base', 'drawers'), construction: { joints: 'confirmat', back: 'grooved' } }), wardrobe()]) {
    assert.equal(piece.fittings.filter(f => f.kind === 'nail' && f.boards.some(b => piece.boards[b]!.name === 'Box bottom')).length, 0);
    for (const d of piece.drawers) {
      const bottom = piece.boards[d.bottom]!;
      for (const k of [d.front, ...d.sides, d.back]) {
        const g = piece.grooves.find(q => q.board === k && q.lo[1] <= bottom.y0 + 1e-6 && q.hi[1] >= bottom.y1 - 1e-6);
        assert.ok(g, `${piece.boards[k]!.name} has the bottom's groove`);
        assert.ok(Math.max(...g!.hi.map((v, a) => v - g!.lo[a]!)) > 5, 'along the board');
      }
    }
  }
});

test('a wardrobe drawer\'s own front is its box front: no second front, no front screws', () => {
  const piece = wardrobe();
  assert.equal(piece.drawers.length, 2);
  assert.ok(piece.drawers.every(d => d.applied === null && piece.boards[d.front]!.name === 'Drawer front'));
  assert.equal(piece.boards.filter(b => b.name === 'Box front').length, 0);
  assert.equal(piece.fittings.filter(f => f.purpose === 'drawer-front').length, 0);
});

test('runners are fixed to the cabinet only: two short screws through the front bracket, the rear peg in a System 32 hole', () => {
  const piece = make(), tl = assemblyTimeline(piece), rails = piece.fittings.map((f, i) => ({ f, i })).filter(({ f }) => f.runner);
  assert.equal(rails.length, 3);
  for (const { f: rail, i: index } of rails) {
    assert.equal(rail.runner!.fixed.length, 2);
    assert.equal(rail.runner!.moving.length, 2);
    for (const id of rail.runner!.fixed) {
      assert.notEqual(piece.boards[id]!.note, 'drawer box');
      const own = piece.holes.filter(h => h.board === id && h.kind === 'runner' && (h.of === index || piece.fittings[h.of!]?.purpose === 'runner-mount' && Math.abs(h.at[1] - rail.at[1]) < .01));
      assert.equal(own.length, 3, 'two screw holes at the front and the peg hole');
      const peg = own.filter(h => h.of === index);
      assert.equal(peg.length, 1); assert.ok(peg[0]!.at[2] < Math.min(...own.filter(h => h.of !== index).map(h => h.at[2])), 'the peg is at the rear');
    }
    for (const id of rail.runner!.moving) assert.equal(piece.boards[id]!.name, 'Box side');
  }
  const mounts = piece.fittings.flatMap((f, i) => f.purpose === 'runner-mount' ? [i] : []);
  assert.equal(mounts.length, rails.length * 4, 'two screws a rail, two rails a drawer');
  for (const i of mounts) {
    const fitting = piece.fittings[i]!, hole = piece.holes.find(h => h.of === i)!;
    assert.equal(fitting.kind, 'screw'); assert.equal(fitting.size, '4 × 12');
    assert.equal(hole.d, 2.5); assert.equal(hole.depth, 12);
    assert.notEqual(piece.boards[hole.board]!.note, 'drawer box', 'nothing is screwed into the box');
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

test('a kitchen drawer\'s applied front is screwed on from inside its box front, without breaking out', () => {
  const piece = make(), fixings = piece.fittings.filter(f => f.purpose === 'drawer-front');
  assert.equal(fixings.length, piece.fittings.filter(f => f.runner).length * 2);
  for (const f of fixings) {
    const end = piece.boards[f.boards[0]!]!, front = piece.boards[f.boards[1]!]!;
    assert.equal(end.name, 'Box front'); assert.equal(front.stock, 'front');
    near(f.at[2], end.z0);
    assert.ok(f.at[2] + 3 > front.z0 && f.at[2] + 3 < front.z1);
  }
});

test('runner geometry: a cabinet rail on each upright and a drawer rail under each box side', () => {
  const piece = make(), fitting = piece.fittings.find(f => f.runner)!, geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const rails = drawerRunnerMeshes(piece, fitting, geometry, material);
  assert.equal(rails.length, 4);
  assert.equal(rails.filter(r => fitting.runner!.fixed.includes(r.board)).length, 2, 'the cabinet rails stay');
  assert.equal(rails.filter(r => fitting.runner!.moving.includes(r.board)).length, 2, 'the drawer rails move with the box');
  for (const r of rails.filter(q => fitting.runner!.moving.includes(q.board))) {
    const side = piece.boards[r.board]!;
    assert.ok(r.mesh.position.y < side.y0, 'under the box side');
  }
  assert.ok(rails.every(r => r.mesh.children.length >= 3), 'web, foot and bracket; rail, hook and pin');
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


test('the drawers stand out while the levers are turned under them, and are home again after', () => {
  const piece = make(), tl = assemblyTimeline(piece), k = piece.steps.findIndex(s => s.stage === 'drawer-lock'), s = tl.steps[k]!;
  assert.ok(k >= 0 && s.fix[1] > s.fix[0]);
  const offset = (time: number, id: number) => drawerBoardOffset(piece, tl, playhead(tl, time), id)[2];
  for (const d of piece.drawers) for (const id of [d.front, d.bottom, d.back, ...d.sides]) {
    const by = piece.motions[id]!.kind === 'slide' ? (piece.motions[id] as { by: number }).by : 0;
    near(offset(s.start, id), 0);
    near(offset((s.fix[0] + s.fix[1]) / 2, id), by);
    near(offset(s.end, id), 0);
  }
});
