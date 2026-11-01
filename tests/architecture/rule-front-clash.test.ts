import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import { RULES } from '../../src/domain/drawings/manufacturing-rules/index';
import { frontClash, INNER_FRONT_CLEARANCE } from '../../src/domain/drawings/manufacturing-rules/front-clash';
import { defaultMaterials } from '../../src/domain/materials/configured-materials';
import type { EditorDesign, EditorItem } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/** Nothing on an inner front behind closed doors comes within 3 mm of the door's back face (D4). */

const clashes = (input: Parameters<typeof validateForManufacture>[0]) => validateForManufacture(input).findings.filter(f => f.id.startsWith('front-clash:'));
const drawers = (doors: EditorDesign['doors'], over: Partial<EditorDesign> = {}) => alone(wardrobe({ w: 100, h: 220, n: 2, wt: [1, 1], doors, ...over,
  secs: [[{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }, { k: 'shelf', h: 30 }] as EditorItem[], [{ k: 'long', h: 160 }] as EditorItem[], [], [], [], []] }));

test('two bays, drawers in one, hinged doors: each drawer handle reaches through the door', () => {
  const found = clashes(drawers('hinged'));
  assert.equal(found.length, 2, JSON.stringify(found));
  for (const f of found) {
    assert.equal(f.severity, 'critical');
    assert.equal(f.limit, 3);
    assert.ok(f.measured! < 3, 'less than 3 mm left: ' + f.measured);
    assert.equal(f.fix, 'Remove the handle');
    assert.equal(f.at?.mark, 'W1');
    assert.equal(typeof f.at?.board, 'number');
  }
  assert.equal(INNER_FRONT_CLEARANCE, .3);
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
