import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { cornerDegree, studioBounds, wallBox, wallLine } from '../../src/domain/studio/studio';
import { addWall, mergeCorners, moveWallAxis, removeWall, setWallAngle, setWallSize, pullWallFace, translateStudio, splitWall, suggestWall } from '../../src/domain/studio/studio-edit';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { snapCorner } from '../../src/presentation/editor/studio-drag';
import { createStudioEditor } from '../../src/presentation/editor/studio-editor';
import { studioObstacles } from '../../src/domain/studio/studio-obstacles';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { createProject } from '../../src/domain/project/project';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';

function setup() {
  const model = createEditorModel();
  const history = createSceneHistory(model.snapshot, model.restore);
  const messages: string[] = [];
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint(), report: m => messages.push(m) });
  return { model, history, commands, messages };
}

test('adding walls never shares corners, changes existing walls or moves wardrobes; one undo step each', () => {
  const s = setup(), before = s.model.snapshot();
  const first = s.commands.addStudioWall()!;
  assert.equal(s.model.scene.studio!.walls[0]!.independent, true);
  const original = structuredClone(s.model.scene.studio!);
  const wardrobes = structuredClone(s.model.scene.wardrobes);
  const second = s.commands.addStudioWall(first)!;
  assert.ok(second);
  const room = s.model.scene.studio!, added = room.walls.find(w => w.id === second)!;
  assert.deepEqual(room.walls[0], original.walls[0]);
  assert.deepEqual(room.corners.slice(0, 2), original.corners);
  assert.ok([added.a, added.b].every(id => cornerDegree(room, id) === 1));
  assert.deepEqual(s.model.scene.wardrobes, wardrobes);
  assert.equal(s.history.undoCount, 2);
  assert.equal(s.commands.editStudio(r => moveWallAxis(r, second, 'x', 20)), true);
  assert.deepEqual(s.model.scene.studio!.corners.slice(0, 2), original.corners);
  assert.equal(s.history.undo(), true);
  assert.equal(s.history.undo(), true);
  assert.deepEqual(s.model.scene.studio, original);
  assert.equal(s.history.undo(), true);
  assert.equal(s.model.snapshot(), before);
});

test('repeated additions choose distinct free positions instead of stacking new solids', () => {
  const s = setup();
  for (let i = 0; i < 4; i++) {
    const id = s.commands.addStudioWall();
    assert.ok(id);
    const boxes = studioObstacles(s.model.scene.studio), added = boxes.at(-1)!;
    const existing = createCabinetGeometry(() => [], () => boxes.slice(0, -1));
    assert.equal(existing.cabinetCollides(added), false);
  }
});

test('independent corners align without joining, and split solids remain independent', () => {
  const base = createStudio('wall'), room = addWall(base, 0, 100, 200, 100), w = room.walls.at(-1)!;
  const locks = { x: null, z: null, ray: null, join: null };
  assert.equal(snapCorner(room, w.a, room.corners[0]!, locks, 8).locks.join, null);
  assert.equal(mergeCorners(room, w.a, base.corners[0]!.id), null);
  const split = splitWall(room, w.id)!;
  const halves = split.walls.slice(-2);
  assert.notEqual(halves[0]!.b, halves[1]!.a);
  assert.deepEqual(studioProblems(split), []);
  const moved = moveWallAxis(split, halves[1]!.id, 'z', 50)!;
  assert.deepEqual(moved.corners.find(c => c.id === halves[0]!.b), split.corners.find(c => c.id === halves[0]!.b));
});

test('independent solids allow ceiling dimensions, overlap for joins, and retain proper collision height', () => {
  const s = setup(), id = s.commands.addStudioWall()!;
  assert.equal(s.commands.editStudio(r => setWallSize(r, id, { y: 260, height: 12, thickness: 350 })), true);
  const room = s.model.scene.studio!, w = room.walls[0]!, box = wallBox(room, w)!;
  assert.equal(box.length, 400);
  assert.equal(box.height, 12);
  assert.equal(box.thickness, 350);
  assert.equal(box.y, 260);
  assert.equal(studioBounds(room)!.height, 272);
  const collision = createCabinetGeometry(() => [], () => studioObstacles(room));
  assert.equal(collision.cabinetCollides(s.model.scene.wardrobes[0]!), false, 'wardrobe fits below slab');
  assert.equal(collision.cabinetCollides({ ...s.model.scene.wardrobes[0]!, y: 40 }), true, 'raised wardrobe hits underside');
  const intersects = addWall(room, 0, -200, 0, 200);
  assert.deepEqual(studioProblems(intersects), [], 'separate solids can overlap to construct joints');
  assert.match(studioProblems(setWallSize(room, id, { thickness: 0 })!).join(), /thickness must be/);
  assert.match(studioProblems(setWallSize(room, id, { height: 2001 })!).join(), /height must be/);
  const saved = serializeProject(sceneToProject(createProject('p', 'P'), s.model.scene as never));
  assert.deepEqual(projectToScene(deserializeProject(saved))!.studio, room);
});

