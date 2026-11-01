import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { arrivalAt, assemblyTimeline, drillAt, drilled, FITTED_FIRST, fittedAt, INTRO, OUTRO, playhead, stepStart } from '../../src/domain/make/make-timeline';
import { lyingDir, lyingFlat, lyingPoint, stagingLayout } from '../../src/domain/make/make-staging';
import { entryOf } from '../../src/domain/make/make-fixing';
import { tiltOf } from '../../src/domain/make/make-measures';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// The assembly film: a pure function of time, so playing, scrubbing and replaying all show the same thing.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const sloped: EditorDesign = { ...wardrobe, doors: 'none', shape: { template: 'sloped', top: [{ x: 0, y: 220 }, { x: 100, y: 160 }] } as EditorDesign['shape'] };
const designs = { wardrobe, plain: createInitialDesign(), base: createKitchenDesign('base'), drawers: createKitchenDesign('base', 'drawers'), sloped };
const make = (design: EditorDesign) => makePiece({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] }, 1)!;
const times = (duration: number) => Array.from({ length: 401 }, (_, i) => duration * i / 400);

test('every hole is drilled for a fitting', () => {
  for (const joints of JOINT_SYSTEMS) for (const [name, design] of Object.entries(designs)) {
    const mp = make({ ...design, construction: { joints, back: 'nailed' } });
    mp.holes.forEach(h => assert.ok(h.of !== undefined && mp.fittings[h.of], `${name} ${joints}: a ${h.kind} hole names its fitting`));
    for (const h of mp.holes.filter(x => x.kind === 'cup')) assert.equal(mp.fittings[h.of!]!.kind, 'hinge');
    for (const h of mp.holes.filter(x => x.kind === 'connector')) assert.equal(mp.fittings[h.of!]!.kind, 'confirmat');
    for (const h of mp.holes.filter(x => x.kind === 'runner')) assert.equal(mp.fittings[h.of!]!.kind, 'runner');
    for (const h of mp.holes.filter(x => x.kind === 'bolt')) assert.equal(mp.fittings[h.of!]!.kind, 'bolt');
    for (const h of mp.holes.filter(x => x.kind === 'cam')) assert.equal(mp.fittings[h.of!]!.kind, 'cam');
  }
});

test('the steps follow each other without gaps, each drilling, then bringing boards in, then fixing them', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), tl = assemblyTimeline(mp);
    assert.equal(tl.steps.length, mp.steps.length);
    tl.steps.forEach((s, k) => {
      assert.equal(s.start, k ? tl.steps[k - 1]!.end : INTRO, `${name}: step ${k + 1} starts where the last ended, after the opening`);
      assert.ok(s.start <= s.drill[0] && s.drill[1] <= s.place[0] && s.place[1] <= s.fix[0] && s.fix[1] < s.end, `${name}: phases in order`);
      assert.equal(playhead(tl, stepStart(tl, k)).step, k);
    });
    assert.equal(tl.duration, tl.steps.at(-1)!.end + OUTRO, 'the film ends going round the finished piece');
    assert.equal(playhead(tl, -5).step, 0, 'before the start is the start');
    assert.equal(playhead(tl, tl.duration + 5).step, tl.steps.length - 1, 'after the end is the end');
  }
});

test('at any moment a board waits before its step, comes in during it and is in place after; the end is the piece built', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), tl = assemblyTimeline(mp), end = playhead(tl, tl.duration);
    mp.boards.forEach((_, i) => {
      assert.equal(arrivalAt(tl, end, i), 1, `${name}: board ${i} in place at the end`);
      assert.equal(arrivalAt(tl, playhead(tl, 0), i), 0, `${name}: board ${i} waits at the start`);
      let last = -1;
      for (const t of times(tl.duration)) {
        const a = arrivalAt(tl, playhead(tl, t), i);
        assert.ok(a >= last - 1e-9, `${name}: board ${i} never goes back out`);
        last = a;
      }
    });
    mp.holes.forEach((_, h) => assert.ok(drilled(tl, end, h), `${name}: hole ${h} drilled by the end`));
    mp.fittings.forEach((f, i) => assert.equal(fittedAt(tl, end, i, f.kind), 1, `${name}: ${f.kind} ${i} home by the end`));
  }
});

test('a hole is drilled before its fitting goes in, and the drill is in it only while it is being drilled', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), tl = assemblyTimeline(mp);
    for (const t of times(tl.duration)) {
      const ph = playhead(tl, t);
      mp.holes.forEach((h, i) => {
        const fit = fittedAt(tl, ph, h.of!, mp.fittings[h.of!]!.kind);
        if (fit !== null && fit > 0) assert.ok(drilled(tl, ph, i), `${name}: ${h.kind} hole ${i} drilled before its ${mp.fittings[h.of!]!.kind} goes in`);
        const bit = drillAt(tl, ph, i);
        if (bit !== null) assert.ok(bit > 0 && bit < 1 && tl.holeStep[i] === ph.step);
      });
    }
  }
});

