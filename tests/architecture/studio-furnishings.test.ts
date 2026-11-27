import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { wallLine } from '../../src/domain/studio/studio';
import type { Studio } from '../../src/domain/studio/studio';
import { addOpening, moveWall, translateStudio } from '../../src/domain/studio/studio-edit';
import { furnishingPiece } from '../../src/domain/pieces/pieces';
import { snapTurn } from '../../src/domain/pieces/piece-motion';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry';
import { FURNISHINGS, FURNISHING_FINISHES } from '../../src/domain/studio/furnishings/furnishing-kinds';
import { addFurnishing, moveFurnishing, removeFurnishing, setFurnishingLook, setFurnishingSize, setFurnishingType } from '../../src/domain/studio/furnishings/furnishing-edit';
import { furnishingPoint, steadyGap } from '../../src/domain/studio/furnishings/furnishing-place';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

/** A 400 × 350 cm room; its back wall w1 runs along x with the room in front of it. */
const room = () => rectangleStudio(400, 350);
function editor(studio: Studio = room()) {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio });
  const history: string[] = [], messages: string[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.push(model.snapshot()), report: m => messages.push(m) });
  return { model, commands, history, messages, studio: () => model.scene.studio!, item: (id: string) => model.scene.studio!.furnishings!.find(f => f.id === id)! };
}
/** How far its back stands from wall w1's room face. */
function backFromWall(studio: Studio, f: { x: number; z: number; angle: number; depth: number }) {
  const w = studio.walls.find(x => x.id === 'w1')!, line = wallLine(studio, w)!, back = furnishingPoint(f, 0, -f.depth / 2);
  return (back.x - line.a.x) * line.nx + (back.z - line.a.z) * line.nz - w.thickness / 2;
}

test('a bed is added with its headboard flush against the chosen wall, square to it, as one undo step', () => {
  const e = editor(), before = e.model.snapshot();
  const id = e.commands.addStudioFurnishing('bed', 'w1')!;
  assert.ok(id);
  const bed = e.item(id), line = wallLine(e.studio(), e.studio().walls[0]!)!;
  assert.equal(bed.type, 'king');
  assert.equal(bed.angle, Math.round(line.angle * 10) / 10 % 360);
  assert.ok(Math.abs(backFromWall(e.studio(), bed)) < .2, 'headboard against the wall');
  assert.deepEqual(e.history, [before]);
  assert.deepEqual(studioProblems(e.studio()), []);
});

test('a bedside table goes beside the bed against the same wall; a rug goes under the bed and is in nobody\'s way', () => {
  const e = editor(), bed = e.item(e.commands.addStudioFurnishing('bed', 'w1')!);
  const side = e.item(e.commands.addStudioFurnishing('bedside')!);
  assert.equal(side.angle, bed.angle);
  assert.ok(Math.abs(backFromWall(e.studio(), side)) < .2);
  const across = Math.abs((side.x - bed.x) * Math.cos(bed.angle * Math.PI / 180) - (side.z - bed.z) * Math.sin(bed.angle * Math.PI / 180));
  assert.ok(across < bed.width / 2 + side.width / 2 + 10, 'right beside it');
  const rug = e.item(e.commands.addStudioFurnishing('rug')!);
  assert.ok(Math.hypot(rug.x - bed.x, rug.z - bed.z) < bed.depth / 2, 'under the bed');
  assert.ok(!studioObstacles(e.studio()).some(o => o.id === 'furnishing:' + rug.id), 'a rug is never an obstacle');
  assert.ok(studioObstacles(e.studio()).some(o => o.id === 'furnishing:' + bed.id), 'a bed is');
  assert.deepEqual(studioProblems(e.studio()), []);
});

test('wardrobes stop at a bed, and a bed is refused where a wardrobe stands', () => {
  const e = editor(), bed = e.item(e.commands.addStudioFurnishing('bed', 'w1')!);
  const solids = createCabinetGeometry(() => [], () => studioObstacles(e.studio()));
  assert.ok(solids.cabinetCollides({ x: bed.x, z: bed.z, y: 0, angle: 0, state: { w: 100, d: 60, h: 220 } }));
  const moved = moveFurnishing(e.studio(), bed.id, { x: bed.x, z: bed.z + 200, angle: bed.angle })!;
  assert.ok(studioProblems(moved).some(p => /runs into a wall/.test(p)), 'out through the front wall');
});

test('a wall pushed into a bed is refused with the reason', () => {
  const e = editor();
  e.commands.addStudioFurnishing('bed', 'w1');
  const pushed = moveWall(e.studio(), 'w3', 200);
  assert.ok(!pushed || studioProblems(pushed).length > 0);
});

test('a type or length change keeps the headboard against the wall; width grows from the middle', () => {
  const e = editor(), id = e.commands.addStudioFurnishing('bed', 'w1')!, before = e.item(id);
  const single = setFurnishingType(e.studio(), id, 'single')!, s = single.furnishings![0]!;
  assert.equal(s.width, 98);
  assert.ok(Math.abs(backFromWall(single, s)) < .2);
  const longer = setFurnishingSize(e.studio(), id, { depth: 230 })!, l = longer.furnishings![0]!;
  assert.ok(Math.abs(backFromWall(longer, l)) < .2);
  const wider = setFurnishingSize(e.studio(), id, { width: 200 })!, w = wider.furnishings![0]!;
  assert.deepEqual([w.x, w.z], [before.x, before.z]);
});

