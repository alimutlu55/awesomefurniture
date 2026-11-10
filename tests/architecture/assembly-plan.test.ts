import test from 'node:test';
import assert from 'node:assert/strict';
import { constructionCases } from './construction-cases';
import { alone, goldenWardrobes, welcomeSpaces } from './rule-fixtures';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { assemblyStageSpec, hardware } from '../../src/domain/hardware/hardware-registry';
import { assemblyPlan } from '../../src/domain/make/assembly-plan';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';
import { type MakePiece, makePiece } from '../../src/domain/make/make-parts';
import { standUpHeight } from '../../src/domain/make/stand-up';
import { fitMinutes } from '../../src/domain/engine/passport';
import { checkLine, duration, fixName, fixParts, fixSetOut, stepLines } from '../../src/presentation/make/assembly-plan-text';
import { makePdf } from '../../src/presentation/make/make-export';
import { cutLayout } from '../../src/domain/make/make-cut-layout';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

/**
 * The assembly plan is worked out from the piece, never written for one: these tests hold it to the piece it is for,
 * over every kind of piece the app builds. What it counts closes on what Make sets out; what it measures is where the
 * holes are.
 */

const make = (design: EditorDesign) => makePiece(alone(design), 1)!;
// A two-bay wardrobe with level shelves either side of its partition, a hanging rail and hinged doors.
const wardrobe: EditorDesign = { ...createInitialDesign(), w: 160, h: 220, d: 60, n: 2, wt: [1, 1], doors: 'hinged',
  secs: [[{ k: 'shelf', h: 40 }, { k: 'shelf', h: 40 }], [{ k: 'shelf', h: 40 }, { k: 'long', h: 150 }]] } as EditorDesign;

/** The closures every plan must hold on its piece. */
function closes(mp: MakePiece, name: string) {
  const plan = assemblyPlan(mp);
  assert.equal(plan.steps.length, mp.steps.length, name + ': a plan step for every step');
  // Every board goes in once, in the step and the order the build sequence gives it.
  assert.deepEqual(plan.steps.flatMap(s => s.places.map(p => p.board)), mp.steps.flatMap(s => s.boards), name + ': every board placed once, in build order');
  // Every fitting is in exactly one fix, or is a screw listed with the hardware it holds.
  const fixed = plan.steps.flatMap(s => s.fixes.flatMap(f => f.items)), held = plan.steps.flatMap(s => s.fixes).reduce((n, f) => n + f.with.reduce((a, w) => a + w.qty, 0), 0);
  assert.equal(new Set(fixed).size, fixed.length, name + ': no fitting fixed twice');
  assert.equal(fixed.length + held, mp.fittings.length, name + ': fixes and the screws that hold them add up to everything fitted');
  plan.steps.forEach((s, k) => {
    assert.deepEqual([...s.fixes.flatMap(f => f.items)].sort((a, b) => a - b), mp.steps[k]!.items.filter(i => !['fixing', 'wall-fixing'].includes(mp.fittings[i]!.purpose ?? '')).sort((a, b) => a - b));
    assert.equal(s.parts.reduce((n, p) => n + p.qty, 0), mp.steps[k]!.boards.length, name + ': the parts of a step are its boards');
    for (const f of s.fixes) {
      assert.ok(f.title.length > 0, `${name}: the ${f.kind} says what is done`);
      assert.ok(f.parts.every(n => mp.parts.some(p => p.n === n)), `${name}: a ${f.kind} names real parts`);
      // What is measured is where the fittings are: each set-out figure is inside the part it is measured on.
      if (f.at) {
        const part = mp.parts.find(p => p.n === f.at!.on)!, longest = Math.max(part.cut.length, part.cut.width) * 10;
        for (const v of f.at.mm) assert.ok(v >= -.05 && v <= longest + .05, `${name}: ${f.kind} at ${v} mm on part ${part.n} (${longest} mm)`);
      }
    }
    assert.ok(s.minutes >= 1 && (s.people === 1 || s.people === 2));
    for (const line of stepLines(s)) assert.ok(line.text.length > 0 && !/undefined|NaN/.test(line.text), `${name}: ${line.text}`);
  });
  assert.equal(plan.minutes, plan.steps.reduce((n, s) => n + s.minutes, 0));
  assert.ok(plan.tools.length >= 2 && plan.method.text.length > 0);
}

