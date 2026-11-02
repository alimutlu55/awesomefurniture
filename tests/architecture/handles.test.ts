import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HANDLE, HANDLES, HANDLE_FINISHES, HANDLE_FINISH_DEFS, HANDLE_KINDS, HANDLE_SOURCE, handleCentres, handleKind, handleLabel, handleSizeFits,
  resolveHandle, type HandleDef, type HandleSize } from '../../src/domain/wardrobe/handles';
import { createEditorState } from '../../src/application/projects/editor-state';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { makePiece } from '../../src/domain/make/make-parts';
import { designerPalettes } from '../../src/domain/materials/designer-palettes';
import { KITCHEN_PRESETS, createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import type { EditorScene, EditorState } from '../../src/application/projects/editor-scene';

/** The handle catalogue: every kind and finish walked through, old designs keeping their 128 mm bar in their finish, and
 * Make drilling the chosen handle's centres. */

const defs = HANDLES as readonly HandleDef[];

test('handles · kinds, sizes and finishes are complete', () => {
  assert.equal(new Set(HANDLE_KINDS).size, defs.length, 'kinds are unique');
  for (const h of defs) {
    assert.match(h.key, /^[a-z]+$/, `${h.key}: one lowercase word, it is saved in projects`);
    assert.ok(h.name.length > 0 && h.projectionMm >= 0, `${h.key}: name and projection`);
    const sizes = h.sizes as readonly HandleSize[];
    assert.equal(sizes.length === 0, h.fixing === 'single', `${h.key}: only a one-screw handle has no size`);
    const numbers = sizes.filter((s): s is number => s !== 'full');
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), `${h.key}: sizes smallest first`);
    for (const s of numbers) assert.ok([96, 128, 160, 192, 320].includes(s), `${h.key}: ${s} mm is a sold centre-to-centre`);
    for (const s of sizes) assert.ok(handleSizeFits(h.key as never, s), `${h.key}: ${s} fits`);
    assert.equal(handleKind(h.key), h);
  }
  assert.deepEqual([...HANDLE_FINISHES], HANDLE_FINISH_DEFS.map(f => f.key), 'finishes come from the registry');
  for (const f of HANDLE_FINISH_DEFS) assert.match(f.colour, /^#[0-9a-f]{6}$/, `${f.key}: colour`);
  assert.match(HANDLE_SOURCE, /common practice; check the maker's template/);
});

const scene = (state: EditorState): EditorScene => ({ wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 });
const save = (s: EditorScene) => serializeProject(sceneToProject(createProject('p', 'P'), s));

test('handles · every design saved before handle kinds keeps a 128 mm bar in its own finish', () => {
  const fixtures: EditorState[] = [createEditorState(),
    ...designerPalettes.map(p => Object.assign(createEditorState(), { materials: structuredClone(p.materials) })),
    ...KITCHEN_PRESETS.map(p => Object.assign(createEditorState(), createKitchenDesign(p.unit as never, p.key)) as EditorState)];
  for (const state of fixtures) {
    const json = save(scene(state)), back = projectToScene(deserializeProject(json))!.wardrobes[0]!.state;
    const handle = resolveHandle(back.materials);
    assert.deepEqual([handle.kind.key, handle.size, handle.finish], [DEFAULT_HANDLE.kind, DEFAULT_HANDLE.size, state.materials!.handleFinish]);
    assert.ok(!json.includes('handleKind') && !json.includes('handleSize'), 'nothing new is written');
    assert.equal(save(projectToScene(deserializeProject(json))!), json, 'same bytes after load and save');
  }
});

test('handles · choosing one is one undo step, saves, and the 128 mm bar is never written', () => {
  const state = createEditorState();
  let steps = 0;
  const commands = createDesignCommands(() => state, { checkpoint: () => { steps++; } });
  assert.ok(commands.setHandle('knob'));
  assert.equal(steps, 1);
  assert.deepEqual([state.materials!.handleKind, state.materials!.handleSize], ['knob', undefined]);
  commands.setHandle('bar', 192);
  assert.equal(resolveHandle(state.materials).size, 192);
  commands.setHandle('edge', 999 as never);
  assert.equal(state.materials!.handleSize, 128, 'a size the kind does not come in becomes 128 mm');
  commands.setHandle('profile', 128);
  assert.equal(state.materials!.handleSize, 'full', 'or the kind\'s only size');
  commands.setHandle('edge', 999 as never);
  const json = save(scene(state));
  assert.equal(JSON.parse(json).wardrobes[0].materials.handleKind, 'edge');
  commands.setHandle('bar', 128);
  assert.ok(!('handleKind' in state.materials!) && !('handleSize' in state.materials!));
  const project = JSON.parse(json);
  project.wardrobes[0].materials.handleSize = 100;
  assert.throws(() => deserializeProject(JSON.stringify(project)), /does not come in that size/);
});

function holes(kind: string, size?: HandleSize) {
  const state = createEditorState();
  Object.assign(state, { w: 60, n: 1, doors: 'hinged', secs: [[], [], [], [], [], []] });
  state.materials = { ...state.materials!, handleKind: kind as never, ...(size === undefined ? {} : { handleSize: size }) };
  const input = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: state }] }, made = makePiece(input, 1)!;
  const door = made.boards.findIndex(b => b.stock === 'door');
  return { state, made, input, at: made.holes.filter(h => h.kind === 'handle' && h.board === door).map(h => h.at), door: made.boards[door]! };
}

test('handles · Make drills the chosen handle: its centres, one screw, from the back, or none', () => {
  for (const size of [96, 128, 160, 192, 320] as const) {
    const { at } = holes('bar', size);
    assert.equal(at.length, 2, `bar ${size}`);
    assert.ok(Math.abs(Math.abs(at[1]![1] - at[0]![1]) * 10 - size) < .01, `bar ${size}: holes ${size} mm apart`);
  }
  assert.equal(holes('knob').at.length, 1, 'a knob: one screw');
  const edge = holes('edge', 128);
  assert.equal(edge.at.length, 2);
  assert.ok(edge.at.every(p => Math.abs(p[2] - edge.door.z0) < 1e-9), 'an edge pull is screwed from the back');
  assert.equal(holes('recessed', 128).at.length, 0, 'a recessed pull is routed, not drilled');
  const full = holes('full', 'full');
  assert.ok(Math.abs(Math.abs(full.at[1]![1] - full.at[0]![1]) - (full.door.y1 - full.door.y0 - 10)) < .01, 'a full-height bar spans the door less 5 cm each end');
  assert.deepEqual(handleCentres(handleKind('profile'), 'full', 200), []);
  for (const kind of HANDLE_KINDS) assert.deepEqual(holes(kind, (handleKind(kind).sizes as readonly HandleSize[])[0]).made.findings, [], `${kind}: nothing drilled runs into anything`);
});

test('handles · the hardware list names the kind, size and finish', () => {
  const { input, state } = holes('bar', 320);
  const rows = hardwareList(placePieces(input)).flatMap(t => t.rows).filter(r => r[0] === 'Handle');
  assert.deepEqual(rows.map(r => r[1]), [handleLabel(resolveHandle(state.materials))]);
  assert.match(rows[0]![1]!, /^Bar handle 320 mm · /);
});
