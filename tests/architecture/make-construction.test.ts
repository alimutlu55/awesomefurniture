import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { makePiece, type MakePiece } from '../../src/domain/make/make-parts';
import { connectorStations, findJoints, hi, isTilted, lo } from '../../src/domain/make/make-joints';
import { drillingChecks, flatHoles } from '../../src/domain/make/make-assembly';
import { constructionOf, JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { thinAxis } from '../../src/domain/make/make-measures';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// A two-bay wardrobe with drawers and shelves in one bay, a long hang in the other, and hinged doors; and kitchen units.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }, { k: 'shelf', h: 30 }], [{ k: 'long', h: 160 }]] };
const designs: Record<string, EditorDesign> = {
  wardrobe, plain: createInitialDesign(), base: createKitchenDesign('base'), upper: createKitchenDesign('upper'), tall: createKitchenDesign('tall'),
  drawers: createKitchenDesign('base', 'drawers'),
  sloped: { ...wardrobe, shape: { template: 'sloped', top: [{ x: 0, y: 220 }, { x: 100, y: 160 }] } as EditorDesign['shape'] },
};
const input = (design: EditorDesign, y = 0) => ({ pieces: [{ id: 7, name: 'W', x: 0, y, z: 0, angle: 0, design }] });
const make = (design: EditorDesign, y = 0) => makePiece(input(design, y), 7)!;
const qty = (mp: MakePiece, kind: string) => mp.buy.filter(b => b.kind === kind).reduce((s, b) => s + b.qty, 0);
/** The drawing set's hardware list for the same piece, by the words its lines start with. */
const listed = (design: EditorDesign, item: RegExp, y = 0) => hardwareList(placePieces(input(design, y))).flatMap(t => t.rows)
  .filter(r => item.test(r[0]!)).reduce((s, r) => s + Number(r[2]), 0);

test('every carcass board is joined to another; sides meet the top and the base edge to face', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), joints = findJoints(mp.boards);
    mp.boards.forEach((b, i) => {
      if (b.stock !== 'carcass' || b.note === 'adjustable' || isTilted(b)) return;
      assert.ok(joints.some(j => j.face === i || j.edge === i), `${name}: ${b.name} is joined`);
    });
    const side = mp.boards.findIndex(b => b.name === 'Side'), top = mp.boards.findIndex(b => b.name === 'Top');
    if (side >= 0 && top >= 0 && !isTilted(mp.boards[top]!)) assert.ok(joints.some(j => (j.face === side && j.edge === top) || (j.face === top && j.edge === side)), name);
  }
});

test('connectors stand 5 cm in from each end and no more than 30 cm apart', () => {
  for (const length of [10, 30, 56, 100, 213]) {
    const s = connectorStations(length);
    if (length >= 12) { assert.equal(s[0], 5); assert.ok(Math.abs(s.at(-1)! - (length - 5)) < 1e-9); }
    s.slice(1).forEach((x, i) => assert.ok(x - s[i]! <= 30 + 1e-9));
  }
});

test('hinges, runners, rails, shelf pins and handles are counted as the drawing set counts them', () => {
  for (const [name, design] of Object.entries(designs)) {
    const y = name === 'upper' ? 142 : 0, mp = make(design, y);
    // Under a slope a door's hinges go only as high as the upright it hangs from.
    if (name === 'sloped') assert.ok(qty(mp, 'hinge') <= listed(design, /hinge/i, y), `${name}: hinges`);
    else assert.equal(qty(mp, 'hinge'), listed(design, /hinge/i, y), `${name}: hinges`);
    assert.equal(qty(mp, 'plate'), qty(mp, 'hinge'), `${name}: a plate for every hinge`);
    assert.equal(qty(mp, 'runner'), listed(design, /^Drawer runners/, y), `${name}: runner pairs`);
    assert.equal(qty(mp, 'rail'), listed(design, /^Hanging rail/, y), `${name}: rails`);
    assert.equal(qty(mp, 'pin'), listed(design, /^Shelf support/, y), `${name}: shelf pins`);
    assert.equal(qty(mp, 'handle'), listed(design, /^Handle/, y), `${name}: handles`);
    assert.equal(qty(mp, 'leg'), listed(design, /^Adjustable leg/, y), `${name}: legs`);
    assert.equal(qty(mp, 'hanger'), listed(design, /^Cabinet hanger/, y), `${name}: hangers`);
    assert.equal(qty(mp, 'bracket'), listed(design, /^Wall fixing bracket/, y), `${name}: wall brackets`);
  }
});

test('nothing drilled runs into anything else, for every joint system', () => {
  for (const joints of JOINT_SYSTEMS) for (const [name, design] of Object.entries(designs)) {
    const mp = make({ ...design, construction: { joints, back: 'nailed' } });
    assert.deepEqual(drillingChecks(mp.boards, mp.holes), [], `${name} with ${joints}`);
    assert.deepEqual(mp.findings, []);
  }
});

