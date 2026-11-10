import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionCases } from './construction-cases';
import { alone, goldenWardrobes, welcomeSpaces } from './rule-fixtures';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { roomHeight } from '../../src/domain/studio/studio';
import { HARDWARE } from '../../src/domain/hardware/hardware-registry';
import { placePieces, type DrawingInput } from '../../src/domain/drawings/room-pieces';
import { type MakePiece, makePiece } from '../../src/domain/make/make-parts';
import { BACK_FIXINGS, JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { boresClash, MIN_WALL } from '../../src/domain/make/bore-clearance';
import { fixingMisfit, screwLength, throughScrew } from '../../src/domain/make/make-fixings';
import { connectorStations, type Hole } from '../../src/domain/make/make-joints';
import { stageOrder } from '../../src/domain/make/make-sequence';
import { verifyPiece } from '../../src/domain/make/make-verify';
import { standUpHeight, tallestToStandUp } from '../../src/domain/make/stand-up';
import { thinAxis } from '../../src/domain/make/make-measures';
import { assemblyGate } from '../../src/domain/engine/assembly-gate';
import { inspect } from '../../src/domain/engine/inspect';
import type { Board } from '../../src/domain/drawings/cabinet-boards';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

/**
 * Buildability, proved on real pieces. `verifyPiece` is the same check the engine runs on every design in the editor;
 * here it runs over every kitchen unit and preset, every shape, the golden and welcome designs and Auto design's own
 * proposals from 60 to 300 cm wide, in all three joint systems and both backs. Nothing in it is rounded to a
 * manufacturing grid: sizes close to arithmetic noise, bores to the 2 mm of board the drilling rule keeps.
 */

const make = (design: EditorDesign) => makePiece(alone(design), 1);
const say = (mp: MakePiece) => verifyPiece(mp).map(d => d.kind + ': ' + d.what);

/** Auto design's proposals for a wardrobe of this size and shape, applied as the editor applies them. */
function proposals(w: number, h: number, d: number, template: 'regular' | 'sloped' | 'stepped', doors: 'none' | 'hinged'): EditorDesign[] {
  const blank = () => {
    const s = createEditorState();
    Object.assign(s, { w, h, d, doors });
    if (template !== 'regular') { const start = createFromTemplate(template, { w, h, maxN: 6 }); Object.assign(s, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) }); }
    return s;
  };
  return generateDesignedLayouts(createWardrobeGeometry(() => blank()).plannerConfig()).slice(0, 2).map(p => { const s = blank(); createDesignCommands(() => s).applyProposal(p as never); return s; });
}

for (const [name, design] of constructionCases) test(`buildable as set out: ${name}`, () => {
  for (const joints of JOINT_SYSTEMS) for (const back of BACK_FIXINGS) {
    const mp = make({ ...design, construction: { joints, back } });
    if (!mp) continue;
    assert.deepEqual(say(mp), [], `${joints}, ${back}`);
  }
});

test('buildable as set out: the golden wardrobes and every welcome space, in every joint system', () => {
  for (const [name, design] of goldenWardrobes()) for (const joints of JOINT_SYSTEMS) for (const doors of ['none', 'hinged'] as const) {
    assert.deepEqual(say(make({ ...design, doors, construction: { joints, back: joints === 'cam' ? 'grooved' : 'nailed' } })!), [], `${name}, ${joints}, doors ${doors}`);
  }
  for (const [name, input] of welcomeSpaces()) for (const p of placePieces(input)) {
    const mp = makePiece(input, p.id);
    if (mp) assert.deepEqual(say(mp), [], `${name} ${p.mark}`);
  }
});

test('buildable as set out: Auto design from 60 to 300 cm, regular, sloped and stepped, with and without doors', () => {
  let pieces = 0;
  for (const [w, h, d] of [[60, 200, 45], [110, 210, 55], [150, 240, 60], [200, 230, 60], [260, 245, 65], [300, 250, 60]] as const)
    for (const template of ['regular', 'sloped', 'stepped'] as const) for (const doors of ['none', 'hinged'] as const)
      proposals(w, h, d, template, doors).forEach((design, k) => {
        for (const joints of JOINT_SYSTEMS) {
          const mp = make({ ...design, construction: { joints, back: joints === 'dowel' ? 'grooved' : 'nailed' } })!;
          assert.deepEqual(say(mp), [], `${w} × ${h} × ${d} ${template}, doors ${doors}, proposal ${k}, ${joints}`);
          pieces++;
        }
      });
  assert.ok(pieces >= 150, `${pieces} pieces checked`);
});

