import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { roomHeight, wallFace } from '../../src/domain/studio/studio';
import type { Studio, StudioFixture } from '../../src/domain/studio/studio';
import { addOpening, moveCorner, moveWall, removeWall, splitWall } from '../../src/domain/studio/studio-edit';
import { setCeilingDepth } from '../../src/domain/studio/studio-ceiling';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry';
import { BOXING, FINISHES, FIXTURES, TAPS } from '../../src/domain/studio/fixtures/fixture-kinds';
import type { FixtureKind } from '../../src/domain/studio/fixtures/fixture-kinds';
import { addFixture, moveFixture, setFixtureLook, setFixtureSize } from '../../src/domain/studio/fixtures/fixture-edit';
import { applySetup, currentSetup, placeFromEnd, slideFixture } from '../../src/domain/studio/fixtures/fixture-setup';
import { boxingBehind, fixturePlace } from '../../src/domain/studio/fixtures/fixture-place';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

/** A 300 × 250 cm room; its back wall w1 has its inside face from 6 to 306 along it (12 cm walls). */
const room = () => rectangleStudio(300, 250);
const MID = 156;
function editor(studio: Studio = room()) {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio });
  const history: string[] = [], messages: string[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.push(model.snapshot()), report: m => messages.push(m) });
  return { model, commands, history, messages, studio: () => model.scene.studio!, fixture: (id: string) => model.scene.studio!.fixtures!.find(f => f.id === id)! };
}
const toiletOn = (studio: Studio, offset = MID) => { const next = addFixture(studio, 'w1', 'toilet', offset)!; return { studio: next, id: next.fixtures!.at(-1)!.id }; };
const topOf = (studio: Studio) => Math.max(...studio.ceilings![0]!.outline!.map(p => p.y));

test('a toilet is added wall-hung, in front of a new half-height boxing, as one undo step', () => {
  const e = editor(), before = e.model.snapshot();
  const id = e.commands.addStudioFixture('toilet', 'w1')!;
  assert.ok(id);
  const f = e.fixture(id), box = e.studio().ceilings![0]!;
  assert.equal(f.type, 'wall-hung');
  assert.equal(f.offset, MID, 'centred on the wall');
  assert.equal(topOf(e.studio()), BOXING.half);
  assert.equal(box.depth, BOXING.depth);
  assert.equal(fixturePlace(e.studio(), f)!.back, BOXING.depth, 'its back stands against the boxing, not the wall');
  assert.equal(currentSetup(e.studio(), f)!.id, 'wall-hung');
  assert.deepEqual(e.history, [before], 'toilet and boxing are one step');
  assert.deepEqual(studioProblems(e.studio()), []);
});

test('a deeper boxing brings the toilet forward; the total projection is boxing plus bowl', () => {
  const e = editor(), id = e.commands.addStudioFixture('toilet', 'w1')!;
  const deeper = setCeilingDepth(e.studio(), e.studio().ceilings![0]!.id, 28)!;
  const place = fixturePlace(deeper, deeper.fixtures![0]!)!;
  assert.equal(place.back, 28);
  assert.equal(place.back + e.fixture(id).depth, 28 + 53);
});

test('each toilet setup builds, raises, lowers or removes the boxing, and is read back from the room', () => {
  let { studio, id } = toiletOn(room());
  const setup = (s: string) => { studio = applySetup(studio, id, s)!.studio; return studio.fixtures!.find(f => f.id === id)!; };
  let f = setup('wall-hung');
  assert.equal(topOf(studio), BOXING.half);
  f = setup('wall-hung-full');
  assert.equal(topOf(studio), roomHeight(studio), 'a full-height wall reaches the ceiling');
  assert.equal(currentSetup(studio, f)!.id, 'wall-hung-full');
  assert.equal(studio.ceilings!.length, 1, 'the same boxing is raised, not a second one added');
  f = setup('back-to-wall');
  assert.equal(f.type, 'back-to-wall');
  assert.equal(topOf(studio), BOXING.low);
  f = setup('wall-hung-in-wall');
  assert.equal(studio.ceilings?.length ?? 0, 0, 'a frame in the wall needs no boxing');
  assert.equal(fixturePlace(studio, f)!.back, 0);
  assert.equal(currentSetup(studio, f)!.id, 'wall-hung-in-wall');
  f = setup('visible');
  assert.equal(f.type, 'close-coupled');
  assert.equal(f.depth, 66, 'a visible cistern stands further out');
  for (const s of FIXTURES[0].setups) {
    const next = applySetup(studio, id, s.id)!.studio;
    assert.equal(currentSetup(next, next.fixtures!.find(x => x.id === id)!)!.id, s.id, s.id);
  }
  assert.deepEqual(studioProblems(studio), []);
});

