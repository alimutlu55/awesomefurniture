const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { bindSupportMenu } = require('../src/presentation/editor/shell-bindings.js');

test('editor markup contains support link under the menu with support@furnidraw.com', () => {
    const markup = readFileSync(path.join(__dirname, '../src/presentation/editor/editor.html'), 'utf8');
    assert.match(markup, /id="support-menu"/);
    assert.match(markup, /mailto:support@furnidraw\.com/);
    assert.match(markup, />Support<small>/);
    assert.match(markup, /support@furnidraw\.com<\/small>/);
});

test('bindSupportMenu closes menu, copies support email, and triggers toast', async () => {
    let closed = false;
    let toastMessage = '';
    let copiedText = '';
    const listeners = new Map();

    const mockItem = {
        addEventListener(event, handler) { listeners.set(event, handler); }
    };

    const mockDom = {
        document: {
            getElementById(id) {
                return id === 'support-menu' ? mockItem : null;
            }
        },
        navigator: {
            clipboard: {
                writeText(text) {
                    copiedText = text;
                    return Promise.resolve();
                }
            }
        }
    };

    const mockShell = {
        closeDD() { closed = true; },
        toast(message) { toastMessage = message; }
    };

    const mockLifetime = {
        listen(element, event, handler) {
            element.addEventListener(event, handler);
        }
    };

    bindSupportMenu({ dom: mockDom, shell: mockShell, lifetime: mockLifetime });

    assert.ok(listeners.has('click'));
    const clickHandler = listeners.get('click');
    clickHandler();

    assert.equal(closed, true);
    assert.equal(copiedText, 'support@furnidraw.com');

    // Wait microtask for clipboard promise
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(toastMessage, /support@furnidraw\.com/);
});