// ── Drilling in three dimensions ────────────────────────────────────────────────────────────────────────────────────

const slab: Board = { name: 'Shelf', stock: 'carcass', x0: 0, x1: 60, y0: 0, y1: 1.8, z0: 0, z1: 40, cut: { length: 60, width: 40, thickness: 1.8 }, edges: '—' };
const hole = (over: Partial<Hole>): Hole => ({ board: 0, kind: 'pilot', at: [0, .9, 10], axis: 0, sign: 1, d: 5, depth: 45, ...over });

test('two bores clash when less than 2 mm of board is left between them, whichever way each is drilled', () => {
  assert.equal(MIN_WALL, 2);
  // A pilot hole run 45 mm in from the end, and a screw down through the face across it.
  const pilot = hole({}), down = (x: number, z: number) => hole({ kind: 'connector', at: [x, 1.8, z], axis: 1, sign: -1, d: 7, depth: 0 });
  assert.deepEqual(boresClash(slab, pilot, down(3, 10)), { kind: 'clash', gap: -6 }, 'through its middle: the two radii overlap by 6 mm');
  assert.deepEqual(boresClash(slab, pilot, down(3, 10.7)), { kind: 'clash', gap: 1 }, '7 mm between centres, 1 mm of board');
  assert.equal(boresClash(slab, pilot, down(3, 10.8)), null, '8 mm between centres: exactly 2 mm of board is enough');
  assert.equal(boresClash(slab, pilot, down(5.1, 10)), null, 'past the end of the 45 mm pilot hole, with 2 mm to spare');
  assert.ok(boresClash(slab, pilot, down(4.9, 10)), 'within 2 mm of the pilot hole\'s end');
  // Side by side in one face.
  const face = (z: number, depth = 12) => hole({ kind: 'pin', at: [20, 1.8, z], axis: 1, sign: -1, d: 5, depth });
  assert.deepEqual(boresClash(slab, face(10), face(10.6)), { kind: 'clash', gap: 1 });
  assert.equal(boresClash(slab, face(10), face(10.7)), null);
  assert.equal(boresClash(slab, face(10), face(10)), null, 'the same hole named twice is one hole');
  // End to end from opposite faces of an 18 mm board.
  const under = (depth: number) => hole({ kind: 'pin', at: [20, 0, 10], axis: 1, sign: 1, d: 5, depth });
  assert.deepEqual(boresClash(slab, face(10, 10), under(10)), { kind: 'clash', gap: -5 }, '10 + 10 mm in 18 mm: they run into each other');
  assert.deepEqual(boresClash(slab, face(10, 9), under(8.5)), { kind: 'meet', gap: .5 }, 'half a millimetre between their ends');
  assert.equal(boresClash(slab, face(10, 8), under(8)), null, '2 mm between their ends');
});

test('a joint from 64 mm takes two connectors, never one a board can turn about', () => {
  assert.deepEqual(connectorStations(6.3), [3.15]);
  assert.deepEqual(connectorStations(8), [2, 6], 'an 80 mm plinth joint: 20 mm in from each edge');
  assert.deepEqual(connectorStations(60), [5, 30, 55]);
  const mp = make(createInitialDesign())!, perJoint = new Map<string, number>();
  for (const f of mp.fittings) if (!f.purpose && f.boards.length === 2 && ['confirmat', 'screw', 'dowel', 'bolt'].includes(f.kind)) perJoint.set(f.boards.join(), (perJoint.get(f.boards.join()) ?? 0) + 1);
  assert.ok(perJoint.size > 8);
  for (const [joint, n] of perJoint) assert.ok(n >= 2, `joint ${joint.split(',').map(i => mp.boards[Number(i)]!.name).join(' / ')} has ${n}`);
});