test('a boxing shared with a basin stays when the toilet no longer needs it', () => {
  let { studio, id } = toiletOn(room(), 80);
  studio = applySetup(studio, id, 'wall-hung')!.studio;
  // Widen the boxing along the wall and put a basin in front of it too.
  const box = studio.ceilings![0]!, wide = { ...box, outline: [{ t: 6, y: 0 }, { t: 240, y: 0 }, { t: 240, y: 120 }, { t: 6, y: 120 }], profile: [{ t: 6, y: 0 }, { t: 240, y: 0 }] };
  studio = addFixture({ ...studio, ceilings: [wide] }, 'w1', 'basin', 180)!;
  const basin = studio.fixtures!.at(-1)!;
  assert.equal(boxingBehind(studio, basin)?.id, box.id);
  const out = applySetup(studio, id, 'wall-hung-in-wall')!;
  assert.equal(out.studio.ceilings!.length, 1, 'the shared boxing is kept');
  assert.match(out.note!, /basin stands against it too/);
});

test('a new boxing stops at a door and closes a sliver to the corner', () => {
  const withDoor = addOpening(room(), 'w1', 'door')!;
  const door = withDoor.openings[0]!;
  // Near the left corner: the boxing reaches the corner instead of leaving 10 cm.
  let { studio, id } = toiletOn(withDoor, 60);
  studio = applySetup(studio, id, 'wall-hung')!.studio;
  const ts = studio.ceilings![0]!.outline!.map(p => p.t);
  assert.equal(Math.min(...ts), wallFace(studio, studio.walls[0]!)!.start);
  assert.ok(Math.max(...ts) <= door.offset - door.width / 2, 'stops short of the door');
  assert.deepEqual(studioProblems(studio), []);
});

test('fixtures are refused in a doorway, under a low window, off the wall and on each other, with the reason', () => {
  const withDoor = addOpening(room(), 'w1', 'door')!, door = withDoor.openings[0]!;
  assert.match(studioProblems(toiletOn(withDoor, door.offset).studio)[0]!, /cannot stand in a doorway/);
  assert.match(studioProblems(toiletOn(room(), 10).studio)[0]!, /Keep the toilet on its wall/);
  const two = addFixture(toiletOn(room(), 150).studio, 'w1', 'basin', 170)!;
  assert.ok(studioProblems(two).some(p => /overlap/.test(p)));
  const sized = setFixtureSize(toiletOn(room()).studio, 'f1', { width: 80 })!;
  assert.match(studioProblems(sized)[0]!, /width must be 33–45 cm/);
  const window: Studio = { ...room(), openings: [{ id: 'o1', wall: 'w1', kind: 'window', offset: MID, width: 100, height: 100, sill: 60 }] };
  const visible = applySetup(toiletOn(window).studio, 'f1', 'visible')!.studio;
  assert.match(studioProblems(visible)[0]!, /would cover the window/);
  assert.match(studioProblems(addFixture(window, 'w1', 'basin', MID)!)[0]!, /would cover the window/, 'a basin rim above the sill');
  const high: Studio = { ...room(), openings: [{ ...window.openings[0]!, sill: 95 }] };
  assert.deepEqual(studioProblems(addFixture(high, 'w1', 'basin', MID)!), [], 'a basin fits under a window sill above its rim');
});

test('a fixture across the room runs into the opposite wall', () => {
  const narrow = rectangleStudio(200, 60), deep = setFixtureSize(addFixture(narrow, 'w1', 'basin', 106)!, 'f1', { depth: 60 })!;
  assert.deepEqual(studioProblems(deep), []);
  const pushed = moveWall(deep, 'w3', 10)!;
  assert.ok(studioProblems(pushed).some(p => /runs into a wall/.test(p)));
});

