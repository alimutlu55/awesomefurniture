import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createStudioEditor } from '../../src/presentation/editor/studio-editor';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { addOpening, moveWallAxis, translateStudio } from '../../src/domain/studio/studio-edit';
import { wallLine } from '../../src/domain/studio/studio';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createProject } from '../../src/domain/project/project';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';

function setup() {
  const model = createEditorModel();
  model.scene.studio = translateStudio(addOpening(createStudio('wall'), 'w1', 'window')!, 0, -100);
  let checkpoints = 0;
  const history = { checkpoint: () => { checkpoints++; } };
  const commands = createSceneCommands(() => model.scene, { report() {}, checkpoint: history.checkpoint });
  const editor = createStudioEditor({ model, sceneCommands: commands, history,
    selectionState: { room: { kind: 'wall', id: 'w1' }, focusOn: false },
    picking: { groundPoint: () => ({ x: 0, z: 0 }), screenPoint: p => ({ x: p.x + p.z * .5, y: -p.y + p.z * .5 }) },
    callbacks: { selectionChanged() {}, redraw() {}, refresh() {}, histUI() {}, report() {} },
  });
  return { model, editor, checkpoints: () => checkpoints };
}

for (const axis of ['x', 'y', 'z'] as const) test(`wall ${axis} grip moves in both directions; drag is one undo step and cancellation restores it`, () => {
  const s = setup(), before = s.model.snapshot(), original = s.model.scene.studio!;
  const h = s.editor.handles().find(h => h.axis === axis)!;
  assert.ok(h);
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  const pointer = (x: number, y: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, shiftKey: true, preventDefault() {}, stopPropagation() {} }) as PointerEvent;
  const event = axis === 'x' ? pointer(40, 0) : axis === 'y' ? pointer(0, -40) : pointer(20, 20);
  s.editor.begin(pointer(0, 0), h, target);
  s.editor.move(event);
  s.editor.move(event);
  s.editor.end();
  assert.equal(s.checkpoints(), 1);
  const moved = s.model.scene.studio!;
  if (axis === 'y') assert.equal(moved.walls[0]!.y, 40);
  else assert.equal(moved.corners[0]![axis] - original.corners[0]![axis], 40);
  assert.equal(wallLine(moved, moved.walls[0]!)!.length, 400);
  assert.equal(moved.openings[0]!.offset, original.openings[0]!.offset);
  assert.equal(s.editor.nudge(h, 'ArrowLeft', true), true);
  const current = s.model.snapshot();
  s.editor.begin(pointer(0, 0), s.editor.handles().find(h => h.axis === axis)!, target);
  s.editor.move(event);
  s.editor.end(true);
  assert.equal(s.model.snapshot(), current);
  s.model.restore(before);
  assert.deepEqual(s.model.scene.studio, original);
});

test('wall elevation persists, collision boxes follow it, and below-floor moves are rejected', () => {
  const s = setup();
  const lifted = moveWallAxis(s.model.scene.studio!, 'w1', 'y', 300)!;
  assert.equal(studioObstacles(lifted)[0]!.y, 300);
  assert.deepEqual(studioProblems(lifted), []);
  assert.match(studioProblems(moveWallAxis(lifted, 'w1', 'y', -301)!).join(), /above the floor/);
  s.model.scene.studio = lifted;
  const saved = serializeProject(sceneToProject(createProject('p', 'P'), s.model.scene as never));
  assert.deepEqual(projectToScene(deserializeProject(saved))!.studio, lifted);
  s.model.scene.studio = createStudio('wall');
  const legacy = serializeProject(sceneToProject(createProject('p', 'P'), s.model.scene as never));
  assert.deepEqual(projectToScene(deserializeProject(legacy))!.studio, s.model.scene.studio);
});

test('axis movement keeps shared corners joined and refuses wardrobe collisions', () => {
  const room = createStudio('bedroom'), moved = moveWallAxis(room, 'w1', 'x', 20)!;
  assert.equal(wallLine(moved, moved.walls[1]!)!.a.x, wallLine(room, room.walls[1]!)!.a.x + 20);
  const s = setup();
  s.model.scene.studio = translateStudio(s.model.scene.studio!, 0, 64);
  assert.equal(s.editor.nudge(s.editor.handles().find(h => h.axis === 'z')!, 'ArrowUp', true), false);
  assert.equal(s.checkpoints(), 0);
});
