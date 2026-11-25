import test from 'node:test';
import assert from 'node:assert/strict';
import { alone } from './rule-fixtures';
import { startingScene } from '../../src/application/projects/editor-mapper';
import { createSceneCommands } from '../../src/application/commands/scene-commands';
import { PIECE_PRESETS, presetSize } from '../../src/domain/furniture/piece-presets';
import { POSSESSION_KEYS } from '../../src/domain/wardrobe/possessions';
import { makePiece } from '../../src/domain/make/make-parts';
import { verifyPiece } from '../../src/domain/make/make-verify';
import { JOINT_SYSTEMS } from '../../src/domain/make/make-construction';

/** Every preset, added as the Add sheet adds it: at its size, named, with its inside planned and buildable. */
for (const preset of PIECE_PRESETS) test(`piece preset · ${preset.name}: added at its size, filled by Auto design, buildable`, () => {
  const scene = startingScene(), undo: number[] = [];
  const commands = createSceneCommands(() => scene, { checkpoint: () => { undo.push(1); } });
  const piece = commands.addCabinet(false, 'regular', undefined, presetSize(preset.id));
  assert.ok(piece, 'added');
  assert.equal(undo.length, 1, 'one undo step');
  assert.equal(piece.name, `${preset.name} ${piece.id}`);
  assert.deepEqual({ w: piece.state.w, h: piece.state.h, d: piece.state.d }, preset.size);
  assert.equal(piece.state.doors, preset.doors);
  for (const k of POSSESSION_KEYS) assert.equal(piece.state.profile.needs[k], (preset.holds as Record<string, number>)[k] ?? 0, k);
  const fittings = piece.state.secs.flat().filter(it => it.k !== 'void');
  assert.ok(fittings.length >= 2, `Auto design filled it (${fittings.map(it => it.k)})`);
  for (const joints of JOINT_SYSTEMS) {
    const mp = makePiece(alone({ ...piece.state, construction: { joints, back: 'nailed' } }), 1);
    assert.ok(mp, 'Make takes it down');
    assert.deepEqual(verifyPiece(mp).map(d => d.kind + ': ' + d.what), [], joints);
  }
});

test('piece presets · an unknown preset adds nothing special', () => {
  assert.deepEqual(presetSize('no-such-piece'), {});
  assert.deepEqual(presetSize(undefined), {});
});
