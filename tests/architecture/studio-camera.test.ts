import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { translateStudio } from '../../src/domain/studio/studio-edit';
import { LENS, eyeLevel, furnitureClearance, lensFor, roomReach, roomSideAngle, wallClearance } from '../../src/presentation/viewport/room-camera';

/** The camera in a room works like an interior photographer: free from above, inside the room at eye level. */

// The bedroom as placed around a 200 × 60 cm wardrobe at the origin: the back wall's face at z = -30.
const room = translateStudio(createStudio('bedroom'), 0, -30);
const wardrobe = { x: 0, z: 0 };

test('at eye level the camera stops short of the wall in front of the subject, never through it', () => {
  // Inside faces: x = ±200, front z = 320. The camera keeps 22 cm from a face.
  assert.equal(Math.round(wallClearance(room, wardrobe, { x: 0, z: 1 }, 2000)), 298);
  assert.equal(Math.round(wallClearance(room, wardrobe, { x: 1, z: 0 }, 2000)), 178);
  assert.equal(wallClearance(room, wardrobe, { x: 0, z: 1 }, 150), 150, 'a camera already inside is left where it is');
  // The wall right behind the subject is cut away instead of stopping the camera on its back.
  assert.equal(wallClearance(room, wardrobe, { x: 0, z: -1 }, 2000), 2000);
});

test('from above the camera orbits freely; it comes inside as it comes down', () => {
  const far = { x: 0, z: 1200 };
  assert.equal(roomReach(room, wardrobe, far, .9), 1, 'overview: the dollhouse view');
  assert.ok(Math.abs(roomReach(room, wardrobe, far, .2) - 298 / 1200) < 1e-9, 'eye level: against the far wall');
  assert.equal(eyeLevel(.9), 0);
  assert.equal(eyeLevel(.1), 1);
  assert.ok(eyeLevel(.42) > 0 && eyeLevel(.42) < 1, 'blended in between, so there is no jump');
});

test('the lens widens to hold the framing when the camera has to come closer, up to a limit', () => {
  assert.equal(lensFor(1), LENS.base);
  assert.ok(lensFor(.6) > LENS.base && lensFor(.6) < LENS.widest);
  assert.equal(lensFor(.05), LENS.widest);
});

test('at eye level the camera stays in front of the wall the wardrobe stands against, at most 45° round', () => {
  assert.equal(roomSideAngle(room, wardrobe, 0), 0, 'straight on is fine');
  assert.ok(Math.abs(roomSideAngle(room, wardrobe, Math.PI) - Math.PI / 4) < .1 || Math.abs(roomSideAngle(room, wardrobe, Math.PI) + Math.PI / 4) < .1, 'from behind it comes round to the three-quarter view');
  assert.ok(Math.abs(roomSideAngle(room, wardrobe, 1.2)) <= Math.PI / 4 + .01);
  // A wardrobe standing free in the middle of the room can be seen from every side.
  assert.equal(roomSideAngle(room, { x: 0, z: 160 }, Math.PI), Math.PI);
});

test('with nothing selected, the camera does not stand pressed against a wardrobe', () => {
  const other = [{ x: 0, z: 200, angle: 180, state: { w: 200, d: 60 } }];
  assert.equal(Math.round(furnitureClearance(other, wardrobe, { x: 0, z: 1 }, 1000)), 120, '50 cm short of its back');
  assert.equal(furnitureClearance(other, { x: 0, z: 200 }, { x: 0, z: 1 }, 1000), 1000, 'not the wardrobe it looks from inside');
  assert.ok(roomReach(room, wardrobe, { x: 0, z: 1200 }, .1, other) < roomReach(room, wardrobe, { x: 0, z: 1200 }, .1));
});
