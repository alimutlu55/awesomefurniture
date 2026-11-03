import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorModel } from '../../src/application/projects/editor-model';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { createSceneHistory } from '../../src/application/history/scene-history';
import { createStudio } from '../../src/domain/studio/studio-templates';
import { cornerDegree, wallLine, type Studio } from '../../src/domain/studio/studio';
import { studioProblems } from '../../src/domain/studio/studio-validation';
import { createStudio2DGestures } from '../../src/presentation/editor/studio-2d-gestures';
import { createCabinetGeometry } from '../../src/domain/geometry/cabinet-geometry.js';
import { renderFurniture, createTransform } from '../../src/presentation/editor/studio-2d-canvas';
import type { RoomSelection } from '../../src/presentation/viewport/studio-renderer';

globalThis.requestAnimationFrame = cb => { cb(0); return 0; };

function fixture(studio: Studio = createStudio('wall'), zoom = 1, furniture = false) {
  const wardrobes = furniture ? [{ id: 1, name: 'Cabinet', x: 0, y: 0, z: 120, angle: 0, state: createEditorState() }] : [];
  const model = createEditorModel({ studio, wardrobes, activeWardrobe: 1, nextWardrobeId: 2 }, () => crypto.randomUUID());
  const history = createSceneHistory(() => model.snapshot(), s => model.restore(s));
  const commands = createSceneCommands(() => model.scene, { checkpoint: () => history.checkpoint(), report: () => {} });
  let transform = { width: 1200, height: 900, panX: 0, panZ: 150, zoom };
  let selection: RoomSelection = null;
  let commits = 0;
  const gestures = createStudio2DGestures({
    getStudio: () => model.scene.studio!, getWardrobes: () => model.scene.wardrobes,
    getActiveWardrobe: () => model.scene.activeWardrobe, setActiveWardrobe: id => { model.scene.activeWardrobe = id; },
    getSelection: () => selection, setSelection: s => { selection = s; },
    editStudio: commands.editStudio, snapshot: () => model.snapshot(), restore: s => model.restore(s),
    checkpoint: s => history.checkpoint(s), committed: () => { commits++; }, refresh: () => {}, fitScene: () => {},
    previewTranslation: commands.previewTranslation, settleCabinet: commands.settleCabinet,
    studioProblem: commands.studioProblem,
    previewStudio: (s, carry) => { model.scene.studio = s; if (carry) commands.carryWardrobes(carry, s); },
    getTransform: () => transform, setTransform: fn => { transform = fn(transform); },
    standingAgainst: commands.standingAgainst,
  });
  const surface = { getBoundingClientRect: () => ({ left: 0, top: 0 }) } as Element;
  const event = (x: number, z: number, attribute = '', id = '', pointerId = 1) => {
    const p = createTransform(transform).toScreen({ x, z });
    const hit = { closest: (selector: string) => selector === `[${attribute}]` ? { getAttribute: () => id } : null };
    return { clientX: p.x, clientY: p.z, pointerId, target: hit } as unknown as PointerEvent;
  };
  const drag = (from: [number, number], to: [number, number], attribute: string, id: string) => {
    gestures.onPointerDown(event(...from, attribute, id), surface);
    gestures.onPointerMove(event(...to), surface);
    gestures.onPointerUp(event(...to));
  };
  return { model, history, gestures, surface, event, drag, commits: () => commits };
}

test('2D furniture sweeps stop at walls even when a single pointer move goes beyond them', () => {
  const f = fixture(createStudio('bedroom'), 0.35, true);
  const before = f.model.snapshot();
  f.drag([20, 130], [20, -500], 'data-cabinet-id', '1');
  assert.ok(f.model.scene.wardrobes[0]!.z >= 30 - .01, 'the cabinet stays on the room side');
  assert.equal(f.model.scene.wardrobes[0]!.x, 0, 'keeps the grabbed offset');
  const after = f.model.snapshot();
  assert.notEqual(after, before);
  assert.equal(f.history.undoCount, 1);
  f.history.undo(); assert.equal(f.model.snapshot(), before);
  f.history.redo(); assert.equal(f.model.snapshot(), after);
  assert.equal(f.commits(), 1, 'history UI and rendering are refreshed on commit');
});

test('2D furniture cannot pass through another cabinet', () => {
  const f = fixture(createStudio('bedroom'), 1, true);
  const first = f.model.scene.wardrobes[0]!;
  f.model.scene.wardrobes.push({ ...structuredClone(first), id: 2, z: 260 });
  f.drag([0, 120], [0, 500], 'data-cabinet-id', '1');
  assert.ok(first.z <= 200 + .01);
});

test('wall and opening drags each undo and redo their original scene in one step', () => {
  for (const kind of ['wall', 'opening']) {
    const f = fixture(createStudio('bedroom'));
    const before = f.model.snapshot();
    if (kind === 'wall') f.drag([0, -6], [0, -46], 'data-wall-id', 'w1');
    else {
      const opening = f.model.scene.studio!.openings[0]!;
      f.drag([206, 284], [206, 230], 'data-opening-id', opening.id);
    }
    const after = f.model.snapshot();
    assert.notEqual(after, before, kind);
    assert.equal(f.history.undoCount, 1, kind);
    f.history.undo(); assert.equal(f.model.snapshot(), before, kind);
    f.history.redo(); assert.equal(f.model.snapshot(), after, kind);
  }
});

