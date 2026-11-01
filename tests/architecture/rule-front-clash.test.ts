import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { frontClash, frontClearance, INNER_FRONT_CLEARANCE } from '../../src/domain/drawings/manufacturing-rules/front-clash';
import { defaultMaterials } from '../../src/domain/materials/configured-materials';
import type { EditorDesign, EditorItem } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** Nothing on an inner front behind closed doors comes within 3 mm of the door's back face (D4). */

const clashes = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('front-clash:'));
const drawers = (doors: EditorDesign['doors'], over: Partial<EditorDesign> = {}) => alone(wardrobe({ w: 100, h: 220, n: 2, wt: [1, 1], doors, ...over,
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }] as EditorItem[], [{ k: 'long', h: 160 }] as EditorItem[], [], [], [], []] }));

test('a drawer handle behind a closed door reaches through it: refused with the fix', () => {
  // Since P0-08 the model fits no handle there, so the rule is a guard: its measure is checked here directly.
  const front = { z1: 60 - .3 }, door = { z0: 60 + .4 };
  assert.equal(frontClearance(front, door, true), -23, 'the 30 mm handle stands 23 mm through the door');
  assert.equal(frontClearance(front, door, false), 7, 'the front alone is 7 mm clear');
  assert.equal(INNER_FRONT_CLEARANCE, .3);
});

test('two bays, drawers in one, hinged doors: passes, because the drawers have finger grips (P0-08)', () => {
  assert.deepEqual(clashes(drawers('hinged')), []);
});

test('the same without doors passes; with push-to-open fronts there is no handle to clash', () => {
  assert.deepEqual(clashes(drawers('none')), []);
  const tipOn = drawers('hinged', { materials: { ...defaultMaterials(), handleFinish: 'handleless_tip_on' } });
  assert.deepEqual(clashes(tipOn), []);
});

test('no golden wardrobe and no welcome space is refused by the rule', () => {
  assert.ok(RULES.includes(frontClash));
  for (const [name, design] of goldenWardrobes()) assert.deepEqual(clashes(alone(design)), [], name);
  for (const [name, input] of welcomeSpaces()) assert.deepEqual(clashes(input), [], name);
});

test('every welcome space with hinged doors passes the rule', () => {
  for (const [name, input] of welcomeSpaces()) {
    const hinged = { ...input, pieces: input.pieces.map(p => ({ ...p, design: { ...p.design, doors: 'hinged' as const } })) };
    assert.deepEqual(clashes(hinged), [], name);
  }
});
