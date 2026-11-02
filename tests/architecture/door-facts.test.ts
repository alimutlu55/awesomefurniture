import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { cabinetDoorLeaves } from '../../src/domain/wardrobe/door-layout';
import { createWardrobeGeometry } from '../../src/domain/geometry/wardrobe-geometry.js';
import { leafKey } from '../../src/domain/wardrobe/front-styles';
import { doorFacts, doorFactsHtml } from '../../src/presentation/editor/door-facts';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

// A chosen door's facts (P1-11) say what the hardware list says for that leaf, and what the rules say about it.
const input = (design: EditorDesign) => ({ pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design }] });
const keys = (design: EditorDesign) => cabinetDoorLeaves(design, createWardrobeGeometry(() => ({ ...design, sel: 0, item: -1, divider: -1, space: null })).widths()).map(l => leafKey(l.bay, l.row, l.leaf));
const rows = (design: EditorDesign) => hardwareList(placePieces(input(design))).flatMap(t => t.rows);

for (const [name, design] of [
  ['one 50 cm door', { ...createInitialDesign(), w: 50, doors: 'hinged' }],
  ['a pair of doors', { ...createInitialDesign(), w: 100, doors: 'hinged' }],
  ['a tall wide wardrobe', { ...createInitialDesign(), w: 200, h: 240, n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged' }],
] as const) test(`door facts · ${name}: hinges and handles as the hardware list has them`, () => {
  const all = keys(design as EditorDesign).map(k => doorFacts(input(design as EditorDesign), 1, k)!);
  assert.ok(all.length && all.every(Boolean), 'every leaf has its facts');
  const list = rows(design as EditorDesign);
  for (const name of new Set(all.map(f => f.hinges.name))) {
    const line = list.find(r => r[0] === name)!;
    assert.ok(line, `${name} is on the hardware list`);
    assert.equal(Number(line[2]), all.filter(f => f.hinges.name === name).reduce((n, f) => n + f.hinges.count, 0), `${name}: as many as the leaves have`);
  }
  const handles = list.find(r => r[0] === 'Handle')!;
  assert.equal(handles[1], all[0]!.handle!.label, 'the handle the list names');
  assert.equal(Number(handles[2]), all.length, 'one each');
  for (const f of all) {
    assert.equal(f.hinges.at.length, f.hinges.count, 'a mark at each hinge');
    assert.ok(f.hinges.at.every(y => y > 0 && y < f.height), 'within the leaf');
    assert.ok(f.width > 0 && f.thickness > 0 && f.decor.length > 0);
    assert.ok(f.handle!.x > 0 && f.handle!.x < f.width && f.handle!.y > 0 && f.handle!.y < f.height, 'the handle on the leaf');
    assert.ok((f.hinges.side === 'left') === (f.handle!.x > f.width / 2), 'the handle on the edge away from the hinges');
    assert.match(doorFactsHtml(f), new RegExp(`${f.width} × ${f.height} × ${f.thickness} mm`));
  }
});

test('door facts · a leaf over the size limit carries the rule\'s finding; none for a leaf that is not there', () => {
  const tall = { ...createInitialDesign(), w: 60, h: 290, doors: 'hinged' } as EditorDesign, [key] = keys(tall);
  const f = doorFacts(input(tall), 1, key!)!;
  assert.equal(f.status.severity, 'critical');
  assert.match(f.status.rule ?? '', /at most/);
  assert.equal(doorFacts(input(tall), 1, '9.0.0'), null);
  assert.equal(doorFacts(input({ ...tall, doors: 'none' }), 1, key!), null);
  assert.equal(doorFacts(input({ ...createInitialDesign(), w: 50, doors: 'hinged' } as EditorDesign), 1, '0.0.0')!.status.severity, 'ok');
});
