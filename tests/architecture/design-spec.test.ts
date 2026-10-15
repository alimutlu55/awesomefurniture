import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { describeScene } from '../../src/application/spec/describe-scene';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { designSpecJsonSchema, parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';
import { STUDIO_TEMPLATES } from '../../src/domain/studio/studio-templates';
import { CEILING_SHAPES } from '../../src/domain/studio/studio-ceiling';
import { POSSESSION_KEYS } from '../../src/domain/wardrobe/possessions';

/** Design specs: a design described by its result, built with the editor's own commands, reported back in the
 * same terms, and stored as an ordinary project. */

const underStairs = parseDesignSpec({
  specVersion: 1, name: 'Under the stairs',
  room: { width: 380, depth: 115, height: 260, openings: [{ wall: 4, kind: 'door', width: 80 }] },
  ceilings: [{ wall: 1, shape: 'landing', points: [[95, 205], [185, 205], [320, 105], [380, 105]] }],
  wardrobes: [{ against: 1, fill: true, for: { short: 20, pants: 10 } }],
});

test('the photographed space under the stairs is built from its description', () => {
  const built = buildFromSpec(underStairs, 'p1');
  assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
  const { report, project } = built;
  assert.equal(project.name, 'Under the stairs');
  assert.deepEqual(report.room!.walls.map(w => w.length), [380, 115, 380, 115], 'inside lengths, as a tape reads them');
  assert.equal(report.room!.walls[3]!.openings[0]!.kind, 'door');
  assert.deepEqual(report.ceilings[0]!.points, [[95, 205], [185, 205], [320, 105], [380, 105]], 'the stairs as described');
  const w = report.wardrobes[0]!;
  assert.equal(w.against, 1);
  assert.equal(w.from, 50, 'keeps access to the door on the adjacent wall');
  assert.equal(w.width, 330, 'fills the physically available stretch');
  assert.ok(w.top.some((p, k) => k > 0 && w.top[k - 1]![0] === p[0]), 'its top steps under the landing');
  assert.equal(w.gaps.top, 0, 'fitted under the stairs');
  assert.ok(w.holds.short!.holds >= 20 && w.holds.pants!.holds >= 10, 'holds what it was planned for: ' + JSON.stringify(w.holds));
  assert.match(w.warnings.join(), /hinged doors need 60/, 'the 55 cm left in front is too little for hinged doors');
});

test('a design built from a spec saves and reopens as the same design: a backend stores ordinary projects', () => {
  const built = buildFromSpec(underStairs, 'p1');
  assert.ok(built.ok);
  const reopened = projectToScene(deserializeProject(serializeProject(built.project)))!;
  assert.deepEqual(describeScene(reopened), built.report, 'the same report after saving and loading');
  const again = buildFromSpec(underStairs, 'p1');
  assert.ok(again.ok);
  assert.deepEqual(again.report, built.report, 'the same spec builds the same design');
});

test('a spec that cannot be built returns every problem with where it is, and nothing half-built', () => {
  const built = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { width: 300, depth: 200 }, ceilings: [{ wall: 9, shape: 'stairs' }], wardrobes: [{ against: 1, width: 500 }] }), 'p');
  assert.equal(built.ok, false);
  assert.deepEqual(!built.ok && built.problems.map(p => p.path), ['ceilings[0].wall']);
  const wardrobes = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { width: 300, depth: 200 }, wardrobes: [{ against: 7 }, { against: 1, width: 500 }, { against: 1, width: 250, from: 100 }] }), 'p');
  assert.equal(wardrobes.ok, false);
  assert.deepEqual(!wardrobes.ok && wardrobes.problems.map(p => p.path), ['wardrobes[0].against', 'wardrobes[1].width', 'wardrobes[2]']);
  assert.match(!wardrobes.ok ? wardrobes.problems[0]!.message : '', /walls are 1 to 4/);
  assert.throws(() => parseDesignSpec({ specVersion: 1, wardrobes: [{ for: { socks: 3 } }] }), /wardrobes\.0\.for/);
  assert.throws(() => parseDesignSpec({ specVersion: 2 }), /specVersion/);
});

test('without a room, wardrobes stand side by side; a placed wardrobe goes exactly where it is asked', () => {
  const loose = buildFromSpec(parseDesignSpec({ specVersion: 1, wardrobes: [{ width: 120 }, { width: 160, height: 240 }] }), 'p');
  assert.ok(loose.ok);
  assert.deepEqual(loose.report.wardrobes.map(w => [w.width, w.height, w.against]), [[120, 230, null], [160, 240, null]]);
  const placed = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { template: 'bedroom' }, wardrobes: [{ against: 2, width: 100, from: 30 }] }), 'p');
  assert.ok(placed.ok, JSON.stringify(!placed.ok && placed.problems));
  assert.deepEqual([placed.report.wardrobes[0]!.against, placed.report.wardrobes[0]!.from, placed.report.wardrobes[0]!.width], [2, 30, 100]);
});

// Every allowed name comes from a registry: each one builds.
for (const t of STUDIO_TEMPLATES) {
  test(`spec · built-in room ${t.id} with a wardrobe on wall 1`, () => {
    const built = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { template: t.id }, wardrobes: [{ against: 1, width: 100 }] }), 'p');
    assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
    assert.equal(built.report.wardrobes[0]!.against, 1);
  });
}
for (const c of CEILING_SHAPES) {
  test(`spec · ceiling shape ${c.id} over a fitted wardrobe`, () => {
    const built = buildFromSpec(parseDesignSpec({ specVersion: 1, room: { width: 300, depth: 250 }, ceilings: [{ wall: 1, shape: c.id }], wardrobes: [{ against: 1 }] }), 'p');
    assert.ok(built.ok, JSON.stringify(!built.ok && built.problems));
    assert.equal(built.report.ceilings[0]!.run, c.id === 'slope' ? 'across' : 'along');
  });
}

test('the published JSON Schema names every room, ceiling shape and possession, with descriptions', () => {
  const text = JSON.stringify(designSpecJsonSchema());
  for (const name of [...STUDIO_TEMPLATES.map(t => t.id), ...CEILING_SHAPES.map(c => c.id), ...POSSESSION_KEYS]) assert.ok(text.includes(`"${name}"`), name);
  assert.match(text, /left end/, 'fields are described for agents');
});