test('every part waits lying flat on the floor in front of the piece, none on another', () => {
  for (const [name, design] of Object.entries(designs)) for (const floor of [0, -142]) {
    const mp = make(design), staged = stagingLayout(mp, floor);
    staged.forEach((s, i) => {
      const b = mp.boards[i]!, flat = lyingFlat(b);
      assert.ok(Math.abs(s.size[1] - Math.min(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, b.cut.thickness)) < 1e-9, `${name}: ${b.name} lies on its face`);
      assert.ok(s.size[0] >= s.size[2] - 1e-9, `${name}: ${b.name} lies with its length across`);
      assert.deepEqual(s.size, flat.size);
      assert.ok(Math.abs(s.at[1] - s.size[1] / 2 - floor) < 1e-9, `${name}: ${b.name} on the floor`);
      assert.ok(s.at[2] - s.size[2] / 2 >= mp.size.d, `${name}: ${b.name} in front of the piece`);
      staged.slice(i + 1).forEach((o, k) => {
        const apart = [0, 2].some(a => Math.abs(s.at[a]! - o.at[a]!) >= (s.size[a]! + o.size[a]!) / 2 - 1e-6);
        assert.ok(apart, `${name}: ${b.name} and board ${i + k + 1} lie apart`);
      });
    });
  }
});

test('a step puts its boards in one after another: the base before the sides, shelves from the bottom up', () => {
  const mp = make(wardrobe), tl = assemblyTimeline(mp), at = (name: string) => mp.boards.map((b, i) => ({ b, i })).filter(x => x.b.name === name);
  for (const side of at('Side')) assert.ok(tl.boardStart[side.i]! > tl.boardStart[at('Base')[0]!.i]!, 'the base goes in before a side');
  const shelves = at('Shelf').filter(x => tl.boardStep[x.i] === tl.boardStep[at('Shelf')[0]!.i]).sort((p, q) => p.b.y0 - q.b.y0);
  shelves.slice(1).forEach((x, k) => assert.ok(Math.round(x.b.y0 / 10) === Math.round(shelves[k]!.b.y0 / 10) || tl.boardStart[x.i]! > tl.boardStart[shelves[k]!.i]!, 'lower shelves first'));
});

test('each joint is fixed in its own time, its fittings going in one after another, through a board that is there', () => {
  for (const joints of JOINT_SYSTEMS) for (const [name, design] of Object.entries(designs)) {
    const mp = make({ ...design, construction: { joints, back: 'nailed' } }), tl = assemblyTimeline(mp), staged = stagingLayout(mp);
    tl.steps.forEach((s, k) => {
      s.fixes.forEach((fix, j) => {
        const before = s.fixes[j - 1];
        assert.ok(!before || before.at[1] <= fix.at[0] + 1e-9, `${name}: joints of step ${k + 1} one after another`);
        assert.ok(fix.before ? s.drill[1] <= fix.at[0] && fix.at[1] <= s.place[0] + 1e-9 : s.place[1] <= fix.at[0] && fix.at[1] <= s.end, `${name}: a joint in its phase`);
        assert.ok(!fix.lying || fix.before, `${name}: only what goes in before the boards meet goes into a board on the floor`);
        let last = -Infinity;
        for (const i of fix.items) {
          const [shown, go, home] = tl.itemTime[i]!, e = entryOf(mp, i)!;
          assert.ok(shown === fix.at[0] && go > shown && home > go && home < fix.at[1], `${name}: ${mp.fittings[i]!.kind} goes in within its joint`);
          assert.ok(go > last, `${name}: one after another`);
          last = go;
          assert.equal(fittedAt(tl, playhead(tl, (shown + go) / 2), i, mp.fittings[i]!.kind), 0, 'it waits at the end of its line first');
          if (e.board === null) continue;
          const there = arrivalAt(tl, playhead(tl, go), e.board);
          assert.equal(there, fix.lying ? 0 : 1, `${name}: the ${mp.fittings[i]!.kind} goes in through a board ${fix.lying ? 'lying where it waits' : 'in place'}`);
          // Into a board on the floor from above (a bolt, a hinge cup) or into its end (a dowel), never from under the floor.
          if (fix.lying) assert.ok(lyingDir(staged[e.board]!, e.dir)[1] < 1e-9, `${name}: a ${mp.fittings[i]!.kind} goes into its board lying from above or its end`);
          if (fix.lying && mp.fittings[i]!.kind !== 'dowel') assert.ok(lyingDir(staged[e.board]!, e.dir)[1] < -.99, `${name}: a ${mp.fittings[i]!.kind} from above`);
        }
      });
    });
    mp.fittings.forEach((f, i) => {
      if (FITTED_FIRST.has(f.kind) || f.kind === 'runner') return;
      assert.ok(tl.itemTime[i], `${name}: the ${f.kind} ${i} is fixed in a joint of its own step`);
    });
  }
});

