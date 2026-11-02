import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { DEFAULT_HINGE, HINGES, HINGE_KINDS, HINGE_SOURCE, hinge, hingesFor, hingeStations, type HingeDef } from '../../src/domain/wardrobe/hinges';
import { createEditorState } from '../../src/application/projects/editor-state';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { makePiece } from '../../src/domain/make/make-parts';
import { frontsProblems, leafKey } from '../../src/domain/wardrobe/front-styles';
import type { EditorState } from '../../src/application/projects/editor-scene';

/** The hinge catalogue: every kind walked through every field, and the hardware list and Make agreeing on what each door
 * hangs on. A failure names the kind and the step. */

const defs = HINGES as readonly HingeDef[];

test('hinges · keys, names and sizes are unique and every field is sensible', () => {
  for (const field of ['key', 'name', 'size'] as const) assert.equal(new Set(defs.map(h => h[field])).size, defs.length, `${field}s are unique`);
  for (const h of defs) {
    assert.match(h.key, /^[a-z]+$/, `${h.key}: one lowercase word, it is saved in projects`);
    assert.ok(h.angle >= 90 && h.angle <= 180, `${h.key}: opening angle`);
    assert.ok(h.use.length > 0, `${h.key}: says where it is used`);
    assert.ok(h.loadKg > 0, `${h.key}: load per hinge`);
    assert.ok(h.plate.pitch === 32 && h.plate.line === 37, `${h.key}: plate on the System 32 line (D5)`);
    if (h.cup) assert.ok(h.cup.d === 35 && h.cup.fromEdge === 22.5 && h.cup.depth > 0 && h.cup.depth < 18, `${h.key}: 35 mm cup 22.5 mm from the edge (D5)`);
    else assert.equal(h.key, 'glass', `${h.key}: only the glass clamp has no cup`);
    assert.equal(hinge(h.key), h);
  }
  assert.equal(hinge(undefined).key, DEFAULT_HINGE);
  assert.match(HINGE_SOURCE, /common practice; check the maker's template/);
});

test('hinges · the default is today\'s 110° hinge', () => {
  const h = hinge(DEFAULT_HINGE);
  assert.deepEqual([h.name, h.size, h.angle, h.cup?.d, h.cup?.depth], ['Concealed hinge, 110°', '110°', 110, 35, 13]);
});

test('hinges · one rule counts and places them', () => {
  assert.deepEqual([900, 901, 1600, 1601, 2000, 2001].map(hingesFor), [2, 3, 3, 4, 4, 5]);
  assert.deepEqual(hingeStations(80), [10, 70]);
  const definitions = execSync("git grep -n -E '(const|function) hingesFor' -- src", { encoding: 'utf8' }).trim().split('\n');
  assert.equal(definitions.length, 1, 'one definition of hingesFor:\n' + definitions.join('\n'));
});

function wardrobe(kind?: string): EditorState {
  const s = createEditorState();
  Object.assign(s, { w: 200, n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'hinged', secs: [[], [], [], [], [], []] });
  if (kind) s.fronts = { leaves: Object.fromEntries([0, 1].map(b => [leafKey(b, 0), { hingeKind: kind as never }])) };
  return s;
}

test('hinges · for every kind, the hardware list and Make agree on how many and which', () => {
  for (const kind of HINGE_KINDS) {
    const s = wardrobe(kind), input = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: s }] }, h = hinge(kind);
    const listed = hardwareList(placePieces(input)).flatMap(t => t.rows).filter(r => /hinge/i.test(r[0]!));
    assert.deepEqual(listed.map(r => r[0]), [h.name], `${kind}: the hardware list names it`);
    const made = makePiece(input, 1)!;
    const bought = made.buy.filter(b => b.kind === 'hinge');
    assert.deepEqual(bought.map(b => [b.size, b.qty]), [[h.size, Number(listed[0]![2])]], `${kind}: Make buys as many, of the same kind`);
    const cups = made.holes.filter(x => x.kind === 'cup');
    assert.equal(cups.length, h.cup ? Number(listed[0]![2]) : 0, `${kind}: a cup per hinge, none in glass`);
    for (const c of cups) assert.deepEqual([c.d, c.depth], [h.cup!.d, h.cup!.depth], `${kind}: cup size`);
    assert.deepEqual(made.findings, [], `${kind}: nothing drilled runs into anything`);
  }
});

test('hinges · a glass door takes the clamp hinge unless one is set; an unknown kind is refused', () => {
  const glass = wardrobe();
  glass.doors = 'glass';
  glass.materials = { ...glass.materials!, frontDecorId: 'agc-glass-planibel-grey-float' };
  const input = { pieces: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, design: glass }] };
  assert.ok(hardwareList(placePieces(input)).flatMap(t => t.rows).some(r => r[0] === hinge('glass').name));
  assert.match(frontsProblems({ leaves: { '0.0': { hingeKind: 'piano' as never } } }).join(), /unknown hinge "piano": use standard, wide/);
});
