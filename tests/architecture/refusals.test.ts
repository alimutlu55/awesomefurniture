import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateForManufacture } from '../../src/domain/drawings/manufacturing-validation';
import type { DrawingInput } from '../../src/domain/drawings/room-pieces';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import type { EditorDesign, EditorItem } from '../../src/domain/wardrobe/editor-design';
import { alone, goldenWardrobes, wardrobe, welcomeSpaces } from './rule-fixtures';

/**
 * The refusal library: designs that cannot be built, each refused by the engineering rule expected, and designs that
 * can, which pass with no critical finding. It locks P0 in; a later rule adds its own cases here.
 */

/** The rules that refuse a design, by the id prefix of their critical findings. */
const refusedBy = (input: DrawingInput) => [...new Set(validateForManufacture(input).findings.filter(f => f.severity === 'critical').map(f => f.id.split(':')[0]!))].sort();
const bays = (...secs: EditorItem[][]) => [...secs, ...Array.from({ length: 6 - secs.length }, () => [])];
const shelves = (n: number, h = 30): EditorItem[] => Array.from({ length: n }, () => ({ k: 'shelf', h }));
const long: EditorItem = { k: 'long', h: 160 }, short: EditorItem = { k: 'short', h: 100 }, lift: EditorItem = { k: 'lift', h: 100 };
const drawers: EditorItem[] = [{ k: 'drawer', h: 20 }, { k: 'drawer', h: 20 }];
/** One leaf set on the bottom opening of each listed bay, where the automatic layout would hang two. */
const oneLeaf = (...bayIndexes: number[]): Partial<EditorDesign> => ({ fronts: { leaves: Object.fromEntries(bayIndexes.map(b => [b + '.0', { leaves: 1 }])) } });

const BAD: [string, Partial<EditorDesign>, string[]][] = [
  // Wide and tall hinged leaves (D1).
  ['one leaf set across an empty 120 cm bay', { w: 120, n: 1, doors: 'hinged', ...oneLeaf(0) }, ['leaf-width']],
  ['two 999 mm leaves set on an empty 200 cm wardrobe', { w: 200, n: 2, wt: [1, 1], doors: 'hinged', ...oneLeaf(0, 1) }, ['leaf-width']],
  ['one glass leaf set across a 70 cm bay', { w: 70, n: 1, doors: 'glass', ...oneLeaf(0) }, ['leaf-width']],
  ['three 78 cm leaves set on three bays', { w: 240, n: 3, wt: [1, 1, 1], doors: 'hinged', ...oneLeaf(0, 1, 2) }, ['leaf-width']],
  ['a 150 cm bay: two leaves are still too wide', { w: 150, n: 1, doors: 'hinged' }, ['leaf-width']],
  ['a 270 cm tall single leaf', { w: 60, h: 270, n: 1, doors: 'hinged' }, ['leaf-height']],
  ['a 270 cm tall 100 cm bay: wide and tall', { w: 100, h: 270, n: 1, doors: 'hinged', secs: bays(shelves(2, 50)), ...oneLeaf(0) }, ['leaf-height', 'leaf-width', 'shelf-span']],
  // Long shelves (D2).
  ['a 124 cm bay of three shelves', { w: 124, n: 1, secs: bays(shelves(3)) }, ['shelf-span']],
  ['a 100 cm bay with one shelf', { w: 100, n: 1, secs: bays(shelves(1)) }, ['shelf-span']],
  ['a 160 cm bay of shelves', { w: 160, n: 1, secs: bays(shelves(4)) }, ['shelf-span']],
  ['a 90 cm bay beside a 70 cm one', { w: 165.4, n: 2, wt: [90, 70], secs: bays(shelves(2), shelves(2)) }, ['shelf-span']],
  // Shallow hanging behind doors (D3).
  ['a long hang 45 cm deep behind doors', { w: 60, d: 45, n: 1, doors: 'hinged', secs: bays([long]) }, ['hanging-depth']],
  ['a short hang 50 cm deep behind doors', { w: 60, d: 50, n: 1, doors: 'hinged', secs: bays([short]) }, ['hanging-depth']],
  ['a pull-down rail 40 cm deep behind glass doors', { w: 60, d: 40, n: 1, doors: 'glass', secs: bays([lift]) }, ['hanging-depth']],
  ['two side-facing rails 54 cm deep behind doors', { w: 116, d: 54, n: 2, wt: [1, 1], doors: 'hinged', secs: bays([long], [short, short]) }, ['hanging-depth']],
  // Parts larger than a stock sheet (D9).
  ['a 240 × 230 cm wardrobe with no partition', { w: 240, h: 230, n: 1 }, ['stock-size']],
  ['a 290 cm wardrobe with no partition', { w: 290, n: 1 }, ['stock-size']],
  ['a 260 cm wide frame with shelves and no partition', { w: 260, h: 220, n: 1, secs: bays(shelves(2)) }, ['shelf-span', 'stock-size']],
  // Combinations.
  ['wide leaves over shallow hanging', { w: 80, d: 45, n: 1, doors: 'hinged', secs: bays([long]), ...oneLeaf(0) }, ['hanging-depth', 'leaf-width']],
  ['wide leaves over long shelves', { w: 124, n: 1, doors: 'hinged', secs: bays(shelves(3)) }, ['leaf-width', 'shelf-span']],
  ['shallow hanging beside long shelves', { w: 160, d: 45, n: 2, wt: [40, 116.4], doors: 'hinged', secs: bays([long], shelves(3)), ...oneLeaf(1) }, ['hanging-depth', 'leaf-width', 'shelf-span']],
  ['oversize, wide, tall and shallow at once', { w: 250, h: 270, d: 45, n: 1, doors: 'hinged', secs: bays([long]) }, ['hanging-depth', 'leaf-height', 'leaf-width', 'shelf-span', 'stock-size']],
];

