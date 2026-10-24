import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../../src/domain/project/project';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { fixturePlace } from '../../src/domain/studio/fixtures/fixture-place';
import { currentSetup } from '../../src/domain/studio/fixtures/fixture-setup';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { deserializeProject, parseStoredProject } from '../../src/infrastructure/serialization/project-codec';
import { createBrowserDrafts } from '../../src/infrastructure/persistence/browser-drafts';

/** A design as the reverted fixtures build saved it: version 3, an enclosure on the back wall with a wall-hung toilet
 * on it, a vanity with a vessel basin on it, and a tap and a mirror, which this editor has no fixture for. */
function retired() {
  const studio = rectangleStudio(300, 250), status = 'new', color = '#f7f5ef';
  return { ...createProject('bath', 'Old bathroom'), schemaVersion: 3, studio: { ...studio,
    enclosures: [{ id: 'fe1', name: 'Installation enclosure', anchor: { kind: 'wall', wall: 'w1', offset: 80, y: 0, gap: 0 },
      w: 90, h: 120, d: 20, lining: 1.5, color, sideColor: color, topColor: color, finish: 'paint', form: 'boxing', status, generatedFor: 'fx1' }],
    fixtures: [
      { id: 'fx1', kind: 'toilet', variant: 'wall-hung', w: 37, h: 32, d: 54, color, anchor: { kind: 'enclosure', enclosure: 'fe1', offset: 0, y: 10 }, status,
        assembly: 'a1', installation: { w: 50, h: 112, d: 18, access: 'front' } },
      { id: 'fx2', kind: 'vanity', variant: 'floating', w: 80, h: 50, d: 50, color: '#bb9671', anchor: { kind: 'wall', wall: 'w1', offset: 220, y: 30, gap: 0 }, status },
      { id: 'fx3', kind: 'basin', variant: 'vessel', w: 45, h: 14, d: 36, color, anchor: { kind: 'fixture', fixture: 'fx2', x: 0, z: 0, lift: 0 }, status },
      { id: 'fx4', kind: 'faucet', variant: 'deck', w: 5, h: 22, d: 18, color: '#b9bec2', anchor: { kind: 'fixture', fixture: 'fx2', x: 0, z: -15, lift: 0 }, status },
      { id: 'fx5', kind: 'mirror', variant: 'round', w: 65, h: 65, d: 3, color: '#bacbd0', anchor: { kind: 'wall', wall: 'w1', offset: 220, y: 115, gap: 0 }, status },
    ] } };
}

test('a design saved by the reverted fixtures build opens, keeping its toilet, boxing and basin', () => {
  const document = deserializeProject(JSON.stringify(retired())), studio = document.studio!;
  assert.equal(document.schemaVersion, 1);
  assert.equal('enclosures' in studio, false);
  assert.deepEqual(studioProblems(studio), []);
  const box = studio.ceilings!.find(c => c.outline)!, ts = box.outline!.map(p => p.t);
  assert.deepEqual([Math.min(...ts), Math.max(...ts), Math.max(...box.outline!.map(p => p.y)), box.depth], [35, 125, 120, 20], 'the enclosure is a boxing on the same stretch');
  const toilet = studio.fixtures!.find(f => f.kind === 'toilet')!, basin = studio.fixtures!.find(f => f.kind === 'basin')!;
  assert.equal(toilet.offset, 80);
  assert.equal(fixturePlace(studio, toilet)!.back, 20, 'the toilet stands on its boxing');
  assert.equal(currentSetup(studio, toilet)!.id, 'wall-hung');
  assert.deepEqual([basin.type, basin.offset, basin.width, basin.depth, basin.height], ['countertop', 220, 80, 50, 94], 'a bowl on a vanity is a countertop basin as big as the vanity');
  assert.equal(studio.fixtures!.length, 2, 'the tap and the mirror have no fixture here');
});

test('the same design opens from a cloud or stored record', () => {
  const stored = parseStoredProject({ document: retired(), revision: 4, updatedAt: new Date(0).toISOString() });
  assert.equal(stored.document.schemaVersion, 1);
  assert.equal(stored.document.studio!.fixtures!.length, 2);
});

test('a retired draft is replaced by what opens, and its original is kept beside it', () => {
  const data = new Map<string, string>();
  const disk = { get length() { return data.size; }, clear: () => data.clear(), getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null, removeItem: (k: string) => { data.delete(k); }, setItem: (k: string, v: string) => { data.set(k, v); } } as Storage;
  const raw = JSON.stringify({ document: retired(), expectedRevision: 2 });
  disk.setItem('wardrobe:draft:owner:bath', raw); disk.setItem('wardrobe:active:owner', 'bath');
  const draft = createBrowserDrafts(disk, 'owner').read();
  assert.equal(draft?.document.schemaVersion, 1);
  assert.equal(disk.getItem('wardrobe:recovery:owner:bath:before-fixture-rollback'), raw);
  assert.equal(JSON.parse(disk.getItem('wardrobe:draft:owner:bath')!).document.schemaVersion, 1);
});

test('a retired part that no longer fits is left out, and other versions are still refused', () => {
  const clash = retired();
  // A second toilet on top of the first: the room stays buildable without it.
  clash.studio.fixtures.push({ ...clash.studio.fixtures[0]!, id: 'fx9' });
  const studio = deserializeProject(JSON.stringify(clash)).studio!;
  assert.equal(studio.fixtures!.filter(f => f.kind === 'toilet').length, 1);
  assert.deepEqual(studioProblems(studio), []);
  assert.throws(() => deserializeProject(JSON.stringify({ ...createProject('x', 'Future'), schemaVersion: 4 })));
});
