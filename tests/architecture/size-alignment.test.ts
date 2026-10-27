import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createTactileEdits } from '../../src/application/commands/tactile-edits';
import { createEditorState } from '../../src/application/projects/editor-state';
import { sizeTargets } from '../../src/application/commands/align-commands';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { translateStudio } from '../../src/domain/studio/studio-edit';

/** Alignment targets remain available for explicit actions; Size sliders preserve the requested millimetres. */

function fixture() {
  const model = createEditorModel();
  // A bedroom: the back wall's room face at z = -30, side walls at x = -200 and x = 200 inside, ceiling 260.
  model.scene.studio = translateStudio(createStudio('bedroom'), 0, -30);
  model.scene.wardrobes = [
    { id: 1, name: 'W1', x: -80, y: 0, z: 0, angle: 0, state: { ...createEditorState(), w: 200, h: 200, d: 60 } },
    { id: 2, name: 'W2', x: 90, y: 0, z: 0, angle: 0, state: { ...createEditorState(), w: 120, h: 230, d: 60, n: 1 } }];
  model.scene.activeWardrobe = 1;
  return { model, edits: createTactileEdits({ model, checkpoint() {} }) };
}

test('the sizes that line a wardrobe up: level with its neighbour, touching, filling the gap', () => {
  const { model } = fixture(), w1 = model.scene.wardrobes[0]!;
  const h = sizeTargets(model.scene, w1, 'h').map(t => t.label + '@' + t.v).sort();
  assert.deepEqual(h, ['Level with W2@230'], 'not up to the ceiling: the slider\'s own end is the ceiling as the editor sees it');
  // 20 cm to the side wall on the left, 10 cm to W2 on the right.
  const w = sizeTargets(model.scene, w1, 'w').map(t => t.label + '@' + t.v).sort();
  assert.deepEqual(w, ['Filling the gap@230', 'Touching@220'].sort());
  model.scene.wardrobes[1]!.state.d = 50; model.scene.wardrobes[1]!.z = -5;
  assert.deepEqual(sizeTargets(model.scene, w1, 'd').map(t => t.label + '@' + t.v), ['Front in line with W2@50'], 'backs in line: the same depth puts the fronts in line');
});

test('a slider preserves every millimetre near alignment and never holds a nearby target', () => {
  const { model, edits } = fixture();
  edits.beginDimension('h');
  assert.equal(edits.previewDimension(29.6), 229.6, '4 mm below its neighbour stays 4 mm below');
  assert.equal(edits.previewDimension(30.7), 230.7, '7 mm above is not held at the old alignment');
  assert.equal(edits.previewDimension(29), 229, 'a centimetre away: the slider value is kept');
  assert.equal(edits.previewDimension(15), 215, 'far from any line: the slider value');
  edits.finish();
  assert.equal(model.activeCabinet().state.h, 215);
  edits.beginDimension('w');
  assert.equal(edits.previewDimension(19.7), 219.7, 'the remaining gap is preserved until contact is requested');
  edits.finish(true);
});

test('a size the resize cannot take exactly is never caught', () => {
  const { model, edits } = fixture();
  // Filling the whole gap would need the wardrobe to slide left as it grows; a wardrobe grows about its middle, so it
  // meets W2 at 220 cm first. The 230 cm line is never caught: it stops where the resize can go.
  assert.ok(sizeTargets(model.scene, model.activeCabinet(), 'w').some(t => t.kind === 'fill' && t.v === 230));
  edits.beginDimension('w');
  assert.equal(edits.previewDimension(29.7), 220);
  edits.finish(true);
  assert.equal(model.activeCabinet().state.w, 200, 'cancelling restores it');
});
