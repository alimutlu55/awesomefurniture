const { test } = require('node:test');
const assert = require('node:assert/strict');

test('diagnostic tags retain the affected fitting and relevant dimensions', async () => {
  const { issueTags, tags, noticeLabels } = await import('../src/presentation/editor/storage-tags.js');
  assert.deepEqual(issueTags('Bay 2, item 3: rail exceeds your 185 cm comfortable reach.'), ['Bay 2, item 3', 'Out of reach', '185 cm']);
  assert.deepEqual(issueTags('Open folded shelves are 60 cm deep, so the back row is hidden. Drawers or pull-outs are easier to use.'), ['Back row hard to reach', '60 cm']);
  assert.deepEqual(noticeLabels('Drawer needs 25 cm of height but only 12 cm is free here, and there is not enough width for this item'), ['Drawer', 'Needs 25 cm', 'Free 12 cm', 'Insufficient width']);
  assert.match(tags(['<img src=x>']), /&lt;img src=x&gt;/);
});

test('Storage panel replaces proposal prose with fit tags and keeps capacity bars', async () => {
  const { createPlannerPresenter } = await import('../src/presentation/editor/planner-presenter.js');
  const elements = Object.fromEntries(['empty-scene', 'plan-title', 'plan-summary', 'plan-capacity', 'plan-warnings'].map(id => ['#' + id, {}]));
  const state = { n: 2, profile: { engaged: true, needs: { short: 24 }, growth: 15, reach: 185 }, proposal: { title: 'Best match', summary: 'This long explanation should never appear.' } };
  const presenter = createPlannerPresenter({ dom: { $: key => elements[key] }, model: { activeCabinet: () => ({ state }) }, geometry: { stats: () => ({ mods: 3 }) }, plannerState: {} });
  presenter.planUI({ capacities: { short: 16 }, coverage: { short: 16 / 28 }, maxDailyAccess: 180, ergo: .62, seasonal: { fill: true, allocatedBoxes: 1 }, errors: ['Bay 2, item 3: rail exceeds your 185 cm comfortable reach.'], warnings: ['Open folded shelves are 60 cm deep, so the back row is hidden. Drawers or pull-outs are easier to use.'] });
  assert.match(elements['#plan-summary'].innerHTML, /Some items won’t fit/);
  assert.doesNotMatch(elements['#plan-summary'].innerHTML, /Growth|sections|Score/);
  assert.match(elements['#plan-capacity'].innerHTML, /~16 \/ 24/);
  assert.match(elements['#plan-capacity'].innerHTML, /class="bar"/);
  assert.match(elements['#plan-capacity'].innerHTML, /Fits \/ Owned/);
  assert.match(elements['#plan-warnings'].innerHTML, /Bay 2, item 3/);
  assert.match(elements['#plan-warnings'].innerHTML, /Back row hard to reach/);
  assert.doesNotMatch(Object.values(elements).map(el => el.innerHTML || '').join(''), /<p\b|long explanation|Drawers or pull-outs|room to grow/);
  state.profile.engaged = false;
  assert.match(presenter.storedNow({ capacities: { short: 0, long: 0, pants: 0, folded: 0, shoes: 0, small: 0, seasonalBoxes: 0 } }), /Empty/);
});

test('editor notifications do not render popups or schedule timers', async () => {
  const { createEditorShell } = await import('../src/presentation/editor/editor-shell.js');
  const shell = createEditorShell({ dom: { $() { assert.fail('Notification must not query the DOM'); } }, shellState: {}, lifetime: { timeout() { assert.fail('Notification must not schedule a timer'); } } });
  shell.toast('3 sections · Redesigned · 92% fit', { label: 'Undo', fn() { assert.fail('Undo must remain an explicit toolbar action'); } });
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/presentation/editor/editor.html'), 'utf8');
  assert.doesNotMatch(html, /id="toast"/);
  assert.match(html, /id="undo2"/);
});
