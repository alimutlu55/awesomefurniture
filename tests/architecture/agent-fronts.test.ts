import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agentGuide, createAgentApi } from '../../src/app/agent-api';
import { FRONT_OVERLAYS, FRONT_STYLES } from '../../src/domain/wardrobe/front-styles';
import { HINGES } from '../../src/domain/wardrobe/hinges';
import { HANDLES, HANDLE_FINISH_DEFS, resolveHandle } from '../../src/domain/wardrobe/handles';
import { projectToScene } from '../../src/application/projects/editor-mapper';
import { buildFromSpec } from '../../src/application/spec/build-from-spec';
import { parseDesignSpec } from '../../src/infrastructure/serialization/design-spec-codec';

/** Fronts in the agent guide (P1-18): `window.furnidraw.check()` accepts and explains styles, leaves, hinges and
 * handles, and the guide (and /llms.txt) names them from the registries. */

const api = createAgentApi(() => null, { href: 'https://furnidraw.test/editor.html' });
const spec = (wardrobe: object) => ({ specVersion: 1, room: { width: 300, depth: 300 }, wardrobes: [{ against: 1, width: 200, ...wardrobe }] });

test('check accepts doors, a style, leaves, hinges and handles, and builds them', () => {
  const wardrobe = { doors: 'hinged', fronts: { style: 'slab', overlay: 'half', reveal: 3, leaves: { '0.0': { leaves: 2, hingeKind: 'wide' }, '0.0.1': { decor: 'agc-glass-mirox-silver-mnge' } } },
    handle: { kind: 'edge', size: 192, finish: 'matte_black' } };
  const result = api.check(spec(wardrobe));
  assert.ok(result.ok, JSON.stringify(!result.ok && result.problems));
  const built = buildFromSpec(parseDesignSpec(spec(wardrobe)), 'p');
  assert.ok(built.ok);
  const state = projectToScene(built.project)!.wardrobes[0]!.state;
  assert.equal(state.doors, 'hinged');
  assert.deepEqual(state.fronts, { overlay: 'half', reveal: 3, leaves: wardrobe.fronts.leaves });
  const handle = resolveHandle(state.materials);
  assert.deepEqual([handle.kind.key, handle.size, handle.finish], ['edge', 192, 'matte_black']);
});

test('check explains what is wrong with fronts and handles, with the path and what is allowed', () => {
  const problem = (wardrobe: object) => { const r = api.check(spec(wardrobe)); assert.equal(r.ok, false); return !r.ok ? r.problems.map(p => p.path + ': ' + p.message).join('\n') : ''; };
  assert.match(problem({ fronts: { style: 'gothic' } }), /wardrobes\.0\.fronts\.style: Unknown front style "gothic": use slab, shaker, profiled, rail/);
  assert.match(problem({ fronts: { style: 'shaker', overlay: 'half' } }), /cannot be hung half: use full, inset/);
  assert.match(problem({ fronts: { leaves: { '0.0': { hingeKind: 'piano' } } } }), /Unknown hinge "piano": use standard, wide, widest, zero, thick, glass, corner/);
  assert.match(problem({ handle: { kind: 'recessed', size: 320 } }), /wardrobes\.0\.handle\.size: A recessed pull comes in 96 mm, 128 mm, 160 mm, 192 mm/);
  assert.match(problem({ handle: { kind: 'knob', size: 128 } }), /A knob has no size/);
  assert.match(problem({ doors: 'sliding' }), /wardrobes\.0\.doors/);
});

test('the guide and /llms.txt name every style, overlay, hinge, handle and finish', () => {
  const guide = agentGuide();
  for (const key of [...FRONT_STYLES.map(s => s.key), ...FRONT_OVERLAYS.map(o => o.key), ...HINGES.map(h => h.key), ...HANDLES.map(h => h.key), ...HANDLE_FINISH_DEFS.map(f => f.key)])
    assert.ok(guide.includes('`' + key + '`'), `the guide names ${key}`);
  assert.match(guide, /common practice; check the maker's template/);
  assert.equal(readFileSync('public/llms.txt', 'utf8'), guide, '/llms.txt is the guide: run npm run agents:guide');
  assert.match(JSON.stringify(api.schema()), /"handle"/);
});
