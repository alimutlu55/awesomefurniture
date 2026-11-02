import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { cabinetDoorLeaves } from '../../src/domain/wardrobe/door-layout';
import { frontsProblems, leafKey } from '../../src/domain/wardrobe/front-styles';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { createProject } from '../../src/domain/project/project';
import type { EditorScene, EditorState } from '../../src/application/projects/editor-scene';

/** A chosen door leaf's tools (P1-05b): which side it hangs on and how many leaves its opening has, each one undo step,
 * saved with the design. */

const hinged = (): EditorState => ({ ...createEditorState(), w: 50, doors: 'hinged' });
const leaves = (state: EditorState) => cabinetDoorLeaves(state, createWardrobeGeometry(() => state).widths()).map(l => [leafKey(l.bay, l.row, l.leaf), l.hinge]);
const scene = (state: EditorState): EditorScene => ({ wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 });
const save = (s: EditorScene) => serializeProject(sceneToProject(createProject('p', 'P'), s));

test('a leaf hangs on its other side, one undo step, saved and loaded', () => {
  const state = hinged();
  let steps = 0;
  const commands = createDesignCommands(() => state, { checkpoint: () => { steps++; } });
  const [[key, side]] = leaves(state) as [[string, string]];
  assert.equal(leaves(state).length, 1, 'a 50 cm wardrobe has one leaf');
  assert.ok(commands.flipLeafHinge(key));
  assert.equal(steps, 1);
  assert.deepEqual(leaves(state), [[key, side === 'left' ? 'right' : 'left']]);
  assert.ok(commands.flipLeafHinge(key));
  assert.deepEqual(leaves(state), [[key, side]], 'and back');
  assert.equal(commands.flipLeafHinge('9.0.0'), false, 'a leaf that is not there');
  commands.flipLeafHinge(key);
  const loaded = projectToScene(deserializeProject(save(scene(state))))!.wardrobes[0]!.state;
  assert.deepEqual(leaves(loaded), leaves(state));
  assert.deepEqual(frontsProblems(state.fronts!), []);
});

test('an opening splits into two leaves and back into one; the gone leaf\'s settings go with it', () => {
  const state = hinged();
  let steps = 0;
  const commands = createDesignCommands(() => state, { checkpoint: () => { steps++; } });
  assert.ok(commands.setOpeningLeaves('0.0.0', 2));
  assert.equal(steps, 1);
  assert.deepEqual(leaves(state).map(([k]) => k), ['0.0.0', '0.0.1']);
  commands.flipLeafHinge('0.0.1');
  assert.equal(state.fronts?.leaves?.['0.0.1']?.hinge, 'left');
  assert.equal(commands.setOpeningLeaves('0.0.1', 2), false, 'already two: nothing to do, no undo step');
  assert.equal(commands.setOpeningLeaves('0.0.0', 3), false, 'no more than MAX_LEAVES');
  assert.equal(commands.setOpeningLeaves('0.0.0', 0), false);
  steps = 0;
  assert.ok(commands.setOpeningLeaves('0.0.1', 1));
  assert.equal(steps, 1);
  assert.deepEqual(leaves(state).map(([k]) => k), ['0.0.0']);
  assert.ok(!('0.0.1' in (state.fronts?.leaves ?? {})), 'the second leaf\'s hinge is not kept');
  assert.deepEqual(frontsProblems(state.fronts!), []);
});

test('no doors, no leaf to change', () => {
  const state = { ...hinged(), doors: 'none' } as EditorState;
  const commands = createDesignCommands(() => state);
  assert.equal(commands.flipLeafHinge('0.0.0'), false);
  assert.equal(commands.setOpeningLeaves('0.0.0', 2), false);
  assert.equal(state.fronts, undefined);
});