for (const [name, design] of constructionCases) test(`the plan closes on its piece: ${name}`, () => {
  for (const joints of JOINT_SYSTEMS) { const mp = makePiece(alone({ ...design, construction: { joints, back: joints === 'cam' ? 'grooved' : 'nailed' } }), 1); if (mp) closes(mp, `${name}, ${joints}`); }
});

test('the plan closes on the golden wardrobes and every welcome space', () => {
  for (const [name, design] of goldenWardrobes()) closes(make({ ...design, doors: 'hinged' }), name);
  for (const [name, input] of welcomeSpaces()) for (const p of placePieces(input)) { const mp = makePiece(input, p.id); if (mp) closes(mp, name + ' ' + p.mark); }
});

test('each joint is written with the parts it joins and where to put the tape, as the holes are drilled', () => {
  const mp = make(wardrobe), plan = assemblyPlan(mp), partOf = (name: string, pick = 0) => mp.parts.filter(p => p.name === name)[pick]!.n;
  const side = partOf('Side'), base = partOf('Base'), carcass = plan.steps.find(s => s.stage === 'carcass')!;
  assert.deepEqual(carcass.places.map(p => p.part), [side, base], 'the left side stands first, then the base goes against it');
  assert.match(carcass.places[0]!.text, /^Stand part \d+ Side: at the left end, banded edge to the front\.$/);
  assert.match(carcass.places[1]!.text, new RegExp(`^Set part ${base} Base against part ${side}: its top face 98 mm above the floor, banded edge to the front\\.$`));
  // Three 7 × 50 connector screws through the side into the base's end: 50 mm in from the back and front, one between;
  // on the line of the middle of the base's thickness, 89 mm above the floor (80 mm plinth + 9 mm).
  const joint = carcass.fixes.find(f => f.kind === 'confirmat' && f.parts[0] === side && f.parts[1] === base)!;
  assert.equal(fixName(joint), '3 × Connector screw 7 × 50 mm');
  assert.equal(fixParts(joint), `through part ${side} into part ${base}`);
  assert.equal(fixSetOut(joint), `50, 297.5, 545 mm from the back edge of part ${side}, on a line 89 mm from its bottom edge`);
  // And that is where the holes are.
  const sideBoard = mp.parts.find(p => p.n === side)!.ids[0]!, drilled = mp.holes.filter(h => h.board === sideBoard && h.kind === 'connector' && Math.abs(h.at[1] - 8.9) < 1e-9);
  assert.deepEqual(drilled.map(h => Math.round(h.at[2] * 100) / 10).sort((a, b) => a - b), [50, 297.5, 545]);
  assert.equal(joint.after, mp.parts.find(p => p.n === base)!.ids[0], 'it is made as soon as the base is in');
  // Wording is the hardware registry's, not this plan's.
  assert.equal(joint.title, hardware('confirmat')!.assembly.instructions.title);
  assert.equal(carcass.title, assemblyStageSpec('carcass')!.title);
});

test('a joint made with another connector than the piece\'s says why, and the screws that hold hardware are listed with it', () => {
  const mp = make(wardrobe), plan = assemblyPlan(mp), all = plan.steps.flatMap(s => s.fixes);
  const dowelled = all.filter(f => f.kind === 'dowel');
  assert.ok(dowelled.length > 0 && dowelled.every(f => /a screw/.test(f.note ?? '')), 'dowels in a screwed piece say what a screw could not do');
  const hinges = all.filter(f => f.kind === 'hinge'), plates = all.filter(f => f.kind === 'plate');
  assert.ok(hinges.length > 0 && hinges.every(f => f.with.length === 1 && f.with[0]!.size === '3.5 × 16' && f.with[0]!.qty === 2 * f.qty));
  assert.ok(plates.every(f => f.with[0]!.size === 'Euro 6.3 × 11.5' && f.with[0]!.qty === 2 * f.qty && f.at!.line!.from === 'front edge' && f.at!.line!.mm === 37), 'plates on the 37 mm line');
  assert.ok(!all.some(f => f.kind === 'screw' && f.items.some(i => mp.fittings[i]!.purpose === 'fixing')), 'never as a job of their own');
});

