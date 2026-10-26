import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { rectangleStudio } from '../../src/domain/studio/studio-templates';
import { wallFace, wallLine, type Studio } from '../../src/domain/studio/studio';
import { setInsideLength } from '../../src/domain/studio/studio-edit';
import { bindSizeSlider } from '../../src/presentation/editor/size-control';

const cabinet = (id: number, x: number, z: number) => ({ id, name: 'Cabinet', x, y: 0, z, angle: 0,
  state: { ...createEditorState(), ...createKitchenDesign('base') } });
const corner = (free: 'a' | 'b'): Studio => free === 'a' ? {
  template: 'custom', corners: [{ id: 'c1', x: -176, z: 260 }, { id: 'c2', x: -176, z: -74 }, { id: 'c3', x: 241, z: -74 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 12, height: 270 }, { id: 'w2', a: 'c2', b: 'c3', thickness: 12, height: 270 }], openings: [],
} : {
  template: 'custom', corners: [{ id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 334, z: 0 }, { id: 'c3', x: 0, z: 417 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', thickness: 12, height: 270 }, { id: 'w2', a: 'c3', b: 'c1', thickness: 12, height: 270 }], openings: [],
};
function fixture(studio: Studio, wardrobes: ReturnType<typeof cabinet>[] = []) {
  const model = createEditorModel({ studio, wardrobes, activeWardrobe: wardrobes[0]?.id ?? 0, nextWardrobeId: wardrobes.length + 1 });
  model.snapshot(); // Establish the stable identities a saved editor scene already has.
  const checkpoints: string[] = [], messages: string[] = [];
  const history = createSceneHistory(() => model.snapshot(), s => model.restore(s));
  const commands = createSceneCommands(() => model.scene, { report: m => messages.push(m), checkpoint: (s = model.snapshot()) => {
    checkpoints.push(s); history.checkpoint(s);
  } });
  const length = () => wallFace(model.scene.studio!, model.scene.studio!.walls.find(w => w.id === 'w1')!)!.length;
  return { model, commands, history, checkpoints, messages, length };
}

for (const free of ['a', 'b'] as const) test(`3280 to 3270 mm moves free end ${free}, preserving the inner corner and furniture`, () => {
  const room = corner(free), f = fixture(room, [free === 'a' ? cabinet(1, -94.5, -39) : cabinet(1, 36, 35)]);
  const before = structuredClone(f.model.scene), original = room.walls.find(w => w.id === 'w1')!;
  if (free === 'a') assert.ok(f.commands.studioProblem(setInsideLength(room, 'w1', 327)!), 'old fixed-end choice is blocked');
  assert.equal(f.length(), 328);
  assert.equal(f.commands.resizeWallLength('w1', 327), true);
  assert.equal(f.length(), 327);
  const fixed = free === 'a' ? original.b : original.a;
  assert.deepEqual(f.model.scene.studio!.corners.find(c => c.id === fixed), before.studio!.corners.find(c => c.id === fixed));
  assert.deepEqual(f.model.scene.studio!.walls[1], before.studio!.walls[1]);
  const adjacent = wallLine(f.model.scene.studio!, f.model.scene.studio!.walls[1]!)!;
  const oldAdjacent = wallLine(before.studio!, before.studio!.walls[1]!)!;
  assert.deepEqual(adjacent, oldAdjacent, 'the adjoining wall stays in its original position');
  assert.deepEqual(f.model.scene.wardrobes, before.wardrobes);
  assert.equal(f.checkpoints.length, 1); assert.deepEqual(f.messages, []);
  assert.equal(f.commands.resizeWallLength('w1', 340), true, 'the same free end can extend');
  assert.equal(f.length(), 340);
});

test('when the preferred end is blocked, the Length field can use the other end of a closed room', () => {
  const room = rectangleStudio(400, 350, 270, 12), f = fixture(room, [cabinet(1, 170, 29)]);
  const before = structuredClone(f.model.scene);
  assert.ok(f.commands.studioProblem(setInsideLength(room, 'w1', 390)!), 'right wall would cut through the cabinet');
  assert.equal(f.commands.resizeWallLength('w1', 390), true);
  assert.equal(f.length(), 390);
  assert.deepEqual(f.model.scene.studio!.corners.find(c => c.id === 'c2'), before.studio!.corners.find(c => c.id === 'c2'));
  assert.deepEqual(f.model.scene.wardrobes, before.wardrobes);
  assert.equal(f.checkpoints.length, 1); assert.deepEqual(f.messages, []);
});

test('if both ends are blocked, nothing moves and one refusal is reported', () => {
  const f = fixture(rectangleStudio(400, 350, 270, 12), [cabinet(1, -170, 29), cabinet(2, 170, 29)]);
  const before = f.model.snapshot();
  assert.equal(f.commands.resizeWallLength('w1', 390), false);
  assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0); assert.equal(f.messages.length, 1);
});

test('an opening can block the preferred free end; the other end preserves its world position', () => {
  const room: Studio = { ...corner('b'), openings: [{ id: 'o1', wall: 'w1', kind: 'window', offset: 305, width: 40, height: 90, sill: 100 }] };
  const f = fixture(room), before = wallLine(room, room.walls[0]!)!;
  const position = { x: before.a.x + before.ux * 305, z: before.a.z + before.uz * 305 };
  assert.equal(f.commands.resizeWallLength('w1', 300), true);
  assert.equal(f.length(), 300);
  const next = f.model.scene.studio!, line = wallLine(next, next.walls[0]!)!, offset = next.openings[0]!.offset;
  assert.deepEqual({ x: line.a.x + line.ux * offset, z: line.a.z + line.uz * offset }, position);
  assert.equal(f.checkpoints.length, 1); assert.deepEqual(f.messages, []);
});

for (const cancel of [false, true]) test(`wall length slider ${cancel ? 'cancellation restores the scene' : 'commits one undo step'}`, () => {
  const f = fixture(corner('a'), [cabinet(1, -94.5, -39)]), before = f.model.snapshot();
  const handlers: Record<string, () => void> = {}, range = { valueAsNumber: 328 };
  bindSizeSlider({ range: range as HTMLInputElement, model: f.model, history: { checkpoint: s => { f.checkpoints.push(s); f.history.checkpoint(s); } },
    lifetime: { listen: (_target, type, fn) => { handlers[type] = fn as () => void; } }, refresh() {},
    preview: value => { f.commands.resizeWallLength('w1', value, false, true); } });
  for (const value of [327, 326, 329]) { range.valueAsNumber = value; handlers.input!(); assert.equal(f.length(), value); }
  assert.equal(f.checkpoints.length, 0);
  if (cancel) { handlers.pointercancel!(); assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0); }
  else { handlers.change!(); assert.equal(f.checkpoints.length, 1); assert.equal(f.history.undo(), true); assert.equal(f.model.snapshot(), before); }
});

test('invalid and unchanged lengths create no edits or undo checkpoints', () => {
  const f = fixture(corner('a')), before = f.model.snapshot();
  for (const value of [NaN, Infinity, -10, 0, 10, 328, 100000]) assert.equal(f.commands.resizeWallLength('w1', value), false);
  assert.equal(f.model.snapshot(), before); assert.equal(f.checkpoints.length, 0);
});
