import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { hangingDepth } from '../../src/domain/drawings/manufacturing-rules/hanging-depth';
import { MIN_HANGING_DEPTH } from '../../src/domain/wardrobe/carcass';
import type { EditorDesign, EditorItem } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** A side-facing hanging rail needs 530 mm of clear fitting depth (D3): critical behind doors, a warning without. */

const hanging = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('hanging-depth:'));
const rail = (d: number, item: EditorItem, doors: EditorDesign['doors'] = 'hinged') => alone(wardrobe({ w: 80, d, n: 1, doors, secs: [[item], [], [], [], [], []] }));

test('a long hang 45 cm deep behind doors is critical, with the fix', () => {
  const found = hanging(rail(45, { k: 'long', h: 160 }));
  assert.equal(found.length, 1, JSON.stringify(found));
  const f = found[0]!;
  assert.equal(f.severity, 'critical');
  assert.equal(f.measured, 430);
  assert.equal(f.limit, 530);
  assert.equal(f.fix, 'Use a front-facing rail');
  assert.deepEqual(f.at, { mark: 'W1' });
});

test('without doors it is a warning; front-facing, or 60 cm deep, it passes', () => {
  assert.deepEqual(hanging(rail(45, { k: 'long', h: 160 }, 'none')).map(f => f.severity), ['warning']);
  assert.deepEqual(hanging(rail(45, { k: 'long', h: 160, front: true })), []);
  assert.deepEqual(hanging(rail(60, { k: 'long', h: 160 })), []);
  assert.equal(MIN_HANGING_DEPTH, 53);
});

test('a pull-down rail cannot face front, so its fix is a deeper wardrobe', () => {
  assert.deepEqual(hanging(rail(45, { k: 'lift', h: 100 })).map(f => f.fix), ['Make it 55 cm deep']);
});

test('no golden wardrobe and no welcome space is refused by the rule', () => {
  assert.ok(RULES.includes(hangingDepth));
  for (const [name, design] of goldenWardrobes()) assert.deepEqual(hanging(alone(design)), [], name);
  for (const [name, input] of welcomeSpaces()) assert.deepEqual(hanging(input).filter(f => f.severity === 'critical'), [], name);
});
