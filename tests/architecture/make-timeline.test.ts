import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { makePiece } from '../../src/domain/make/make-parts';
import { arrivalAt, assemblyTimeline, drillAt, drilled, fittedAt, playhead, stepStart } from '../../src/domain/make/make-timeline';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// The assembly film: a pure function of time, so playing, scrubbing and replaying all show the same thing.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const designs = { wardrobe, plain: createInitialDesign(), base: createKitchenDesign('base'), drawers: createKitchenDesign('base', 'drawers') };
const make = (design: EditorDesign) => makePiece({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] }, 1)!;
const times = (duration: number) => Array.from({ length: 401 }, (_, i) => duration * i / 400);

test('every hole is drilled for a fitting', () => {
  for (const joints of JOINT_SYSTEMS) for (const [name, design] of Object.entries(designs)) {
    const mp = make({ ...design, construction: { joints, back: 'nailed' } });
    mp.holes.forEach(h => assert.ok(h.of !== undefined && mp.fittings[h.of], `${name} ${joints}: a ${h.kind} hole names its fitting`));
    for (const h of mp.holes.filter(x => x.kind === 'cup')) assert.equal(mp.fittings[h.of!]!.kind, 'hinge');
    for (const h of mp.holes.filter(x => x.kind === 'connector')) assert.equal(mp.fittings[h.of!]!.kind, 'confirmat');
    for (const h of mp.holes.filter(x => x.kind === 'runner')) assert.equal(mp.fittings[h.of!]!.kind, 'runner');
  }
});

test('the steps follow each other without gaps, each drilling, then bringing boards in, then fixing them', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), tl = assemblyTimeline(mp);
    assert.equal(tl.steps.length, mp.steps.length);
    tl.steps.forEach((s, k) => {
      assert.equal(s.start, k ? tl.steps[k - 1]!.end : 0, `${name}: step ${k + 1} starts where the last ended`);
      assert.ok(s.start <= s.drill[0] && s.drill[1] <= s.place[0] && s.place[1] <= s.fix[0] && s.fix[1] < s.end, `${name}: phases in order`);
      assert.equal(playhead(tl, stepStart(tl, k)).step, k);
    });
    assert.equal(tl.duration, tl.steps.at(-1)!.end);
    assert.equal(playhead(tl, -5).step, 0, 'before the start is the start');
    assert.equal(playhead(tl, tl.duration + 5).step, tl.steps.length - 1, 'after the end is the end');
  }
});

test('at any moment a board is hidden before its step, coming in during it and in place after; the end is the piece built', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), tl = assemblyTimeline(mp), end = playhead(tl, tl.duration);
    mp.boards.forEach((_, i) => {
      assert.equal(arrivalAt(tl, end, i), 1, `${name}: board ${i} in place at the end`);
      let last = -1;
      for (const t of times(tl.duration)) {
        const a = arrivalAt(tl, playhead(tl, t), i) ?? -1;
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
