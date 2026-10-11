import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { wallLine, type Studio } from '../../src/domain/studio/studio';
import { roomDragEdit, snapRoomPoint } from '../../src/presentation/editor/studio-drag';
import { studioActionEdit, studioFieldEdit, studioFields } from '../../src/presentation/editor/studio-fields';
const empty: Studio = { template: 'custom', corners: [], walls: [], openings: [] };

test('room point snapping uses 5 cm grid and Shift uses 1 cm', () => {
  assert.deepEqual(snapRoomPoint(empty, { x: 12.4, z: 23.7 }).point, { x: 10, z: 25 });
  assert.deepEqual(snapRoomPoint(empty, { x: 12.4, z: 23.7 }, undefined, undefined, true).point, { x: 12, z: 24 });
});

test('room points align to 45 and 90 degree rays and nearby corners', () => {
  const anchor = { x: 0, z: 0 };
  const diagonal = snapRoomPoint(empty, { x: 100, z: 105 }, anchor);
  assert.ok(Math.abs(diagonal.point.x - diagonal.point.z) < 1e-9);
  assert.equal(diagonal.guides.length, 1);
  const vertical = snapRoomPoint(empty, { x: 4, z: 100 }, anchor);
  assert.ok(Math.abs(vertical.point.x) < 1e-9);
  const room = { ...empty, corners: [{ id: 'c1', x: 12, z: 28 }, { id: 'c2', x: 100, z: 100 }] };
  assert.deepEqual(snapRoomPoint(room, { x: 10, z: 30 }).point, { x: 12, z: 28 });
  assert.deepEqual(snapRoomPoint(room, { x: 10, z: 30 }, undefined, 'c1').point, { x: 10, z: 30 });
});

test('wall dragging uses only its normal and opening dragging only its tangent', () => {
  const room = createStudio('bedroom');
  const moved = roomDragEdit(room, { kind: 'wall', id: 'w1' }, { x: 0, z: 0 }, { x: 100, z: -23 }, false).room!;
  assert.equal(moved.corners[0]!.x, room.corners[0]!.x);
  assert.equal(moved.corners[0]!.z, room.corners[0]!.z - 25);
  const shifted = roomDragEdit(room, { kind: 'opening', id: 'o1' }, { x: 0, z: 0 }, { x: 100, z: -23 }, true).room!;
  assert.equal(shifted.openings[0]!.offset, room.openings[0]!.offset - 23);
  assert.equal(roomDragEdit(room, { kind: 'corner', id: 'missing' }, { x: 0, z: 0 }, { x: 5, z: 5 }, false).room, null);
});

test('room fields dispatch wall, corner and opening edits without mutating the source', () => {
  const room = createStudio('bedroom'), wall = { kind: 'wall' as const, id: 'w1' }, corner = { kind: 'corner' as const, id: 'c1' };
  const length = studioFieldEdit(room, wall, 'length', 450)!;
  assert.equal(wallLine(length, length.walls[0]!)!.length, 450);
  assert.equal(studioFieldEdit(room, wall, 'height', 280)!.walls[0]!.height, 280);
  assert.equal(studioFieldEdit(room, wall, 'thickness', 16)!.walls[0]!.thickness, 16);
  assert.equal(studioFieldEdit(room, corner, 'x', -250)!.corners[0]!.x, -250);
  assert.equal(studioFieldEdit(room, corner, 'z', -50)!.corners[0]!.z, -50);
  const opening = { kind: 'opening' as const, id: 'o2' };
  for (const [key, value] of [['width', 100], ['height', 110], ['sill', 80], ['offset', 150]] as const) {
    assert.equal(studioFieldEdit(room, opening, key, value)!.openings.find(o => o.id === 'o2')![key], value);
  }
  assert.equal(room.walls[0]!.height, 260);
  assert.equal(studioFieldEdit(room, wall, 'height', NaN), null);
  assert.equal(studioFieldEdit(room, wall, 'unknown', 200), null);
  assert.equal(studioFieldEdit(room, null, 'height', 200), null);
});

test('room actions cover split, all opening kinds and removal', () => {
  const room = createStudio('wall'), selection = { kind: 'wall' as const, id: 'w1' };
  assert.equal(studioActionEdit(room, selection, 'split')!.walls.length, 2);
  assert.equal(studioActionEdit(room, selection, 'delete')!.walls.length, 0);
  for (const kind of ['door', 'window', 'archway']) {
    const added = studioActionEdit(room, selection, 'add-' + kind)!;
    assert.equal(added.openings[0]!.kind, kind);
    assert.equal(studioActionEdit(added, { kind: 'opening', id: 'o1' }, 'delete')!.openings.length, 0);
  }
  assert.equal(studioActionEdit(room, selection, 'unknown'), null);
  assert.equal(studioActionEdit(room, null, 'delete'), null);
});

test('opening fields offer sill only for windows and use accessible centimetre labels', () => {
  const room = createStudio('bedroom');
  assert.match(studioFields(room, { kind: 'opening', id: 'o2' }), /data-room-field="sill"/);
  assert.doesNotMatch(studioFields(room, { kind: 'opening', id: 'o1' }), /data-room-field="sill"/);
  assert.match(studioFields(room, { kind: 'wall', id: 'w1' }), /aria-label="Length in centimetres"/);
  assert.equal(studioFields(room, { kind: 'wall', id: 'missing' }), '');
});
