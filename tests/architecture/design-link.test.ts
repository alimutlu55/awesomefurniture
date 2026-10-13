import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designFromLink, designLink, hasDesign } from '../../src/app/design-link';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { describeScene } from '../../src/application/spec/describe-scene';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { EXAMPLE_SPEC } from '../../src/app/agent-api';

/** Share links: the whole design in the link, so it reopens exactly as it was shared, on any device. */

const scene = () => {
  const built = buildFromSpec(parseDesignSpec(EXAMPLE_SPEC), 'p');
  assert.ok(built.ok);
  return projectToScene(built.project)!;
};

test('a shared design reopens exactly as it was: room, ceilings, wardrobes and their fittings', async () => {
  const shared = scene(), link = await designLink(shared, 'https://example.test/editor?x=1#old');
  const url = new URL(link);
  assert.equal(url.origin + url.pathname + url.search, 'https://example.test/editor?x=1');
  assert.ok(hasDesign(url.hash));
  assert.ok(link.length < 4000, 'short enough for messages and chat apps: ' + link.length);
  const reopened = projectToScene(await designFromLink(url.hash))!;
  assert.deepEqual(describeScene(reopened), describeScene(shared));
  const fittings = (s: typeof shared) => s.wardrobes.map(w => structuredClone([w.state.secs, w.state.dividers, w.state.doors, w.state.fin, w.state.shape]));
  assert.ok(shared.wardrobes[0]!.state.secs.some(s => s.length > 0), 'the example has fittings');
  assert.deepEqual(fittings(reopened), fittings(shared), 'every fitting where it was');
});

test('a damaged or cut-short link is refused, never half-opened', async () => {
  const hash = new URL(await designLink(scene(), 'https://example.test/')).hash;
  await assert.rejects(designFromLink(hash.slice(0, hash.length / 2)));
  await assert.rejects(designFromLink('#design=not-a-design'));
  await assert.rejects(designFromLink('#spec={}'));
  assert.equal(hasDesign('#spec={}'), false);
});