test('rotation preserves the solid centre, dimensions and neighboring geometry', () => {
  const base = createStudio('bedroom'), room = addWall(base, -75, 120, 75, 120), w = room.walls.at(-1)!;
  const turned = setWallAngle(room, w.id, 90)!;
  const line = wallLine(turned, w)!;
  assert.equal(line.angle, 90);
  assert.equal(line.length, 150);
  assert.equal((line.a.x + line.b.x) / 2, 0);
  assert.equal((line.a.z + line.b.z) / 2, 120);
  assert.deepEqual(turned.corners.slice(0, base.corners.length), base.corners);
  assert.equal(setWallAngle(base, 'w1', 90), null, 'connected template keeps its topology');
});

test('arbitrary rotation and axis moves preserve exact solid dimensions', () => {
  const room = addWall({ template: 'custom', walls: [], corners: [], openings: [] }, -90, 0, 90, 0);
  let turned = setWallAngle(room, 'w1', 30)!;
  for (const axis of ['x', 'z'] as const) {
    turned = moveWallAxis(turned, 'w1', axis, 12.3)!;
    assert.ok(Math.abs(wallLine(turned, turned.walls[0]!)!.length - 180) < 1e-8);
  }
});

test('adding after removing every wall and alongside a very short wall still works', () => {
  const s = setup(), id = s.commands.addStudioWall()!;
  s.commands.editStudio(r => removeWall(r, id));
  assert.ok(s.commands.addStudioWall());
  const short = addWall({ template: 'custom', walls: [], corners: [], openings: [] }, 0, 0, 30, 0);
  assert.ok(suggestWall(short, () => true));
});

test('independent rotation grip supports drag, cancellation and one undo step', () => {
  const s = setup(), id = s.commands.addStudioWall()!;
  s.commands.editStudio(r => setWallSize(r, id, { y: 300 }));
  s.history.clear();
  let ground = { x: 100, z: -36 };
  const editor = createStudioEditor({ model: s.model, sceneCommands: s.commands, history: s.history,
    selectionState: { room: { kind: 'wall', id }, focusOn: false },
    picking: { groundPoint: () => ground, screenPoint: p => ({ x: p.x, y: p.z - p.y }) },
    callbacks: { selectionChanged() {}, redraw() {}, refresh() {}, histUI() {}, report() {} },
  });
  assert.equal(editor.handles().filter(h => h.kind === 'extend').length, 0);
  const h = editor.handles().find(h => h.kind === 'rotate')!, before = s.model.snapshot();
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  const pointer = (x: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: 0, shiftKey: false, preventDefault() {}, stopPropagation() {} }) as PointerEvent;
  editor.begin(pointer(0), h, target);
  ground = { x: 0, z: 64 };
  editor.move(pointer(50));
  editor.end();
  assert.equal(s.history.undoCount, 1);
  assert.ok(Math.abs(wallLine(s.model.scene.studio!, s.model.scene.studio!.walls[0]!)!.angle) > 80);
  assert.equal(s.history.undo(), true);
  assert.equal(s.model.snapshot(), before);
  ground = { x: 100, z: -36 };
  editor.begin(pointer(0), h, target);
  ground = { x: 0, z: 64 };
  editor.move(pointer(50));
  editor.end(true);
  assert.equal(s.model.snapshot(), before);
});

test('drawing from a template end creates private corners instead of attaching a new wall', () => {
  const s = setup();
  s.commands.placeStudio('wall');
  const original = structuredClone(s.model.scene.studio!);
  let ground = { x: 260, z: -36 };
  const editor = createStudioEditor({ model: s.model, sceneCommands: s.commands, history: s.history,
    selectionState: { room: { kind: 'wall', id: 'w1' }, focusOn: false },
    picking: { groundPoint: () => ground, screenPoint: p => ({ x: p.x, y: p.z - p.y }) },
    callbacks: { selectionChanged() {}, redraw() {}, refresh() {}, histUI() {}, report() {} },
  });
  const h = editor.handles().find(h => h.kind === 'extend' && h.id === 'c2')!;
  const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
  const pointer = (x: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: 0, shiftKey: false, preventDefault() {}, stopPropagation() {} }) as PointerEvent;
  editor.begin(pointer(0), h, target);
  ground = { x: 200, z: 150 };
  editor.move(pointer(50));
  editor.end();
  const room = s.model.scene.studio!, drawn = room.walls.at(-1)!;
  assert.equal(drawn.independent, true);
  assert.ok([drawn.a, drawn.b].every(id => !original.corners.some(c => c.id === id)));
  assert.deepEqual(room.corners.slice(0, 2), original.corners);
  assert.equal(s.history.undoCount, 2);
});


