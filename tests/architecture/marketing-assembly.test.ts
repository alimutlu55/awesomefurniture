import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Euler, Vector3 } from 'three';
import { assemblyParts, assemblyPose, assemblyTimeline } from '../../src/presentation/marketing/assembly-model';
import { assemblyCopy } from '../../src/presentation/marketing/assembly-copy';
import { languages } from '../../src/presentation/marketing/translations';

test('every preview shape assembles exactly to its design, and scrubbing backwards preserves the same poses', () => {
  for (const width of [140, 240, 260, 320]) for (const shape of ['regular', 'alcove', 'under-stairs'] as const) {
    const parts = assemblyParts(width, shape);
    assert.ok(parts.length > 15);
    const back = parts.find(part => part.kind === 'back')!;
    assert.equal(back.size[0], width / 100);
    parts.forEach((part, index) => {
      assert.ok(part.size.every(size => size > 0));
      const forward = Array.from({ length: 101 }, (_, n) => assemblyPose(part, index, n / 100));
      for (let n = 100; n >= 0; n--) assert.deepEqual(assemblyPose(part, index, n / 100), forward[n]);
      assert.deepEqual(forward[100]!.position, part.position);
      assert.deepEqual(forward[100]!.rotation, part.rotation);
    });
  }
});

test('panels lie flat at the start and stay above the floor throughout the lift and rotation', () => {
  for (const shape of ['regular', 'alcove', 'under-stairs'] as const) {
    assemblyParts(320, shape).forEach((part, index) => {
      const profile = part.outline ?? [
        [-part.size[0] / 2, -part.size[1] / 2], [part.size[0] / 2, -part.size[1] / 2],
        [-part.size[0] / 2, part.size[1] / 2], [part.size[0] / 2, part.size[1] / 2],
      ];
      for (let n = 0; n <= 100; n++) {
        const pose = assemblyPose(part, index, n / 100), euler = new Euler(...pose.rotation), box = new Box3();
        for (const [x, y] of profile) for (const z of [-part.size[2] / 2, part.size[2] / 2]) {
          box.expandByPoint(new Vector3(x, y, z).applyEuler(euler).add(new Vector3(...pose.position)));
        }
        assert.ok(box.min.y >= -.00001, `${shape}, panel ${index}, ${n}% went through the floor`);
        if (n === 0) assert.ok(box.max.y - box.min.y < .03, 'All boards start lying flat');
      }
    });
  }
});

test('the assembly keeps moving through the middle instead of pausing in the exploded pose', () => {
  for (const width of [140, 240, 260, 320]) for (const shape of ['regular', 'alcove', 'under-stairs'] as const) {
    const parts = assemblyParts(width, shape), timeline = assemblyTimeline(parts);
    assert.equal(timeline(0), 0); assert.equal(timeline(1), 1);
    const movement = Array.from({ length: 80 }, (_, n) => parts.reduce((distance, part, index) => {
      const from = assemblyPose(part, index, timeline((n + 10) / 100)), to = assemblyPose(part, index, timeline((n + 11) / 100));
      return distance + Math.hypot(...from.position.map((v, axis) => v - to.position[axis]!))
        + Math.hypot(...from.rotation.map((v, axis) => v - to.rotation[axis]!));
    }, 0));
    const peak = Math.max(...movement);
    for (let n = 30; n < 75; n++) {
      assert.ok(movement[n - 10]! > peak * .9, `${shape}, ${width} cm slows at ${n}%`);
    }
  }
});

test('assembly controls have localized instructions on every translated landing page', () => {
  for (const language of languages) {
    const labels = assemblyCopy(language.lang);
    assert.equal(labels.stages.length, 3);
    assert.ok(labels.play && labels.pause && labels.unavailable);
    if (language.lang !== 'en') assert.notEqual(labels.slider, assemblyCopy('en').slider);
  }
});