function separateWalls(): Studio {
  return { template: 'custom', corners: [
    { id: 'c1', x: 0, z: 0 }, { id: 'c2', x: 200, z: 0 },
    { id: 'c3', x: 300, z: -150 }, { id: 'c4', x: 300, z: 150 },
  ], walls: [
    { id: 'w1', a: 'c1', b: 'c2', thickness: 12, height: 260 },
    { id: 'w2', a: 'c3', b: 'c4', thickness: 12, height: 260 },
  ], openings: [] };
}

for (const zoom of [0.25, 0.6, 2.5]) {
  test(`a wall end joins the middle of another wall at zoom ${zoom}, with Undo and Redo`, () => {
    const f = fixture(separateWalls(), zoom);
    const before = f.model.snapshot();
    f.drag([200, 0], [300 - 10 / zoom, 0], 'data-corner-id', 'c2');
    const joined = f.model.scene.studio!;
    assert.deepEqual(studioProblems(joined), []);
    assert.equal(joined.walls.length, 3, 'splits the receiving wall for a shared T junction');
    assert.ok(joined.corners.some(c => Math.abs(c.x - 300) < .1 && Math.abs(c.z) < .1 && cornerDegree(joined, c.id) === 3));
    const after = f.model.snapshot();
    assert.equal(f.history.undoCount, 1);
    f.history.undo(); assert.equal(f.model.snapshot(), before);
    f.history.redo(); assert.equal(f.model.snapshot(), after);
  });

  test(`free wall ends share one corner after a join at zoom ${zoom}`, () => {
    const room = separateWalls();
    const f = fixture({ ...room, corners: room.corners.map(c => c.id === 'c3' ? { ...c, z: 0 } : c) }, zoom);
    f.drag([200, 0], [300 - 10 / zoom, 0], 'data-corner-id', 'c2');
    const joined = f.model.scene.studio!;
    assert.equal(joined.corners.length, 3);
    assert.equal(joined.walls[0]!.b, joined.walls[1]!.a);
    assert.deepEqual(studioProblems(joined), []);
  });
}

test('cancelled furniture and corner drags restore the scene without creating history', () => {
  for (const kind of ['furniture', 'corner']) {
    const f = fixture(createStudio('bedroom'), 1, true);
    const before = f.model.snapshot();
    const e = kind === 'furniture' ? f.event(0, 120, 'data-cabinet-id', '1') : f.event(-206, -6, 'data-corner-id', 'c1');
    f.gestures.onPointerDown(e, f.surface);
    f.gestures.onPointerMove(f.event(50, 150), f.surface);
    f.gestures.onPointerUp(undefined, true);
    assert.equal(f.model.snapshot(), before);
    assert.equal(f.history.undoCount, 0);
  }
});

test('starting or cancelling a drawn wall and tapping a corner create no undo entries', () => {
  const f = fixture();
  f.gestures.setTool('wall');
  f.gestures.onPointerDown(f.event(0, 0), f.surface);
  f.gestures.onPointerUp();
  assert.equal(f.history.undoCount, 0);
  f.gestures.cancelDrawing();
  f.gestures.onPointerDown(f.event(-200, -6, 'data-corner-id', 'c1'), f.surface);
  f.gestures.onPointerUp();
  assert.equal(f.history.undoCount, 0);
});

test('a drawn wall joins an existing wall at low zoom and creates exactly one undo step', () => {
  const f = fixture(createStudio('wall'), 0.25);
  const before = f.model.snapshot();
  f.gestures.setTool('wall');
  f.gestures.onPointerDown(f.event(0, 200), f.surface);
  f.gestures.onPointerUp();
  assert.equal(f.history.undoCount, 0);
  f.gestures.onPointerDown(f.event(0, -6 + 10 / 0.25), f.surface);
  f.gestures.onPointerUp();
  const room = f.model.scene.studio!;
  assert.equal(room.walls.length, 3);
  assert.ok(room.corners.some(c => c.x === 0 && c.z === -6 && cornerDegree(room, c.id) === 3));
  assert.deepEqual(studioProblems(room), []);
  assert.equal(f.history.undoCount, 1);
  const after = f.model.snapshot();
  f.history.undo(); assert.equal(f.model.snapshot(), before);
  f.history.redo(); assert.equal(f.model.snapshot(), after);
});

test('moving a wall carries its cabinet and restores both on Undo and Redo', () => {
  const f = fixture(createStudio('bedroom'), 0.4, true);
  f.model.scene.wardrobes[0]!.z = 30;
  const before = f.model.snapshot();
  f.drag([0, -6], [0, -56], 'data-wall-id', 'w1');
  assert.ok(Math.abs(f.model.scene.wardrobes[0]!.z + 20) < .1);
  const after = f.model.snapshot();
  assert.equal(f.history.undoCount, 1);
  f.history.undo(); assert.equal(f.model.snapshot(), before);
  f.history.redo(); assert.equal(f.model.snapshot(), after);
});


