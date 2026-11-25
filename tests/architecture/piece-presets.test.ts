import test from 'node:test';
import assert from 'node:assert/strict';
import { alone } from './rule-fixtures';
import { startingScene } from '../../src/application/projects/editor-mapper';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { buildStarterDesign } from '../../src/application/projects/build-starter-design';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { createDesignCommands } from '../../src/application/commands/design-commands';
import { PIECE_PRESETS, allowsPresetFitting, presetSize } from '../../src/domain/furniture/piece-presets';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { generateDesignedLayouts } from '../../src/domain/planner/wardrobe-composer';
import { createAddSuggestions } from '../../src/presentation/editor/add-suggestions.js';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { POSSESSION_KEYS } from '../../src/domain/wardrobe/possessions';
import { makePiece } from '../../src/domain/make/make-parts';
import { verifyPiece } from '../../src/domain/make/make-verify';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';

for (const preset of PIECE_PRESETS) test(`piece preset · ${preset.name} starts empty and offers compatible fittings and plans`, () => {
  const scene = startingScene(), undo: number[] = [];
  const commands = createSceneCommands(() => scene, { checkpoint: () => { undo.push(1); } });
  const piece = commands.addCabinet(false, 'regular', undefined, presetSize(preset.id));
  assert.ok(piece, 'added');
  assert.equal(undo.length, 1, 'one undo step');
  assert.equal(piece.name, `${preset.name} ${piece.id}`);
  assert.deepEqual({ w: piece.state.w, h: piece.state.h, d: piece.state.d }, preset.size);
  assert.equal(piece.state.doors, preset.doors);
  assert.equal(piece.state.piecePreset, preset.id);
  assert.equal(piece.state.n, 1);
  assert.ok(piece.state.secs.every(items => items.length === 0));
  assert.deepEqual(piece.state.dividers, []);
  assert.equal(piece.state.proposal, null);
  for (const k of POSSESSION_KEYS) assert.equal(piece.state.profile.needs[k], (preset.holds as Record<string, number>)[k] ?? 0, k);
  const geometry = createWardrobeGeometry(() => piece.state);
  const suggestions = createAddSuggestions(() => piece.state, geometry).addSuggestions().list;
  assert.deepEqual(suggestions.filter(item => item.k !== 'divider').map(item => item.k).sort(), [...preset.fittings].sort());
  const designCommands = createDesignCommands(() => piece.state);
  designCommands.addMod('short');
  assert.ok(piece.state.secs.every(items => items.length === 0), 'hanging rail is rejected');
  const ideas = generateDesignedLayouts(geometry.plannerConfig());
  assert.ok(ideas.length, 'Auto design is available on request');
  assert.ok(ideas.every(idea => idea.sections.every(section => section.items.every(item => allowsPresetFitting(preset, item.k)))));
  designCommands.applyProposal(ideas[0]!);
  for (const joints of JOINT_SYSTEMS) {
    const mp = makePiece(alone({ ...piece.state, construction: { joints, back: 'nailed' } }), 1);
    assert.ok(mp, 'Make takes it down');
    assert.deepEqual(verifyPiece(mp).map(d => d.kind + ': ' + d.what), [], joints);
  }
});

test('a shoe cabinet starter stays empty and carries its fitting context through saved projects and Reset', () => {
  const starter = buildStarterDesign({ kind: 'piece', preset: 'shoe-cabinet' }, 'shoe-starter');
  assert.ok(starter);
  const scene = projectToScene(deserializeProject(serializeProject(starter)));
  assert.ok(scene);
  const state = scene.wardrobes[0]!.state;
  assert.equal(state.piecePreset, 'shoe-cabinet');
  assert.ok(state.secs.every(items => items.length === 0));
  assert.equal(createSceneCommands(() => scene).resetCabinet(), true);
  assert.equal(state.profile.needs.shoes, 16);
  assert.equal(state.profile.needs.short, 0);
  assert.equal(state.piecePreset, 'shoe-cabinet');
});

test('piece presets · an unknown preset adds nothing special', () => {
  assert.deepEqual(presetSize('no-such-piece'), {});
  assert.deepEqual(presetSize(undefined), {});
});