test('wardrobes stop at fixtures, and a fixture is not added where a wardrobe stands', () => {
  const e = editor(), id = e.commands.addStudioFixture('toilet', 'w1')!;
  const solids = createCabinetGeometry(() => [], () => studioObstacles(e.studio()));
  const place = fixturePlace(e.studio(), e.fixture(id))!;
  const wardrobe = { id: 1, x: place.solid.x, z: place.solid.z, angle: 0, state: { w: 60, d: 60, h: 200 } };
  assert.equal(solids.cabinetCollides(wardrobe), true);
  // A wall filled with a wardrobe: the toilet goes nowhere on it, and says why.
  const full = editor();
  full.model.scene.wardrobes.push({ id: 7, x: 0, z: 31, y: 0, angle: 0, state: { w: 300, d: 60, h: 200 } } as never);
  assert.equal(full.commands.addStudioFixture('toilet', 'w1'), null);
  assert.match(full.messages.at(-1)!, /no free stretch for a toilet/);
  assert.deepEqual(full.history, []);
});

test('wall edits keep fixtures in place, split them with their wall and remove them with it', () => {
  const { studio } = toiletOn(room(), 60), corner = studio.walls[0]!.b;
  const stretched = moveCorner(studio, corner, studio.corners.find(c => c.id === corner)!.x + 40, -6)!;
  assert.equal(stretched.fixtures![0]!.offset, 60, 'stays where it was in the room');
  const split = splitWall(studio, 'w1', 150)!;
  assert.equal(split.fixtures![0]!.wall, 'w1');
  const right = splitWall(toiletOn(room(), 200).studio, 'w1', 150)!;
  assert.equal(right.fixtures![0]!.wall, 'w5', 'the new part of the wall');
  assert.equal(right.fixtures![0]!.offset, 50);
  assert.deepEqual(removeWall(studio, 'w1')!.fixtures, []);
});

test('dragging a fixture past what the room allows is refused by the same rules', () => {
  const e = editor(), id = e.commands.addStudioFixture('basin', 'w1')!;
  assert.equal(e.commands.editFixture(id, r => moveFixture(r, id, 0), false, true), false);
  assert.equal(e.commands.editFixture(id, r => moveFixture(r, id, 100)), true);
  assert.equal(e.fixture(id).offset, 100);
});

test('duplicating puts the copy beside it; removing takes one undo step', () => {
  const e = editor(), id = e.commands.addStudioFixture('basin', 'w1')!;
  const copy = e.commands.duplicateStudioFixture(id)!;
  assert.ok(copy && copy !== id);
  assert.ok(Math.abs(e.fixture(copy).offset - e.fixture(id).offset) >= e.fixture(id).width);
  assert.deepEqual(studioProblems(e.studio()), []);
  const steps = e.history.length;
  assert.equal(e.commands.removeStudioFixture(copy), true);
  assert.equal(e.history.length, steps + 1);
});

test('fixtures are saved and read back exactly; unknown kinds and finishes are refused', () => {
  let { studio } = toiletOn(room());
  studio = applySetup(studio, 'f1', 'wall-hung')!.studio;
  studio = setFixtureLook(addFixture(studio, 'w1', 'basin', 260)!, 'f2', { tap: 'wall', ceramic: 'matt-black', metal: 'brushed-brass', front: 'oak' })!;
  const document = { ...createProject('bath', 'Bathroom'), studio };
  const read = deserializeProject(serializeProject(document));
  assert.deepEqual(read.studio!.fixtures, studio.fixtures);
  assert.deepEqual(read.studio!.ceilings, studio.ceilings);
  const bad = (change: Partial<StudioFixture>) => () => deserializeProject(JSON.stringify({ ...document, studio: { ...studio, fixtures: [{ ...studio.fixtures![0]!, ...change }] } }));
  assert.throws(bad({ kind: 'jacuzzi' }));
  assert.throws(bad({ ceramic: 'gold' }));
  assert.throws(bad({ type: 'flying' }), /Choose a fixture from the catalogue/);
  // A room without fixtures saves without the field, as before.
  assert.equal('fixtures' in deserializeProject(serializeProject({ ...document, studio: room() })).studio!, false);
});