test('the checks find holes running into each other, near an edge, or through the far face', () => {
  const board = { name: 'Shelf', stock: 'carcass' as const, x0: 0, x1: 50, y0: 0, y1: 1.8, z0: 0, z1: 40, cut: { length: 50, width: 40, thickness: 1.8 }, edges: 'L1' };
  const hole = (x: number, z: number, d: number, depth: number) => ({ board: 0, kind: 'dowel' as const, at: [x, 1.8, z] as [number, number, number], axis: 1 as const, sign: -1 as const, d, depth });
  const kinds = (holes: ReturnType<typeof hole>[]) => drillingChecks([board], holes).map(f => f.kind);
  assert.deepEqual(kinds([hole(10, 10, 8, 12), hole(10.5, 10, 8, 12)]), ['clash']);
  assert.deepEqual(kinds([hole(.3, 10, 8, 12)]), ['edge']);
  assert.deepEqual(kinds([hole(10, 10, 8, 17)]), ['breakout']);
  assert.deepEqual(kinds([hole(10, 10, 8, 12), hole(20, 10, 8, 12)]), []);
});

test('drawer boxes sit between the uprights, clear for their runners, behind their fronts and inside the carcass', () => {
  for (const name of ['wardrobe', 'drawers']) {
    const mp = make(designs[name]!), sides = mp.boards.filter(b => b.name === 'Box side');
    assert.ok(sides.length >= 2 && sides.length % 2 === 0, name);
    const carcass = mp.boards.filter(b => b.stock === 'carcass' && b.note !== 'drawer box' && b.note !== 'adjustable');
    for (const box of mp.boards.filter(b => b.note === 'drawer box')) for (const c of carcass) {
      const overlap = [0, 1, 2].every(a => Math.min(hi(box)[a]!, hi(c)[a]!) - Math.max(lo(box)[a]!, lo(c)[a]!) > .01);
      assert.ok(!overlap, `${name}: ${box.name} clear of ${c.name}`);
    }
    for (const s of sides) {
      const gap = Math.min(...carcass.filter(c => thinAxis(c) === 'x' && c.y0 <= s.y0 && c.y1 >= s.y1)
        .map(c => Math.min(Math.abs(s.x0 - c.x1), Math.abs(c.x0 - s.x1))));
      assert.ok(Math.abs(gap - 1.25) < .01, `${name}: 12.5 mm for the runner (${gap})`);
    }
  }
});

test('handed boards are separate parts; boards drilled alike once turned are one part', () => {
  const mp = make(wardrobe);
  assert.equal(mp.parts.filter(p => p.name === 'Side').length, 2, 'a left and a right side');
  assert.equal(mp.parts.filter(p => p.name === 'Box side').length, 1, 'drawer sides are one part');
  for (const p of mp.parts) assert.deepEqual(p.ids.map(i => mp.boards[i]), p.boards);
  assert.equal(mp.parts.reduce((s, p) => s + p.ids.length, 0), mp.boards.length);
});

test('assembly steps take every board once, the carcass before the inside and the fronts last', () => {
  for (const [name, design] of Object.entries(designs)) {
    const mp = make(design), seen = mp.steps.flatMap(s => s.boards).sort((a, b) => a - b);
    assert.deepEqual(seen, mp.boards.map((_, i) => i), name);
    assert.equal(mp.steps.reduce((s, st) => s + st.fittings.reduce((t, f) => t + f.qty, 0), 0), mp.fittings.length, `${name}: every fitting in a step`);
    const at = (pred: (b: MakePiece['boards'][number]) => boolean) => mp.steps.findIndex(s => s.boards.some(i => pred(mp.boards[i]!)));
    assert.ok(at(b => b.name === 'Side') < at(b => b.name === 'Top'), `${name}: sides before the top`);
    const fronts = at(b => b.stock === 'door' || b.stock === 'front');
    if (fronts >= 0) assert.ok(mp.steps.slice(fronts + 1).every(s => !s.boards.length), `${name}: fronts last`);
  }
});

test('the joint system and back fixing change what is drilled, never a board', () => {
  const by = (joints: typeof JOINT_SYSTEMS[number], back: 'nailed' | 'grooved') => make({ ...wardrobe, construction: { joints, back } });
  const confirmat = by('confirmat', 'nailed'), cam = by('cam', 'nailed'), dowel = by('dowel', 'grooved');
  assert.deepEqual(cam.boards, confirmat.boards);
  assert.ok(qty(confirmat, 'confirmat') > 0 && qty(cam, 'confirmat') === 0);
  assert.equal(qty(cam, 'cam'), qty(confirmat, 'confirmat'));
  assert.ok(cam.holes.some(h => h.kind === 'cam' && h.d === 15));
  assert.equal(qty(dowel, 'dowel'), qty(confirmat, 'confirmat'));
  assert.equal(qty(dowel, 'nail'), 0);
  assert.ok(dowel.grooves.length >= 4, 'the back slides into the boards around it');
  assert.deepEqual(constructionOf({}), { joints: 'confirmat', back: 'nailed' });
  assert.deepEqual(constructionOf({ construction: { joints: 'nope' as never, back: 'grooved' } }), { joints: 'confirmat', back: 'grooved' });
});

test('holes are marked on their board lying flat, inside it', () => {
  const mp = make(wardrobe);
  mp.boards.forEach((b, i) => {
    for (const h of flatHoles(b, mp.holes.filter(x => x.board === i))) {
      assert.ok(h.u >= -.1 && h.u <= b.cut.length * 10 + .1 && h.v >= -.1 && h.v <= b.cut.width * 10 + .1, `${b.name} ${h.kind} at ${h.u}, ${h.v}`);
    }
  });
});