const GOOD: [string, DrawingInput][] = [
  ...goldenWardrobes().map(([name, design]) => ['golden ' + name, alone(design)] as [string, DrawingInput]),
  ...welcomeSpaces().map(([name, input]) => ['welcome ' + name, input] as [string, DrawingInput]),
  ['a 60 cm bay behind hinged doors', alone(wardrobe({ w: 60, n: 1, doors: 'hinged', secs: bays([long]) }))],
  ['drawers behind hinged doors, with finger grips', alone(wardrobe({ w: 100, h: 220, n: 2, wt: [1, 1], doors: 'hinged', secs: bays([...drawers, ...shelves(2)], [long]) }))],
  ['a 45 cm deep wardrobe with a front-facing rail', alone(wardrobe({ w: 60, d: 45, n: 1, doors: 'hinged', secs: bays([{ ...long, front: true }]) }))],
  ['a 240 cm wardrobe of three bays, back split over a partition', alone(wardrobe({ w: 240, n: 3, wt: [1, 1, 1], secs: bays(shelves(3), [long], shelves(3)) }))],
  ['a 320 cm wardrobe of four bays: top, base and plinth split', alone(wardrobe({ w: 320, n: 4, wt: [1, 1, 1, 1] }))],
  ['kitchen base, wall and fridge units', { pieces: [
    { id: 1, name: 'Base', x: 0, y: 0, z: 400, angle: 0, design: createKitchenDesign('base', 'drawers') },
    { id: 2, name: 'Tall', x: 300, y: 0, z: 400, angle: 0, design: createKitchenDesign('tall', 'fridge') },
    { id: 3, name: 'Upper', x: 600, y: 142, z: 400, angle: 0, design: createKitchenDesign('upper', 'upper') }] }],
];

test('the library is large enough: at least 20 designs that cannot be built and 10 that can', () => {
  assert.ok(BAD.length >= 20, BAD.length + ' bad');
  assert.ok(GOOD.length >= 10, GOOD.length + ' good');
});

for (const [name, design, expected] of BAD) {
  test('refused: ' + name + ' (' + expected.join(', ') + ')', () => {
    assert.deepEqual(refusedBy(alone(wardrobe(design))), expected);
  });
}

for (const [name, input] of GOOD) {
  test('passes: ' + name, () => {
    const v = validateForManufacture(input);
    assert.deepEqual(v.findings.filter(f => f.severity === 'critical'), [], name);
    assert.equal(v.ready, true);
  });
}