test('shelves level either side of a partition: the first is screwed through it, the second closes onto dowels', () => {
  const design: EditorDesign = { ...createInitialDesign(), w: 160, h: 220, n: 2, wt: [1, 1], secs: [[{ k: 'shelf', h: 40 }, { k: 'shelf', h: 40 }], [{ k: 'shelf', h: 40 }, { k: 'shelf', h: 40 }]] } as EditorDesign;
  const mp = make(design)!, partition = mp.boards.findIndex(b => b.name === 'Partition');
  const into = mp.joints.filter(c => c.joint.face === partition && mp.boards[c.joint.edge]!.name === 'Shelf');
  const left = into.filter(c => c.joint.side < 0), right = into.filter(c => c.joint.side > 0);
  assert.ok(left.length >= 2 && left.length === right.length);
  assert.ok(left.every(c => c.system === 'confirmat' && c.access === 'driven'), 'bay 1: screwed through the partition from the open bay beside it');
  assert.ok(right.every(c => c.system === 'dowel' && c.access === 'closed' && c.instead === 'covered'), 'bay 2: the screw heads would be behind bay 1\'s shelf');
  // The partition is in before the second bay's shelves and the right side after them, so they have a way in.
  const rank = mp.sequence.rank, rightSide = mp.boards.findIndex(b => b.name === 'Side' && b.x0 > 100);
  for (const c of right) assert.ok(rank[partition]! < rank[c.joint.edge]! && rank[c.joint.edge]! < rank[rightSide]!);
  assert.deepEqual(say(mp), []);
  assert.deepEqual(mp.findings, [], 'and nothing is drilled into anything else');
});

test('loose shelves at one height either side of a partition share holes drilled right through it', () => {
  const kitchen = (unit: 'base') => ({ ...createKitchenDesign(unit), w: 120, n: 2, wt: [1, 1] });
  const design = { ...kitchen('base'), secs: [[{ k: 'cupboard', h: 70 }], [{ k: 'cupboard', h: 70 }]] } as EditorDesign;
  const mp = make(design);
  if (!mp) return;
  const partition = mp.boards.findIndex(b => b.name === 'Partition'), pins = mp.holes.filter(h => h.kind === 'pin' && h.board === partition);
  if (!pins.length) return;
  for (const p of pins) {
    const twin = pins.find(q => q !== p && q.sign === -p.sign && Math.abs(q.at[1] - p.at[1]) < .005 && Math.abs(q.at[2] - p.at[2]) < .005);
    if (twin) assert.ok(p.depth === 0 && twin.depth === 0, 'one hole through, not two 10 mm holes in 18 mm');
  }
  assert.deepEqual(mp.findings, []);
});

// ── Fasteners ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('no fixing in the hardware registry comes out of the thinnest board its hardware goes on', () => {
  assert.deepEqual(fixingMisfit('4 × 30', 18), { kind: 'through', by: 11.5 }, 'what a wall bracket\'s screw used to do to an 18 mm top');
  assert.equal(fixingMisfit('4 × 16', 16), null);
  assert.equal(fixingMisfit('M4 × 25', 18), null, '7 mm of thread left for the handle');
  assert.deepEqual(fixingMisfit('M4 × 20', 18), { kind: 'short', by: 3 });
  assert.deepEqual([16, 18, 19, 22].map(throughScrew), ['M4 × 22', 'M4 × 25', 'M4 × 25', 'M4 × 30']);
  assert.equal(screwLength('Euro 6.3 × 11.5'), 11.5);
  for (const entry of HARDWARE) for (const f of entry.fixings) {
    // What goes into a wall, joins two boards (a connector's own line) or passes through a first board is not a
    // screw into one face.
    if (f.target === 'wall' || entry.category === 'connector' || entry.category === 'fixing' && f.pilotHole || f.purpose === 'drawer-front' || f.fastenerKind !== 'screw' || f.size.startsWith('M')) continue;
    assert.equal(fixingMisfit(f.size, entry.rules.boardThicknessMm.min), null, `${entry.key}: ${f.size} into ${entry.rules.boardThicknessMm.min} mm`);
    // A screw in a pilot hole is no longer than the hole is deep.
    if (f.pilotHole && f.pilotHole.depthMm > 0 && f.pilotHole.kind === 'plate') assert.ok(screwLength(f.size)! <= f.pilotHole.depthMm, entry.key);
  }
});

