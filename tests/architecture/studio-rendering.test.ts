import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { studioCameraBounds, studioFloorPolygons } from '../../src/presentation/viewport/studio-layout';
import { createStudioRenderer } from '../../src/presentation/viewport/studio-renderer';
import type { Studio } from '../../src/domain/studio/studio';

const empty: Studio = { template: 'custom', walls: [], corners: [], openings: [] };

test('room floors survive deletion and preserve disconnected, reversed rings', () => {
  assert.deepEqual(studioFloorPolygons(empty), []);
  const room = createStudio('bedroom');
  const reversed = { ...room, walls: room.walls.map((w, i) => i % 2 ? { ...w, a: w.b, b: w.a } : w) };
  assert.equal(studioFloorPolygons(reversed)[0]!.length, 4);
  const twin = { ...room,
    corners: [...room.corners, ...room.corners.map(c => ({ ...c, id: 'copy-' + c.id, x: c.x + 1000 }))],
    walls: [...room.walls, ...room.walls.map(w => ({ ...w, id: 'copy-' + w.id, a: 'copy-' + w.a, b: 'copy-' + w.b }))],
  };
  assert.equal(studioFloorPolygons(twin).length, 2);
  assert.ok(studioFloorPolygons({ ...room, walls: room.walls.slice(1) })[0]!.length >= 4);
});

test('room camera bounds include tall walls and cabinets without changing cabinet framing', () => {
  const cabinet = { x: 0, z: 40, w: 200, d: 60, h: 240 };
  assert.equal(studioCameraBounds(undefined, cabinet), cabinet);
  assert.equal(studioCameraBounds(empty, cabinet), cabinet);
  const b = studioCameraBounds(createStudio('bedroom'), cabinet);
  assert.ok(b.w > cabinet.w && b.d > cabinet.d && b.h >= 260);
});

test('cutaway hides wall body and opening details completely, then restores them', () => {
  const original = globalThis.document;
  // CanvasTexture needs only the canvas identity; drawing is verified by browser screenshots.
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillStyle: '', fillRect() {} }) }) } as unknown as Document;
  try {
    const scene = new THREE.Scene(), renderer = createStudioRenderer(scene), room = createStudio('bedroom');
    renderer.sync(room);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 150, -1000);
    renderer.frame(camera, 1); renderer.frame(camera, 1);
    const root = scene.getObjectByName('studio')!;
    assert.ok(root.children.some(child => child instanceof THREE.Group && !child.visible), 'near wall and all its details disappear');
    camera.position.set(0, 150, 150);
    renderer.frame(camera, 1); renderer.frame(camera, 1);
    assert.ok(root.children.every(child => child.visible), 'interior view restores walls');
    renderer.sync(empty);
    assert.equal(root.children.length, 1, 'empty floor geometry is harmless');
    renderer.dispose();
    assert.equal(scene.children.length, 0);
  } finally { globalThis.document = original; }
});
