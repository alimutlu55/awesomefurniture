import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShapeInspector } from '../../src/presentation/editor/shape-inspector';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createEditorModel } from '../../src/application/projects/editor-model';

test('switching back to Regular keeps the active reshape session and its handles available', () => {
  const model = createEditorModel(), selectionState = { shapeEditing: true, focusOn: true };
  const inspector = createShapeInspector({ dom: {} as never, model,
    sceneCommands: createSceneCommands(() => model.scene), picking: {} as never, selectionState,
    callbacks: { refresh() {}, rebuild() {}, histUI() {} },
  });
  inspector.chooseTemplate('sloped');
  inspector.chooseTemplate('regular');
  assert.equal(model.activeCabinet().state.shape, undefined);
  assert.equal(selectionState.shapeEditing, true);
  assert.equal(inspector.handles().length, 4);
  inspector.nudge(0, 0, -10);
  assert.equal(model.activeCabinet().state.shape?.top[0]?.y, 220, 'the next edit works in the same session');
  assert.equal(selectionState.shapeEditing, true);
});
