import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorState } from '../../src/application/projects/editor-state';
import { FURNITURE } from '../../src/domain/furniture/furniture';
import { PIECE_PRESETS } from '../../src/domain/furniture/piece-presets';
import { KITCHEN_PRESETS, createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { KITCHEN_UNITS } from '../../src/domain/kitchen/kitchen-units';
import { FIXTURES } from '../../src/domain/studio/fixtures/fixture-kinds';
import { FURNISHINGS } from '../../src/domain/studio/furnishings/furnishing-kinds';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { removeWall, splitWall } from '../../src/domain/studio/studio-edit';
import { PIECE_KINDS, newFixturePiece, newFurnishingPiece, pieceOf, roomOf, roomPiece } from '../../src/domain/pieces/pieces';

test('existing furniture catalogues produce one entry per room-piece kind, with a working factory', () => {
  for (const entries of Object.values(PIECE_KINDS)) assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  assert.deepEqual(PIECE_KINDS.fixture.map(entry => entry.source), FIXTURES);
  assert.deepEqual(PIECE_KINDS.furnishing.map(entry => entry.source), FURNISHINGS);
  for (const def of [...FURNITURE, ...KITCHEN_UNITS, ...KITCHEN_PRESETS]) assert.ok(PIECE_KINDS.cabinet.some(entry => entry.id === def.key));
  for (const def of PIECE_PRESETS) assert.ok(PIECE_KINDS.cabinet.some(entry => entry.id === def.id));
  for (const unit of KITCHEN_UNITS) {
    const design = createKitchenDesign(unit.key);
    const piece = pieceOf({ id: 1, x: 0, y: unit.elevation, z: 0, angle: 0, state: design });
    const entry = PIECE_KINDS.cabinet.find(kind => kind.id === unit.key)!;
    assert.equal(piece.mobility, entry.mobility);
    assert.equal(piece.body(undefined).y, unit.elevation);
    assert.ok(piece.finishGroups().length);
    assert.ok(piece.withFinish('carcass', piece.finishGroups()[0]!.choices[0]!.id));
  }
  for (const def of FIXTURES) {
    const piece = newFixturePiece(def.key)!;
    assert.equal(pieceOf(piece.data).mobility, 'along-wall');
    for (const type of def.types) assert.equal(piece.withType(type.id)?.type, type.id);
    for (const group of piece.finishGroups()) assert.ok(piece.withFinish(group.id, group.choices[0]!.id));
  }
  for (const def of FURNISHINGS) {
    const piece = newFurnishingPiece(def.key)!;
    assert.equal(piece.blocks, PIECE_KINDS.furnishing.find(entry => entry.id === def.key)!.blocks);
    for (const type of def.types) assert.equal(piece.withType(type.id)?.type, type.id);
    for (const group of piece.finishGroups()) assert.ok(piece.withFinish(group.id, group.choices[0]!.id));
  }
});

test('piece commands edit, preview, copy and remove by ID across all three piece families', () => {
  const model = createEditorModel({ wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: rectangleStudio(800, 620) });
  const checkpoints: string[] = [], events: { event: string; props: unknown }[] = [];
  const commands = createSceneCommands(() => model.scene, {
    checkpoint: () => checkpoints.push(model.snapshot()),
    track: (event, props) => events.push({ event, props }),
  });
  const closet = commands.addPiece({ family: 'cabinet', id: 'wardrobe' }, { wallId: 'w1' })!;
  const basin = commands.addPiece({ family: 'fixture', id: 'basin' }, { wallId: 'w3', near: 150 })!;
  const bed = commands.addPiece({ family: 'furnishing', id: 'bed' }, { wallId: 'w3', near: 470 })!;
  assert.ok(closet && basin && bed);
  assert.equal(checkpoints.length, 3);
  const beforePreview = model.snapshot();
  assert.ok(commands.previewPiece(closet, { action: 'size', axis: 'width', value: 140 }));
  assert.equal(model.scene.wardrobes[0]?.state.w, 140);
  assert.equal(checkpoints.length, 3);
  model.restore(beforePreview);
  assert.ok(commands.commitPiece(closet, { action: 'size', axis: 'width', value: 150 }));
  assert.ok(commands.commitPiece(basin, { action: 'type', id: 'vanity' }));
  assert.ok(commands.commitPiece(bed, { action: 'finish', group: 'fabric', id: 'sage' }));
  assert.equal(checkpoints.length, 6);
  const read = () => roomOf(model.scene.studio, model.scene.wardrobes);
  assert.equal(roomPiece(read(), closet)?.body(model.scene.studio).width, 150);
  assert.equal(roomPiece(read(), bed)?.body(model.scene.studio).key.id, bed.id);
  for (const key of [closet, basin, bed]) {
    const copy = commands.duplicatePiece(key);
    assert.ok(copy && copy.id !== key.id);
    assert.equal(commands.pieceProblem(copy), null);
    assert.ok(commands.removePiece(copy));
  }
  assert.equal(commands.addPiece({ family: 'cabinet', id: 'not-in-catalogue' }), null);
  assert.deepEqual(events.map(item => item.event), [
    'furniture_piece_added', 'studio_room_edited', 'studio_room_edited', 'furniture_piece_added', 'studio_room_edited', 'studio_room_edited',
  ]);
  assert.deepEqual(events[3]?.props, { product: 'wardrobe', preset_id: null, placement: 'duplicate', total_pieces_in_scene: 2 });
});

test('wall placements follow splits and disappear when their supporting wall is removed', () => {
  const studio = rectangleStudio(500, 500), fixture = newFixturePiece('basin')!;
  const f = { ...fixture.data, id: 'f1', wall: 'w1', offset: 370 };
  const before = { ...studio, fixtures: [f] }, next = splitWall(before, 'w1', 250)!;
  assert.ok(next);
  const moved = next.fixtures![0]!;
  assert.notEqual(moved.wall, f.wall);
  assert.equal(moved.offset, 120);
  assert.equal(removeWall(next, moved.wall)?.fixtures?.length, 0);
});

test('a cabinet can be committed by key with another cabinet selected', () => {
  const make = (id: number, x: number) => ({ id, name: `Cabinet ${id}`, x, y: 0, z: 0, angle: 0, state: createEditorState() });
  const model = createEditorModel({ wardrobes: [make(1, -300), make(2, 300)], activeWardrobe: 2, nextWardrobeId: 3 });
  let checkpoints = 0;
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => { checkpoints++; } });
  assert.ok(commands.commitPiece({ family: 'cabinet', id: '1' }, { action: 'size', axis: 'width', value: 160 }));
  assert.deepEqual(model.scene.wardrobes.map(c => c.state.w), [160, 200]);
  assert.equal(model.scene.activeWardrobe, 2);
  assert.equal(checkpoints, 1);
});

test('a worktop appliance keeps its elevation for a floor move and cabinet depth can keep the back anchored', () => {
  const design = createKitchenDesign('hob-top');
  const hob = pieceOf({ id: 1, x: 0, y: 90, z: 0, angle: 0, state: design });
  const room = roomOf(undefined, [hob.data]);
  assert.equal(hob.mobility, 'on-worktop');
  assert.equal(hob.move(room, { x: 20, z: 10, angle: 0 }).value?.y, 90);
  const wardrobe = pieceOf({ id: 2, x: 200, y: 0, z: 0, angle: 0, state: createEditorState() });
  const resized = wardrobe.resize(roomOf(undefined, [wardrobe.data]), { depth: 70 }, 'back').value;
  assert.equal(resized?.depth, 70);
  assert.equal(resized?.z, 5);
});