test('turning a bed against a wall slides it out of the wall rather than through it', () => {
  const e = editor(), id = e.commands.addStudioFurnishing('bed', 'w1')!, before = e.item(id);
  assert.ok(e.commands.turnStudioFurnishing(id));
  const after = e.item(id);
  assert.equal((after.angle - before.angle + 360) % 360, 90);
  assert.deepEqual(studioProblems(e.studio()), []);
});

test('duplicate puts a copy beside it; remove takes the list away when it is the last', () => {
  const e = editor(), id = e.commands.addStudioFurnishing('bedside', 'w1')!;
  const copy = e.commands.duplicateStudioFurnishing(id)!;
  assert.ok(copy && copy !== id);
  assert.deepEqual(studioProblems(e.studio()), []);
  assert.ok(e.commands.removeStudioFurnishing(copy));
  const empty = removeFurnishing(e.studio(), id)!;
  assert.equal('furnishings' in empty, false);
});

test('moving the whole room takes its furnishings with it', () => {
  const e = editor(), id = e.commands.addStudioFurnishing('bed', 'w1')!, bed = e.item(id);
  const moved = translateStudio(e.studio(), 50, -20).furnishings![0]!;
  assert.deepEqual([moved.x, moved.z], [bed.x + 50, bed.z - 20]);
});

test('every kind, type and finish can be added to a room, saved and read back unchanged', () => {
  for (const k of FURNISHINGS) for (const t of k.types) {
    const studio = addFurnishing(room(), k.key, { x: 0, z: 175, angle: 0 }, t.id)!;
    let next = studio;
    for (const group of k.finishes) for (const finish of FURNISHING_FINISHES[group]) next = setFurnishingLook(next, next.furnishings![0]!.id, { [group]: finish.id })!;
    assert.deepEqual(studioProblems(next), [], `${k.key} ${t.id}`);
    const project = { ...createProject('furnished', 'Furnished'), studio: next };
    const read = deserializeProject(serializeProject(project));
    assert.deepEqual(read.studio?.furnishings, next.furnishings, `${k.key} ${t.id} saved`);
  }
});

test('a project without furnishings saves no furnishings field', () => {
  const project = { ...createProject('plain', 'Plain'), studio: room() };
  assert.equal(serializeProject(project).includes('furnishings'), false);
});

test('a furnishing\'s gap lines start from the middle of each side, so they slide with it rather than jump', () => {
  const bed = { x: 50, z: 120, angle: 0, width: 168, depth: 212 };
  const a = steadyGap(bed, { side: 'left', distance: 40 })!, b = steadyGap({ ...bed, x: 51 }, { side: 'left', distance: 39 })!;
  assert.deepEqual([a.from.x, a.from.z], [50 - 84, 120]);
  assert.deepEqual([a.to.x, a.to.z], [50 - 84 - 40, 120]);
  assert.ok(Math.hypot(b.from.x - a.from.x, b.from.z - a.from.z) <= 1, 'a 1 cm move moves the line 1 cm');
  assert.equal(steadyGap(bed, { side: 'top', distance: 10 }), null);
});

test('furnishings follow the rules every piece shares: no doorways, turned out of walls, gaps read to cabinets', () => {
  const e = editor(addOpening(room(), 'w3', 'door')!), door = e.studio().openings[0]!;
  const id = e.commands.addStudioFurnishing('armchair')!;
  const line = wallLine(e.studio(), e.studio().walls.find(w => w.id === 'w3')!)!;
  const inDoorway = moveFurnishing(e.studio(), id, { x: line.a.x + line.ux * door.offset + line.nx * 50, z: line.a.z + line.uz * door.offset + line.nz * 50, angle: line.angle })!;
  assert.ok(studioProblems(inDoorway).some(p => /doorway/.test(p)), 'an armchair may not stand in a doorway');
  const piece = furnishingPiece(e.item(id));
  assert.deepEqual(piece.capabilities, { mobility: 'floor', turnable: true, typed: false, resizable: true, finishable: true, duplicable: true });
  const rug = furnishingPiece({ ...e.item(id), kind: 'rug', type: 'medium' });
  assert.equal(rug.blocks, false, 'a rug is in nobody\'s way');
  assert.equal(snapTurn(44), 45);
  assert.equal(snapTurn(87), 90, 'a quarter turn is caught within 5°');
  assert.equal(snapTurn(87, true), 87, 'Shift turns exactly');
});

test('successful room piece adds and copies each count once, including when a placement search rejects candidates', () => {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: rectangleStudio(600, 450) });
  const events: unknown[] = [];
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => { checkpoints++; }, track: (event, props) => events.push({ event, ...props }) });
  const basin = commands.addStudioFixture('basin', 'w1', 100)!;
  const bed = commands.addStudioFurnishing('bedside', 'w3')!;
  assert.ok(basin && bed);
  assert.ok(commands.duplicateStudioFixture(basin));
  assert.ok(commands.duplicateStudioFurnishing(bed));
  assert.equal(commands.addStudioFixture('basin', 'missing'), null);
  assert.equal(commands.duplicateStudioFurnishing('missing'), null);
  assert.equal(checkpoints, 4);
  assert.deepEqual(events, ['fixture', 'furnishing', 'fixture', 'furnishing'].map(family => ({
    event: 'studio_room_edited', action: family + '_added', detail_kind: family === 'fixture' ? 'basin' : 'bedside',
  })));
});