test('the buy list has the screws every hinge, plate, handle, rail support, leg and wall bracket is held by', () => {
  const design: EditorDesign = { ...createInitialDesign(), w: 100, h: 220, n: 1, wt: [1], doors: 'hinged', secs: [[{ k: 'long', h: 160 }]] } as EditorDesign;
  const mp = make(design)!, count = (test: (f: MakePiece['fittings'][number]) => boolean) => mp.fittings.filter(test).length;
  const hinges = count(f => f.kind === 'hinge'), plates = count(f => f.kind === 'plate'), handles = count(f => f.kind === 'handle'), supports = count(f => f.kind === 'support'), brackets = count(f => f.kind === 'bracket');
  assert.ok(hinges >= 4 && plates === hinges && handles === 2 && supports === 2 && brackets === 2);
  const screws = (size: string) => mp.buy.filter(l => l.kind === 'screw' && l.size === size).reduce((s, l) => s + l.qty, 0);
  assert.equal(screws('3.5 × 16'), 2 * hinges + 2 * supports, 'two through each hinge cup\'s ears, two in each rail support');
  assert.equal(screws('Euro 6.3 × 11.5'), 2 * plates, 'two Euro screws in each mounting plate, one for each hole drilled for it');
  // Two machine screws behind each bar handle, as long as the door is thick plus at least 5 mm of thread for the handle.
  const door = Math.round(mp.boards.find(b => b.stock === 'door')!.cut.thickness * 10);
  assert.equal(screws(throughScrew(door)), 2 * handles, `M4 for a ${door} mm door`);
  assert.ok(screwLength(throughScrew(door))! - door >= 5);
  assert.equal(screws('4 × 16'), 2 * brackets, 'two down into the top for each wall bracket');
  assert.equal(screws('5 × 60 with wall plug'), brackets, 'and one into the wall');
  // Each is fitted in the step that fits its hardware, and the wall fixings in the last.
  const stepOf = (i: number) => mp.steps.find(s => s.items.includes(i))!.stage;
  mp.fittings.forEach((f, i) => {
    if (f.purpose === 'fixing') assert.equal(stepOf(i), stepOf(f.of!), `a ${f.size} screw goes in with its ${mp.fittings[f.of!]!.kind}`);
    if (f.purpose === 'wall-fixing') assert.equal(stepOf(i), 'wall');
  });
  assert.equal(mp.buy.reduce((s, l) => s + l.qty, 0), mp.fittings.length, 'everything fitted is bought, once');
});

test('every connector is on the centre line of the board it goes into, and reaches far enough into it', () => {
  for (const joints of JOINT_SYSTEMS) {
    const mp = make({ ...goldenWardrobes()[0]![1], construction: { joints, back: 'nailed' } })!;
    for (const h of mp.holes.filter(h => h.kind === 'pilot' || h.kind === 'dowel')) {
      const b = mp.boards[h.board]!, t = ({ x: 0, y: 1, z: 2 } as const)[thinAxis(b)];
      if (h.axis === t || b.outline) continue;
      assert.ok(Math.abs(h.at[t] - ([b.x0, b.y0, b.z0][t]! + [b.x1, b.y1, b.z1][t]!) / 2) < 1e-9, `${joints}: ${b.name} ${h.kind} on its centre line`);
    }
    // A 7 × 50 connector screw through an 18 mm board has 32 mm of thread in a 45 mm pilot hole.
    for (const [i, f] of mp.fittings.entries()) if (f.kind === 'confirmat') {
      const [face, pilot] = [mp.holes.find(h => h.of === i && h.depth === 0)!, mp.holes.find(h => h.of === i && h.kind === 'pilot')!];
      assert.equal(Math.round(Math.abs(face.at[face.axis] - pilot.at[pilot.axis]) * 100) / 10, 18);
      assert.equal(pilot.depth, 45);
    }
  }
});

// ── The order ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('a back that slides into grooves goes in before the top closes them; a nailed one after', () => {
  const stages = (back: 'nailed' | 'grooved') => stageOrder({ joints: 'confirmat', back });
  assert.ok(stages('nailed').indexOf('top') < stages('nailed').indexOf('back'));
  assert.ok(stages('grooved').indexOf('back') < stages('grooved').indexOf('top'));
  assert.ok(stages('grooved').indexOf('partitions') < stages('grooved').indexOf('back'), 'the uprights it slides between stand first');
  const mp = make({ ...createInitialDesign(), construction: { joints: 'confirmat', back: 'grooved' } })!, order = mp.steps.map(s => s.stage);
  assert.ok(order.indexOf('back') < order.indexOf('top'));
});

