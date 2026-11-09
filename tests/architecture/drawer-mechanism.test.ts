import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { drawerMechanism } from '../../src/domain/wardrobe/drawer-mechanism';
import { RUNNER_CLEARANCE, RUNNER_REAR_GAP, runnerForSpace } from '../../src/domain/wardrobe/drawer-runners';
import { RUNNER_ENTRY } from '../../src/domain/hardware/hardware-registry';
import { DRAWER_SLIDE, drawerSlide, slidingPart } from '../../src/presentation/viewport/drawer-slide';

// A 50 cm bay in a 60 cm deep wardrobe, a drawer 20 cm tall on the board under it.
const bay = { x0: -25, x1: 25, floor: 50, ceiling: 70, frontY1: 70, frontBack: 26.5, rear: -29.4 };

test('a drawer is an open box as deep as its runner, clear of the uprights and the board over it', () => {
  const m = drawerMechanism(bay), names = m.box.map(p => p.name).sort();
  assert.deepEqual(names, ['Box back', 'Box bottom', 'Box side', 'Box side'], 'sides, back and bottom: no lid');
  const xs = m.box.flatMap(p => [p.x - p.w / 2, p.x + p.w / 2]), ys = m.box.flatMap(p => [p.y - p.h / 2, p.y + p.h / 2]);
  const zs = m.box.flatMap(p => [p.z - p.d / 2, p.z + p.d / 2]);
  assert.ok(Math.abs(Math.min(...xs) - (bay.x0 + RUNNER_CLEARANCE)) < 1e-9 && Math.abs(Math.max(...xs) - (bay.x1 - RUNNER_CLEARANCE)) < 1e-9, 'runner room each side');
  assert.ok(Math.min(...ys) > bay.floor && Math.max(...ys) < bay.ceiling, 'between the boards under and over it');
  assert.ok(Math.abs(Math.max(...zs) - bay.frontBack) < 1e-9 && Math.abs(Math.max(...zs) - Math.min(...zs) - m.length) < 1e-9, 'as deep as its runner');
  assert.ok(Math.min(...zs) >= bay.rear, 'in front of the back board');
});

test('its runner is the longest that fits behind its front, and it comes out the registry\'s open pull of it', () => {
  const m = drawerMechanism(bay), motion = RUNNER_ENTRY.motion!;
  assert.equal(m.length, runnerForSpace(bay.frontBack - bay.rear - RUNNER_REAR_GAP));
  assert.equal(m.travel, Math.round(m.length * (motion.kind === 'telescope' ? motion.openPullRatio : NaN)));
});

test('an applied front gets a box front of its own', () => {
  assert.ok(drawerMechanism({ ...bay, applied: true }).box.some(p => p.name === 'Box front'));
});

test('only the drawer travels: the cabinet member of each runner stays with the carcass', () => {
  const m = drawerMechanism(bay), parent = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, group?: THREE.Object3D) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); o.position.set(x, y, z); (group ?? parent).add(o); return o;
  };
  const material = new THREE.MeshBasicMaterial(), slide = drawerSlide(parent, box, m, { box: material, metal: material });
  assert.equal(slide.name, DRAWER_SLIDE);
  assert.equal(slide.children.length, m.box.length + m.runners.filter(r => r.role === 'drawer').length);
  assert.equal(parent.children.filter(c => c !== slide).length, m.runners.filter(r => r.role === 'cabinet').length);
  assert.ok(m.runners.some(r => r.role === 'cabinet') && m.runners.some(r => r.role === 'drawer'));
  // The fitting around it, with a board that must stay: only the drawer comes out.
  const fitting = new THREE.Group(); fitting.add(parent);
  assert.deepEqual(slidingPart(fitting, 99), { part: slide, travel: m.travel });
  assert.deepEqual(slidingPart(new THREE.Group(), 7).travel, 7, 'a pull-out without a part of its own slides whole');
});
