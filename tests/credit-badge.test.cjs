const { test } = require('node:test');
const assert = require('node:assert/strict');

function makeElement(tagName = 'div') {
  const el = {
    tagName: tagName.toUpperCase(),
    className: '',
    hidden: false,
    dataset: {},
    innerHTML: '',
    textContent: '',
    children: [],
    style: {},
    append(child) {
      el.children.push(child);
    },
    querySelector() {
      return makeElement('div');
    },
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    focus() {},
  };
  return el;
}

const mockPage = {
  createElement(tag) {
    return makeElement(tag);
  },
};

test('credit badge displays "Free trial" when freeLeft is available', async () => {
  const { bindCreditGate } = await import('../src/presentation/credits/credit-gate.ts');

  let currentFeature = { key: 'technical-drawings', cost: 10, freeLeft: 1 };
  let currentPass = null;
  const subscribers = [];

  const mockClient = {
    feature(key) { return currentFeature; },
    pass(key) { return currentPass; },
    subscribe(fn) {
      subscribers.push(fn);
      return () => {
        const idx = subscribers.indexOf(fn);
        if (idx >= 0) subscribers.splice(idx, 1);
      };
    },
    spend: async () => {},
  };

  const host = makeElement('div');
  const target = makeElement('button');
  const lifetime = { listen() {}, cleanup() {} };

  const gate = bindCreditGate({
    client: mockClient,
    page: mockPage,
    host,
    lifetime,
    toast() {},
    openWallet() {},
    needsAccount: () => false,
  });

  gate.badge(target, 'technical-drawings');

  const badgeEl = target.children.find(c => c.className === 'cr-badge');
  assert.ok(badgeEl, 'badge element exists');
  assert.equal(badgeEl.innerHTML, 'Free trial', 'displays Free trial when free uses remain');
  assert.equal(badgeEl.dataset.kind, 'free');

  // When a pass is active:
  currentPass = { expiresAt: Date.now() + 86400000 };
  subscribers.forEach(s => s());
  assert.equal(badgeEl.innerHTML, 'Open');
  assert.equal(badgeEl.dataset.kind, 'pass');

  // When paid (no free uses, no pass):
  currentPass = null;
  currentFeature = { key: 'technical-drawings', cost: 10, freeLeft: 0 };
  subscribers.forEach(s => s());
  assert.equal(badgeEl.innerHTML.startsWith('10'), true);
  assert.equal(badgeEl.dataset.kind, 'paid');
});