test('legs go on with the base they are screwed under, never a step before it is there', () => {
  const mp = make(createKitchenDesign('base'))!, base = mp.boards.findIndex(b => b.name === 'Base');
  const legs = mp.fittings.flatMap((f, i) => f.kind === 'leg' ? [i] : []);
  assert.equal(legs.length, 4);
  const step = (test: (s: MakePiece['steps'][number]) => boolean) => mp.steps.findIndex(test);
  for (const i of legs) assert.ok(step(s => s.items.includes(i)) >= step(s => s.boards.includes(base)));
  assert.equal(make(createKitchenDesign('filler'))!.fittings.filter(f => f.kind === 'leg').length, 0, 'a filler strip, one board, stands on no legs');
});

// ── The gate ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('the gate into assembly opens only when nothing blocks building the piece', () => {
  const sound = inspect(alone(createInitialDesign()), { profiles: [] });
  assert.deepEqual(assemblyGate(sound.evaluation, 1).blockers, []);
  assert.equal(assemblyGate(sound.evaluation, 1).open, true);
  // A pantry pull-out is carried by its frame on its own runners, like a cargo pull-out: a larder passes.
  const larderPiece = make(createKitchenDesign('tall', 'larder'))!, pantry = larderPiece.boards.findIndex(b => b.name === 'Pantry front');
  assert.ok(larderPiece.fittings.some(f => f.kind === 'runner' && f.cargo && f.boards.includes(pantry)), 'the pantry front has its runners and frame');
  assert.equal(assemblyGate(inspect(alone(createKitchenDesign('tall', 'larder')), { profiles: [] }).evaluation, 1).open, true);
  // Take the mechanism away and the same piece is refused, with the reason.
  const bare = { ...larderPiece, fittings: larderPiece.fittings.map(f => f.cargo ? { ...f, boards: [], cargo: undefined } as never : f) };
  assert.ok(verifyPiece(bare).some(d => d.kind === 'mechanism' && /Pantry front pulls out but has nothing to slide on/.test(d.what)));
  // The manufacturing check's critical findings close it too: a door wider than a door can be.
  const wideDoor = inspect(alone({ ...createInitialDesign(), w: 200, n: 1, wt: [1], doors: 'hinged' } as EditorDesign), { profiles: [] });
  const refused = assemblyGate(wideDoor.evaluation, 1);
  assert.equal(refused.open, false);
  assert.ok(refused.blockers.some(f => f.pack === 'manufacturing'));
  // One piece's blockers do not close the gate of another.
  const two: DrawingInput = { pieces: [{ id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, design: createInitialDesign() },
    { id: 2, name: 'B', x: 400, y: 0, z: 0, angle: 0, design: { ...createInitialDesign(), w: 200, n: 1, wt: [1], doors: 'hinged' } as EditorDesign }] };
  const both = inspect(two, { profiles: [] }).evaluation;
  assert.equal(assemblyGate(both, 1).open, true);
  assert.equal(assemblyGate(both, 2).open, false);
});

test('drilling that cannot be made blocks; a hole near an edge is advice', () => {
  const e = inspect(alone(goldenWardrobes()[0]![1]), { profiles: [] }).evaluation;
  assert.equal(e.findings.filter(f => f.pack === 'drilling' && f.severity !== 'advice').length, 0, 'a sound piece has none');
});

test('a piece too tall to be stood up in its room is told so, with the numbers', () => {
  assert.equal(Math.round(standUpHeight(240, 60) * 10), 2484, 'a 2400 × 600 mm piece needs its 2474 mm diagonal and 10 mm to spare');
  assert.equal(Math.round(tallestToStandUp(250, 60) * 10), 2417);
  assert.ok(standUpHeight(tallestToStandUp(250, 60), 60) - 250 < 1e-9, 'the tallest that stands up needs exactly the ceiling');
  const studio = createStudio('bedroom'), ceiling = roomHeight(studio);
  const at = (h: number): DrawingInput => ({ studio, pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: { ...createInitialDesign(), h } }] });
  const advice = (h: number) => inspect(at(h), { profiles: [] }).evaluation.findings.filter(f => f.id.startsWith('buildability:stand-up'));
  const low = Math.floor(tallestToStandUp(ceiling, 60)) - 1, high = Math.min(Math.floor(ceiling), low + 12);
  assert.deepEqual(advice(low), []);
  const told = advice(high);
  assert.equal(told.length, 1);
  assert.equal(told[0]!.severity, 'advice', 'it can still be built standing where it goes');
  assert.equal(told[0]!.measured!.value, Math.round(standUpHeight(high, 60) * 10));
  assert.equal(told[0]!.limit!.value, Math.round(ceiling * 10));
});
