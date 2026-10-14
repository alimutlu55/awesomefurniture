const { test } = require('node:test');
const assert = require('node:assert/strict');
const { takeMobilePanel } = require('../src/presentation/editor/mobile-panel-owner.js');
for (const width of [390, 900, 901, 1440, 1920]) {
 test(`${width}px: a newly opened panel replaces the previous editing surface`, () => {
  const nodes = new Map();
  const $ = id => {
   if (!nodes.has(id)) {
    const classes = new Set(['show', 'props-open', 'inspecting', 'adding']);
    nodes.set(id, { hidden: false, attributes: {}, classList: {
     contains: key => classes.has(key), remove: (...keys) => keys.forEach(key => classes.delete(key))
    }, setAttribute(key, value) { this.attributes[key] = value; },
    getRootNode: () => ({querySelectorAll: () => []}), click() { $('#wizard').hidden = true; } });
   }
   return nodes.get(id);
  };
  const panel = $('#pop3');
  takeMobilePanel({ width, $ }, panel);
  assert.equal(panel.classList.contains('show'), true);
  assert.equal($('#pop2').classList.contains('show'), false);
  assert.equal($('#pop4').classList.contains('show'), false);
  for (const cls of ['props-open', 'inspecting', 'adding']) assert.equal($('#app').classList.contains(cls), false);
  for (const [trigger, id] of [['menu-btn','menu'], ['fitchip','plan-panel'], ['help-btn','help-panel']]) {
   assert.equal($('#'+id).hidden, true);
   assert.equal($('#'+trigger).attributes['aria-expanded'], 'false');
  }
  assert.equal($('#wizard').hidden, true);
 });
}
