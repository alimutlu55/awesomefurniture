import test from 'node:test';
import assert from 'node:assert/strict';
import { alone } from './rule-fixtures';
import { createMakeUsage, type FilmFacts } from '../../src/application/analytics/make-usage';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from '../../src/domain/analytics/analytics-events';
import { cleanProperties } from '../../src/domain/analytics/analytics-validation';
import { assemblyGate, findingRule } from '../../src/domain/engine/assembly-gate';
import { inspect } from '../../src/domain/engine/inspect';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';

/** Make's usage analytics (docs/analytics.md, "Make"): what a visit to Make and to Assembly Studio is summed up as. */

function recorder() {
  let clock = 1000;
  const sent: { event: AnalyticsEventName; properties: Record<string, unknown> }[] = [];
  const usage = createMakeUsage({ track: (event, properties) => sent.push({ event, properties: properties as never }), product: () => 'wardrobe', now: () => clock });
  return { usage, sent, wait: (ms: number) => { clock += ms; }, of: (event: AnalyticsEventName) => sent.filter(s => s.event === event).map(s => s.properties) };
}
const film = (over: Partial<FilmFacts> = {}): FilmFacts => ({ steps: 8, atStep: 3, furthestStep: 5, finished: false, watched: 30, duration: 60, ...over });

test('a visit to Make is one make_opened and one make_closed that sums up what was used', () => {
  const { usage, of, wait } = recorder();
  usage.note({ kind: 'opened', parts: 12, findings: 1 });
  usage.note({ kind: 'touch', zoom: false }); usage.note({ kind: 'touch', zoom: true }); usage.note({ kind: 'touch', zoom: true });
  usage.note({ kind: 'tool', key: 'make-apart' }); usage.note({ kind: 'tool', key: 'make-apart' }); usage.note({ kind: 'tool', key: 'look-xray' });
  usage.note({ kind: 'panel', mode: 'list', tab: 'parts' });
  usage.note({ kind: 'pick', part: 3, via: 'list' }); usage.note({ kind: 'pick', part: 4, via: 'step' }); usage.note({ kind: 'pick', part: 3, via: 'canvas' });
  usage.note({ kind: 'tab', tab: 'cutting' });
  usage.note({ kind: 'construction', setting: 'edge_band_mm', value: '1' });
  usage.note({ kind: 'construction', setting: 'joints', value: 'dowel' });
  wait(42_000);
  usage.note({ kind: 'closed', exit: 'done' });
  assert.deepEqual(of('make_opened'), [{ product: 'wardrobe', part_count: 12, finding_count: 1 }]);
  const [closed] = of('make_closed');
  assert.ok(closed);
  assert.equal(closed.duration_ms, 42_000);
  assert.equal(closed.exit, 'done');
  assert.deepEqual(closed.tools_used, ['apart', 'look-xray']);
  assert.equal(closed.tool_uses, 3);
  assert.deepEqual(closed.tabs_viewed, ['parts', 'cutting']);
  assert.equal(closed.panel_opened, true);
  assert.deepEqual([closed.parts_picked, closed.part_picks, closed.picks_canvas, closed.picks_list, closed.picks_step], [2, 3, 1, 1, 1]);
  assert.deepEqual([closed.canvas_touches, closed.zoomed], [1, true]);
  assert.deepEqual([closed.edge_band_changed, closed.construction_changes], [true, 1]);
  assert.equal(closed.last_action, 'construction:joints');
  assert.deepEqual(of('make_tab_viewed'), [{ tab: 'cutting' }]);
  assert.equal(of('make_construction_changed').length, 2);
});

test('an untouched visit says so: nothing used, and it ended where it started', () => {
  const { usage, of } = recorder();
  usage.note({ kind: 'opened', parts: 9, findings: 0 });
  usage.note({ kind: 'closed', exit: 'escape' });
  const [closed] = of('make_closed');
  assert.deepEqual([closed!.tool_uses, closed!.part_picks, closed!.panel_opened, closed!.last_action, closed!.exit], [0, 0, false, 'open', 'escape']);
});

test('the gate, its buttons and every way a save ends are counted, and leaving for Design check says so', () => {
  const { usage, of } = recorder();
  usage.note({ kind: 'opened', parts: 9, findings: 0 });
  usage.note({ kind: 'export', format: 'pdf', parts: 9, outcome: 'requested' });
  usage.note({ kind: 'gate', wanted: 'drawings', blockers: 2, notes: 1, packs: ['manufacturing'], rules: ['manufacturing:size'] });
  usage.note({ kind: 'export', format: 'pdf', parts: 9, outcome: 'gate_blocked' });
  usage.note({ kind: 'export', format: 'parts', parts: 9, outcome: 'requested' });
  usage.note({ kind: 'export', format: 'parts', parts: 9, outcome: 'saved' });
  usage.note({ kind: 'export', format: 'csv', parts: 9, outcome: 'requested' });
  usage.note({ kind: 'export', format: 'csv', parts: 9, outcome: 'not_paid' });
  usage.note({ kind: 'gate_action', action: 'open_check', wanted: 'drawings', open: false });
  usage.note({ kind: 'closed', exit: 'done' });
  assert.deepEqual(of('make_gate_blocked'), [{ wanted: 'drawings', blocker_count: 2, note_count: 1, blocking_packs: ['manufacturing'], blocking_rules: ['manufacturing:size'] }]);
  assert.deepEqual(of('make_export_stopped'), [{ format: 'pdf', reason: 'gate_blocked' }, { format: 'csv', reason: 'not_paid' }]);
  assert.deepEqual(of('make_export_saved'), [{ format: 'parts_csv', part_count: 9 }]);
  const [closed] = of('make_closed');
  assert.deepEqual([closed!.exit, closed!.exports_requested, closed!.exports_saved, closed!.gate_blocks, closed!.design_check_opened], ['design_check', 3, 1, 1, true]);
});