test('every fixture kind, type, setup, finish and tap is buildable in an ordinary room', () => {
  for (const kind of FIXTURES) {
    for (const type of kind.types) {
      const studio = addFixture(rectangleStudio(400, 300), 'w1', kind.key, 206, type.id)!, f = studio.fixtures![0]!;
      const { bottom, top } = type.extent(f);
      assert.ok(bottom >= 0 && top > bottom, `${kind.key}/${type.id} extent`);
      for (const k of ['width', 'depth', 'height'] as const) assert.ok(type.limits[k][0] <= type.size[k] && type.size[k] <= type.limits[k][1], `${kind.key}/${type.id} ${k}`);
      assert.deepEqual(studioProblems(studio), [], `${kind.key}/${type.id}`);
      for (const group of kind.finishes) for (const x of FINISHES[group]) assert.deepEqual(studioProblems(setFixtureLook(studio, f.id, { [group]: x.id })!), [], `${group} ${x.id}`);
      if ((kind as FixtureKind).tap) for (const t of TAPS) assert.deepEqual(studioProblems(setFixtureLook(studio, f.id, { tap: t.id })!), []);
    }
    for (const s of ('setups' in kind ? kind.setups : [])) {
      const studio = applySetup(addFixture(rectangleStudio(400, 300), 'w1', kind.key, 206)!, 'f1', s.id)!.studio;
      assert.deepEqual(studioProblems(studio), [], `${kind.key} setup ${s.id}`);
      assert.equal(currentSetup(studio, studio.fixtures![0]!)!.id, s.id);
    }
  }
});

test('sliding a toilet takes its own boxing with it, but slides along a boxing it shares', () => {
  let { studio, id } = toiletOn(room(), MID);
  studio = applySetup(studio, id, 'wall-hung')!.studio;
  const span = (r: Studio) => r.ceilings![0]!.outline!.map(p => p.t);
  const moved = slideFixture(studio, id, MID + 40)!;
  assert.deepEqual(span(moved), span(studio).map(t => t + 40), 'its boxing went with it');
  assert.equal(currentSetup(moved, moved.fixtures![0]!)!.id, 'wall-hung', 'still in its boxing');
  assert.deepEqual(studioProblems(moved), []);
  const typed = placeFromEnd(studio, id, 'left', 100)!;
  assert.equal(Math.min(...span(typed)) + (MID - Math.min(...span(studio))) - 18, 6 + 100, 'typing a gap slides it the same way');
  // Shared with a basin: the boxing stays and the toilet slides along its face.
  const box = studio.ceilings![0]!, wide = { ...box, outline: [{ t: 6, y: 0 }, { t: 280, y: 0 }, { t: 280, y: 120 }, { t: 6, y: 120 }], profile: [{ t: 6, y: 0 }, { t: 280, y: 0 }] };
  const shared = addFixture({ ...studio, ceilings: [wide] }, 'w1', 'basin', 240)!;
  const slid = slideFixture(shared, id, 100)!;
  assert.deepEqual(span(slid), span(shared));
  assert.equal(fixturePlace(slid, slid.fixtures![0]!)!.back, BOXING.depth);
});

test('a new basin goes fully in front of a boxing or clear of it, never half on it', () => {
  const e = editor();
  e.commands.addStudioFixture('toilet', 'w1');
  const box = e.studio().ceilings![0]!.outline!.map(p => p.t), from = Math.min(...box), to = Math.max(...box);
  // Asked for right at the boxing's edge, it moves to where it is clear of the edge.
  const id = e.commands.addStudioFixture('basin', 'w1', to)!, f = e.fixture(id), l = f.offset - f.width / 2, r = f.offset + f.width / 2;
  assert.ok(!(l < from && from < r) && !(l < to && to < r), `basin ${l}–${r}, boxing ${from}–${to}`);
  assert.deepEqual(studioProblems(e.studio()), []);
});