test('a point of a board lying flat is where that board lies, turned as it is', () => {
  const mp = make(wardrobe), staged = stagingLayout(mp);
  mp.boards.forEach((b, i) => {
    const s = staged[i]!, c: [number, number, number] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    assert.deepEqual(lyingPoint(b, s, c), s.at, `${b.name}: its middle where it waits`);
    const lo = lyingPoint(b, s, [b.x0, b.y0, b.z0]), hi = lyingPoint(b, s, [b.x1, b.y1, b.z1]);
    [0, 1, 2].forEach(a => assert.ok(Math.abs(Math.abs(hi[a]! - lo[a]!) - s.size[a]!) < 1e-6, `${b.name}: lies within its own footprint`));
  });
});

test('a sloped top is screwed straight down into every upright under it, and lies flat levelled while it waits', () => {
  const mp = make(sloped), top = mp.boards.findIndex(b => b.name === 'Top'), b = mp.boards[top]!, staged = stagingLayout(mp)[top]!;
  const uprights = mp.boards.map((u, i) => ({ u, i })).filter(({ u }) => u.stock === 'carcass' && u.x1 - u.x0 < 2 && u.y1 > 100);
  assert.equal(mp.steps.find(s => s.boards.includes(top))!.stage, 'top', 'it goes on in the top step');
  for (const { u, i } of uprights) {
    const screws = mp.fittings.map((f, k) => ({ f, k })).filter(({ f }) => f.boards.includes(top) && f.boards.includes(i));
    assert.equal(screws.length, 3, `${u.name} at ${u.x0}: three screws down into it`);
    for (const { f, k } of screws) {
      const through = mp.holes.find(h => h.of === k && h.board === top)!, pilot = mp.holes.find(h => h.of === k && h.board === i)!;
      assert.ok(f.at[0] > u.x0 && f.at[0] < u.x1, 'in the upright\'s thickness');
      assert.deepEqual([through.axis, through.sign, pilot.axis, pilot.sign], [1, -1, 1, -1], 'straight down');
      assert.ok(through.at[1] > pilot.at[1] && through.at[1] - pilot.at[1] < b.cut.thickness * 2, 'through the top onto the upright');
    }
  }
  assert.deepEqual(lyingDir(staged, [Math.cos(tiltOf(b)), Math.sin(tiltOf(b)), 0]).map(v => Math.round(v * 1e6) / 1e6 + 0), [1, 0, 0], 'levelled');
  assert.ok(Math.abs(staged.size[0] - b.cut.length) < 1e-9 && Math.abs(staged.size[1] - b.cut.thickness) < 1e-9, 'as long as its slope, as thick as it is');
  assert.equal(mp.findings.filter(f => f.board === top).length, 0, 'its drilling checks out');
});

test('a cam joint is a bolt put into the face board before the other board goes on over it, then a cam turned to grip it', () => {
  const mp = make({ ...wardrobe, construction: { joints: 'cam', back: 'nailed' } }), tl = assemblyTimeline(mp);
  const bolts = mp.fittings.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === 'bolt'), cams = mp.fittings.filter(f => f.kind === 'cam');
  assert.ok(bolts.length > 0 && bolts.length === cams.length, 'a bolt for every cam');
  for (const { f, i } of bolts) {
    const [face, edge] = f.boards, cam = mp.fittings.findIndex((c, k) => c.kind === 'cam' && c.boards[0] === face && c.boards[1] === edge && Math.abs(c.at[f.axis]! - f.at[f.axis]!) < 4 && k > i);
    const [, boltIn] = tl.itemTime[i]!, [, camIn] = tl.itemTime[cam]!;
    assert.ok(boltIn < tl.steps[tl.itemStep[i]!]!.place[0], 'the bolt is in before the boards come together');
    assert.ok(camIn > tl.steps[tl.itemStep[cam]!]!.place[1], 'the cam goes in once the board is on');
    assert.equal(arrivalAt(tl, playhead(tl, camIn), edge!), 1);
  }
});