test('pulling either face in all three dimensions fixes the opposite face and preserves neighbours', () => {
  const base = addWall(createStudio('wall'), 0, 120, 200, 120);
  const room = setWallSize(setWallAngle(base, base.walls.at(-1)!.id, 30)!, base.walls.at(-1)!.id, { y: 100 })!;
  const w = room.walls.at(-1)!, line = wallLine(room, w)!, box = wallBox(room, w)!;
  for (const dimension of ['length', 'height', 'depth'] as const) for (const side of [-1, 1] as const) {
    const next = pullWallFace(room, w.id, dimension, side, 40)!;
    const changed = next.walls.at(-1)!, after = wallBox(next, changed)!, edge = wallLine(next, changed)!;
    assert.deepEqual(next.walls[0], room.walls[0]);
    assert.deepEqual(next.corners.slice(0, 2), room.corners.slice(0, 2));
    if (dimension === 'length') {
      assert.ok(Math.abs(edge.length - line.length - 40) < 1e-8);
      assert.deepEqual(side === 1 ? edge.a : edge.b, side === 1 ? line.a : line.b);
    } else if (dimension === 'height') {
      assert.equal(changed.height, w.height + 40);
      assert.equal(side === 1 ? after.y : after.y + after.height, side === 1 ? box.y : box.y + box.height);
    } else {
      assert.equal(after.thickness, box.thickness + 40);
      // The other face has the same signed projection on the depth normal.
      const position = (b: typeof box) => b.x * line.nx + b.z * line.nz - side * b.thickness / 2;
      assert.ok(Math.abs(position(after) - position(box)) < 1e-8);
    }
    assert.deepEqual(studioProblems(next), []);
  }
});

test('face drags on raised solids support all sides, undo, cancellation and floor limits', () => {
  for (const dimension of ['length', 'height', 'depth'] as const) for (const side of [-1, 1] as const) {
    const s = setup();
    const room = setWallSize(addWall(translateStudio(createStudio('wall'), 0, -200), 600, 600, 800, 600), 'w2', { y: 100 })!;
    s.model.scene.studio = room;
    const editor = createStudioEditor({ model: s.model, sceneCommands: s.commands, history: s.history,
      selectionState: { room: { kind: 'wall', id: 'w2' }, focusOn: false },
      picking: { groundPoint: () => ({ x: 0, z: 0 }), screenPoint: p => ({ x: p.x + p.z * .5, y: -p.y + p.z * .4 }) },
      callbacks: { selectionChanged() {}, redraw() {}, refresh() {}, histUI() {}, report() {} },
    });
    const faces = editor.handles().filter(h => h.kind === 'face');
    assert.equal(faces.length, 6);
    assert.equal(editor.handles().filter(h => h.kind === 'corner').length, 0);
    const h = faces.find(h => h.dimension === dimension && h.side === side)!, before = s.model.snapshot();
    const dx = h.nx! * 40 + h.nz! * 20, dy = h.nz! * 16 - (dimension === 'height' ? side * 40 : 0);
    const target = { setPointerCapture() {}, hasPointerCapture: () => false } as unknown as HTMLElement;
    const pointer = (x: number, y: number) => ({ pointerId: 1, button: 0, clientX: x, clientY: y, shiftKey: false, preventDefault() {}, stopPropagation() {} }) as PointerEvent;
    editor.begin(pointer(0, 0), h, target); editor.move(pointer(dx, dy)); editor.end();
    assert.deepEqual(s.model.scene.studio, pullWallFace(room, 'w2', dimension, side, 40));
    assert.equal(s.history.undoCount, 1);
    assert.equal(s.history.undo(), true); assert.equal(s.model.snapshot(), before);
    editor.begin(pointer(0, 0), h, target); editor.move(pointer(dx, dy)); editor.end(true);
    assert.equal(s.model.snapshot(), before);
    if (dimension === 'height' && side === -1) {
      editor.begin(pointer(0, 0), h, target); editor.move(pointer(0, 500)); editor.end();
      assert.ok((s.model.scene.studio!.walls.at(-1)!.y ?? 0) >= 0);
      assert.ok((s.model.scene.studio!.walls.at(-1)!.y ?? 0) < .01);
    }
  }
});