test('what to check comes with the number to read off the tape', () => {
  const mp = make(wardrobe), plan = assemblyPlan(mp), check = (stage: string) => plan.steps.find(s => s.stage === stage)!.checks;
  const square = check('back').find(c => /diagonals/.test(c.text))!;
  assert.equal(square.value, Math.round(Math.hypot(1600, 2200) * 10) / 10, 'corner to corner of a 1600 × 2200 mm carcass');
  assert.equal(square.tolerance, 1);
  assert.match(checkLine(square), /: 2720\.3 mm, within 1 mm\.$/);
  assert.equal(check('plinth')[0]!.value, Math.round(Math.hypot(1564, 540) * 10) / 10, 'the plinth frame between the sides, 20 mm in at the back and 40 mm at the front');
  assert.match(check('partitions')[0]!.text, /left to right: 773, 773 mm/);
  assert.ok(check('inside').some(c => /4 mm shorter/.test(c.text) && c.value === 769), 'a rail 4 mm shorter than its 773 mm bay');
  assert.ok(check('doors').some(c => c.value !== undefined && c.value > 0 && c.value < 10), 'the door gap in millimetres');
});

test('how it is built follows the room: lying down and stood up where the ceiling allows, standing where not, a bench for a low piece', () => {
  const mp = make(wardrobe), needs = Math.round(standUpHeight(220, 60) * 100) / 10;
  const open = assemblyPlan(mp).method, high = assemblyPlan(mp, { ceiling: 260 }).method, low = assemblyPlan(mp, { ceiling: 225 }).method;
  assert.equal(open.posture, 'lying');
  assert.equal(open.standUp, needs);
  assert.match(open.text, new RegExp(`it needs ${needs} mm of height .* so measure the ceiling first`));
  assert.deepEqual([high.posture, high.ceiling], ['lying', 2600]);
  assert.equal(low.posture, 'standing');
  assert.match(low.text, new RegExp(`it needs ${needs} mm .* the ceiling is 2250 mm`));
  assert.match(low.text, /none is screwed from underneath/);
  // The promise in that sentence, proved: no joint of the piece is driven from below.
  for (const joints of JOINT_SYSTEMS) assert.equal(make({ ...wardrobe, construction: { joints, back: 'nailed' } }).joints.filter(c => c.access === 'driven-below').length, 0);
  assert.equal(assemblyPlan(make(createKitchenDesign('base'))).method.posture, 'bench');
});

test('time and hands are counted from the piece: a lock plate is half a minute, not a pair of runners\' ten', () => {
  assert.equal(fitMinutes('runner'), 10);
  assert.equal(fitMinutes('drawerLock'), .5);
  assert.equal(fitMinutes('plate'), 1.5);
  assert.equal(fitMinutes('hinge'), 4);
  assert.deepEqual([45, 60, 95, 270].map(duration), ['45 min', '1 h', '1 h 30 min', '4 h 30 min']);
  const plan = assemblyPlan(make(wardrobe));
  assert.equal(plan.people, 2, 'a 2.2 m side is lifted by two');
  assert.equal(plan.steps.find(s => s.stage === 'inside')!.people, 1);
});

test('the drawings print the plan: how it is built, then every step with its set-out', () => {
  const mp = make(wardrobe), plan = assemblyPlan(mp, { ceiling: 260 });
  const pdf = makePdf(mp, { title: 'Wardrobe', material: id => id, band: 0, cut: cutLayout(mp.parts), plan }), text = new TextDecoder('latin1').decode(pdf);
  assert.ok(text.startsWith('%PDF'));
  assert.ok((text.match(/\/Type\s*\/Page\b/g) ?? []).length >= 4, 'parts, cut layout, hardware and steps, assembly');
});