test('Assembly Studio: where it was opened from, how far the film got and which controls were used', () => {
  const { usage, of, wait } = recorder();
  usage.note({ kind: 'opened', parts: 12, findings: 0 });
  usage.note({ kind: 'studio_opened', parts: 12, entry: 'part', direct: true, step: 2 });
  for (const action of ['play', 'pause', 'next', 'chapters', 'chapter', 'mode', 'speed', 'seek', 'seek']) usage.note({ kind: 'studio', action });
  usage.note({ kind: 'studio', action: 'part', value: 4 }); usage.note({ kind: 'studio', action: 'part', value: 4 });
  wait(20_000);
  usage.note({ kind: 'studio_closed', exit: 'escape', film: film() });
  usage.note({ kind: 'closed', exit: 'done' });
  assert.deepEqual(of('assembly_studio_opened'), [{ part_count: 12, direct: true, entry: 'part', start_step: 3 }]);
  const [studio] = of('assembly_studio_closed');
  assert.deepEqual({ ...studio }, { duration_ms: 20_000, exit: 'escape', entry: 'part', part_count: 12, steps_total: 8, furthest_step: 6, at_step: 4,
    finished: false, watched_ratio: .5, play_presses: 1, pauses: 1, reversed: false, steps_stepped: 1, chapters_jumped: 1, scrubbed: true,
    speed_changed: true, explore_used: true, parts_inspected: 1, connections_shown: 0, chapter_list_opened: true, guide_opened: false });
  const [closed] = of('make_closed');
  assert.deepEqual([closed!.assembly_opens, closed!.assembly_ms, closed!.last_action], [1, 20_000, 'assembly_closed']);
});

test('a hidden page sums the visit up before it may close, and a visit shown again is counted as resumed', () => {
  const { usage, of } = recorder();
  usage.note({ kind: 'opened', parts: 12, findings: 0 });
  usage.note({ kind: 'studio_opened', parts: 12, entry: 'toolbar', direct: true, step: 0 });
  usage.note({ kind: 'hidden', film: film() });
  assert.deepEqual(of('assembly_studio_closed').map(s => s.exit), ['page_hidden']);
  assert.deepEqual(of('make_closed').map(s => [s.exit, s.resumed]), [['page_hidden', false]]);
  usage.note({ kind: 'shown', studio: true });
  usage.note({ kind: 'studio_closed', exit: 'exit', film: film() });
  usage.note({ kind: 'closed', exit: 'done' });
  assert.deepEqual(of('assembly_studio_closed').map(s => [s.exit, s.entry]), [['page_hidden', 'toolbar'], ['exit', 'resumed']]);
  assert.deepEqual(of('make_closed').map(s => [s.exit, s.resumed]), [['page_hidden', false], ['done', true]]);
  assert.equal(of('make_opened').length, 1, 'a resumed visit is not a new opening');
});

test('every Make event is in the registry and its summary survives the property cleaning whole', () => {
  const { usage, sent } = recorder();
  usage.note({ kind: 'opened', parts: 12, findings: 0 });
  usage.note({ kind: 'studio_opened', parts: 12, entry: 'toolbar', direct: true, step: 0 });
  usage.note({ kind: 'studio_closed', exit: 'exit', film: film() });
  usage.note({ kind: 'closed', exit: 'done' });
  for (const { event, properties } of sent) {
    assert.ok(Object.hasOwn(ANALYTICS_EVENTS, event), event);
    assert.deepEqual(cleanProperties(properties), properties, event + ' keeps every property');
  }
});

test('a blocker is counted by the rule it breaks, never by the piece or board it names', () => {
  const wideDoor = inspect(alone({ ...createInitialDesign(), w: 200, n: 1, wt: [1], doors: 'hinged' } as EditorDesign), { profiles: [] });
  const blockers = assemblyGate(wideDoor.evaluation, 1).blockers;
  assert.ok(blockers.length > 0);
  for (const f of blockers) {
    const rule = findingRule(f);
    assert.match(rule, /^[a-z]+:[a-z][a-z-]*$/, rule);
    if (f.mark) assert.ok(!rule.includes(f.mark), rule);
  }
  assert.equal(findingRule({ id: 'drilling:W1:12:edge:0', pack: 'drilling', mark: 'W1' }), 'drilling:edge');
  assert.equal(findingRule({ id: 'buildability:W2:mechanism::3', pack: 'buildability', mark: 'W2' }), 'buildability:mechanism');
  assert.equal(findingRule({ id: 'engineering:sag:W1:2.1', pack: 'engineering', mark: 'W1' }), 'engineering:sag');
  assert.equal(findingRule({ id: 'manufacturing:clash:W1:W2', pack: 'manufacturing', mark: 'W1' }), 'manufacturing:clash');
});
