import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { designSpecJsonSchema, parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { SHAPE_TEMPLATES, createFromTemplate } from '../../src/domain/wardrobe/shape/shape-templates';
import { maxHeight } from '../../src/domain/wardrobe/shape/wardrobe-shape';
import { KITCHEN_PRESETS, createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { resolveFronts, type DesignFronts } from '../../src/domain/wardrobe/front-styles';
import type { EditorScene, EditorState } from '../../src/application/projects/editor-scene';

/** Fronts (style, overlay, reveal, per-opening settings) save, load and travel in specs; defaults are never written,
 * and every design saved before fronts existed opens and saves to the same bytes. */

const scene = (...states: EditorState[]): EditorScene =>
  ({ wardrobes: states.map((state, i) => ({ id: i + 1, name: `W${i + 1}`, x: i * 300, y: 0, z: 0, angle: 0, state })), activeWardrobe: 1, nextWardrobeId: states.length + 1 });
const save = (s: EditorScene) => serializeProject(sceneToProject(createProject('p', 'P'), s));
const reopen = (json: string) => projectToScene(deserializeProject(json))!;

/** Designs as the editor makes them: every wardrobe shape, planned by Auto design, and every kitchen preset. */
function fixtures(): EditorState[] {
  const wardrobes = SHAPE_TEMPLATES.map(t => {
    const state = createEditorState(), start = createFromTemplate(t.id, { w: state.w, h: state.h, maxN: 6 });
    Object.assign(state, { shape: start.shape, n: start.n, wt: start.wt, h: maxHeight(start.shape) });
    const best = generateDesignedLayouts(createWardrobeGeometry(() => state).plannerConfig())[0];
    if (best) createDesignCommands(() => state).applyProposal(best as never);
    return state;
  });
  const kitchens = KITCHEN_PRESETS.map(p => Object.assign(createEditorState(), createKitchenDesign(p.unit as never, p.key)) as EditorState);
  return [createEditorState(), ...wardrobes, ...kitchens];
}

test('fronts · every fixture project opens and saves to the same bytes', () => {
  for (const state of fixtures()) {
    const json = save(scene(state));
    assert.ok(!json.includes('"fronts"'), 'a design that never set its fronts writes none');
    assert.equal(save(reopen(json)), json, `${state.shape?.template ?? state.unit ?? 'regular'}: unchanged after load and save`);
  }
});

test('fronts · style, overlay, reveal and per-opening settings round-trip', () => {
  const state = createEditorState();
  Object.assign(state, { n: 2, wt: [100, 100, 100, 100, 100, 100] });
  const fronts: DesignFronts = { style: 'shaker', overlay: 'inset', reveal: 3, leaves: { '0.0': { leaves: 2 }, '1.0.1': { hinge: 'left' } } };
  state.fronts = fronts;
  const json = save(scene(state)), back = reopen(json).wardrobes[0]!.state;
  assert.deepEqual(back.fronts, fronts);
  assert.equal(save(reopen(json)), json, 'stable after a second save');
});

test('fronts · defaults are never written', () => {
  const plain = createEditorState(), explicit = createEditorState();
  explicit.fronts = { style: 'slab', overlay: 'full', reveal: 2, leaves: { '0.0': {} } };
  assert.equal(save(scene(explicit)), save(scene(plain)));
  const shaker = createEditorState();
  shaker.fronts = { style: 'shaker', overlay: 'full', reveal: 2 };
  assert.deepEqual(JSON.parse(save(scene(shaker))).wardrobes[0].fronts, { style: 'shaker' }, 'only what differs from the default');
});

test('fronts · unknown values are refused with a clear error', () => {
  const bad = (fronts: unknown) => {
    const project = JSON.parse(save(scene(createEditorState())));
    project.wardrobes[0].fronts = fronts;
    try { deserializeProject(JSON.stringify(project)); } catch (e) { return (e as { issues: { message: string }[] }).issues.map(i => i.message).join('\n'); }
    return 'accepted';
  };
  assert.match(bad({ style: 'gothic' }), /Unknown front style "gothic": use slab, shaker, profiled, rail/);
  assert.match(bad({ overlay: 'flush' }), /Unknown front overlay "flush": use full, half, inset/);
  assert.match(bad({ reveal: 5 }), /Unknown reveal \(mm\) 5: use 2, 3, 4/);
  assert.match(bad({ style: 'shaker', overlay: 'half' }), /shaker front cannot be hung half: use full, inset/);
  assert.match(bad({ leaves: { '4.0': { leaves: 2 } } }), /no bay 4/);
  assert.match(bad({ leaves: { left: {} } }), /"left" is not a door opening/);
  assert.match(bad({ leaves: { '0.0': { leaves: 9 } } }), /1 to 4 leaves/);
  assert.match(bad({ leaves: { '0.0.1': { leaves: 2 } } }), /on the opening \(0\.0\)/);
  assert.match(bad({ colour: 'red' }), /colour/);
});

test('fronts · a design saved before styles keeps the style its materials name', () => {
  const state = createEditorState();
  state.materials = { ...state.materials!, frontProfile: 'micro_shaker' };
  assert.equal(resolveFronts(state).style, 'shaker');
  assert.deepEqual(resolveFronts(createEditorState()), { style: 'slab', overlay: 'full', reveal: 2, leaves: {} });
});

test('fronts · a spec accepts, validates and builds them', () => {
  const spec = parseDesignSpec({ specVersion: 1, wardrobes: [{ width: 200, fronts: { style: 'profiled', reveal: 4, leaves: { '0.0': { hinge: 'right' } } } }] });
  const built = buildFromSpec(spec, 'p');
  assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
  assert.deepEqual(built.project.wardrobes[0]!.fronts, { style: 'profiled', reveal: 4, leaves: { '0.0': { hinge: 'right' } } });
  assert.throws(() => parseDesignSpec({ specVersion: 1, wardrobes: [{ fronts: { style: 'gothic' } }] }), /wardrobes\.0\.fronts\.style: Unknown front style "gothic"/);
  assert.throws(() => parseDesignSpec({ specVersion: 1, wardrobes: [{ fronts: { style: 'rail', overlay: 'inset' } }] }), /wardrobes\.0\.fronts: A handle rail front cannot be hung inset/);
  const far = buildFromSpec(parseDesignSpec({ specVersion: 1, wardrobes: [{ width: 100, fronts: { leaves: { '5.0': { leaves: 2 } } } }] }), 'p');
  assert.equal(far.ok, false);
  assert.deepEqual(!far.ok && far.problems.map(p => p.path), ['wardrobes[0].fronts']);
  const schema = JSON.stringify(designSpecJsonSchema());
  assert.match(schema, /"fronts"/);
  assert.match(schema, /How the fronts are made/);
});