test('rotated 2D furniture footprints and fronts match the collision geometry', () => {
  const f = fixture(createStudio('bedroom'), 1, true);
  const cabinet = f.model.scene.wardrobes[0]!;
  const collision = createCabinetGeometry(() => [cabinet]);
  for (const angle of [30, 90, 135, 270]) {
    cabinet.angle = angle;
    const markup = renderFurniture([cabinet], cabinet.id);
    const points = markup.match(/<polygon points="([^"]+)"/)![1]!.split(' ').map(p => p.split(',').map(Number));
    const axes = collision.cabinetAxes(cabinet);
    const u = axes[0]!, v = axes[1]!;
    for (const [i, [sx, sz]] of [[-1, -1], [1, -1], [1, 1], [-1, 1]].entries()) {
      assert.ok(Math.abs(points[i]![0]! - (cabinet.x + sx! * cabinet.state.w / 2 * u.x + sz! * cabinet.state.d / 2 * v.x)) < 1e-6);
      assert.ok(Math.abs(points[i]![1]! - (cabinet.z + sx! * cabinet.state.w / 2 * u.z + sz! * cabinet.state.d / 2 * v.z)) < 1e-6);
    }
  }
});

test('the plus handle adds a connected wall at a free end with one undo step', () => {
  const f = fixture(createStudio('wall'), .4);
  const before = f.model.snapshot();
  f.gestures.onPointerDown(f.event(320, -6, 'data-extend-id', 'c2'), f.surface);
  f.gestures.onPointerUp();
  const room = f.model.scene.studio!;
  assert.equal(room.walls.length, 2);
  assert.equal(room.walls[1]!.a, 'c2');
  assert.equal(room.corners.at(-1)!.x, 350);
  assert.deepEqual(studioProblems(room), []);
  assert.equal(f.history.undoCount, 1);
  const after = f.model.snapshot();
  f.history.undo(); assert.equal(f.model.snapshot(), before);
  f.history.redo(); assert.equal(f.model.snapshot(), after);
});

test('add-wall handles only appear at open ends, and do not split existing walls', async () => {
  const { renderHandles } = await import('../../src/presentation/editor/studio-2d-canvas');
  const open = createStudio('wall');
  assert.equal((renderHandles(open, null, .3).match(/data-extend-id=/g) ?? []).length, 2);
  assert.ok(!renderHandles(open, null).includes('data-wall-split-id'));
  const closed = createStudio('bedroom');
  assert.equal((renderHandles(closed, null).match(/data-extend-id=/g) ?? []).length, 0);
  const f = fixture(closed);
  assert.equal(f.gestures.extendWall('c1'), false);
  assert.equal(f.history.undoCount, 0);
});

test('a near-miss on a window slides it without moving its wall and records one undo step', () => {
  const f = fixture(createStudio('bedroom'), .35), studio = f.model.scene.studio!;
  const window = studio.openings.find(o => o.kind === 'window')!, line = wallLine(studio, studio.walls.find(w => w.id === window.wall)!)!;
  const at = { x: line.a.x + line.ux * window.offset + line.nx * (6 + 18 / .35),
    z: line.a.z + line.uz * window.offset + line.nz * (6 + 18 / .35) };
  const before = f.model.snapshot();
  f.drag([at.x, at.z], [at.x + line.ux * 30, at.z + line.uz * 30], '', '');
  assert.equal(f.model.scene.studio!.openings.find(o => o.id === window.id)!.offset, window.offset + 30);
  assert.deepEqual(f.model.scene.studio!.corners, studio.corners);
  assert.equal(f.history.undoCount, 1); f.history.undo(); assert.equal(f.model.snapshot(), before);
});

test('fixtures slide on the plan in one undo step and pointer cancellation restores the whole scene', async () => {
  const { addFixture } = await import('../../src/domain/studio/fixtures/fixture-edit');
  const { FIXTURES } = await import('../../src/domain/studio/fixtures/fixture-kinds');
  const { rectangleStudio } = await import('../../src/domain/studio/studio-templates');
  const studio = addFixture(rectangleStudio(600, 500), 'w1', FIXTURES[0]!.key, 200)!;
  const id = studio.fixtures![0]!.id, f = fixture(studio, .35), before = f.model.snapshot();
  f.drag([0, 30], [40, 50], 'data-fixture-id', id);
  assert.equal(f.model.scene.studio!.fixtures![0]!.offset, 240);
  assert.equal(f.history.undoCount, 1); f.history.undo(); assert.equal(f.model.snapshot(), before);
  f.gestures.onPointerDown(f.event(0, 30, 'data-fixture-id', id), f.surface);
  f.gestures.onPointerMove(f.event(50, 30), f.surface);
  f.gestures.onPointerUp(undefined, true);
  assert.equal(f.model.snapshot(), before); assert.equal(f.history.undoCount, 0);
});
