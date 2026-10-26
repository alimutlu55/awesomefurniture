const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createAddMenuPresenter } = require('../src/presentation/editor/add-menu-presenter.js');
const { createEditorState } = require('../src/application/projects/editor-state.ts');
const { createWardrobeGeometry } = require('../src/domain/geometry/wardrobe-geometry.js');

test('Add to wall does not include the All tab or force wardrobe items', () => {
    // 1. Verify CSS does not force button[data-category="all"] to display:flex
    const css = readFileSync(path.join(__dirname, '../src/presentation/editor/mobile-sheet.css'), 'utf8');
    assert.ok(!css.includes('button[data-category="all"]'), 'mobile-sheet.css must not have rogue display:flex for all button');

    // 2. Set up DOM for add menu presenter
    const categoriesEl = {
        innerHTML: '',
        ownerDocument: { createElement: () => ({ className: '', textContent: '' }) },
        prepend() {},
        querySelector() { return null; },
        querySelectorAll(sel) {
            if (sel === '[data-wall-tab]') return this._wallTabs || [];
            if (sel === '[data-category]') return this._catButtons || [];
            return [];
        }
    };
    const productsEl = {
        innerHTML: '',
        querySelectorAll() { return []; },
        scrollLeft: 0
    };
    const browserEl = {
        querySelector(sel) {
            if (sel === '.mobile-add-categories') return categoriesEl;
            if (sel === '.mobile-add-products') return productsEl;
            if (sel === '[data-add-wardrobe]') return { onclick: null };
            return null;
        }
    };
    const pop2 = {
        dataset: { addContext: 'wall' },
        querySelector(sel) {
            if (sel === '.mobile-add-browser') return browserEl;
            return null;
        },
        querySelectorAll() { return []; }
    };

    const elements = {
        '#add-intent': { innerHTML: '' },
        '#padd': { innerHTML: '' },
        '#padd2': { innerHTML: '' },
        '#more-count': { textContent: '' },
        '#padd-shapes': { innerHTML: '' },
        '#pop2': pop2,
        '#launch-wizard': { click() {} }
    };

    const state = createEditorState();
    const model = { activeCabinet: () => ({ state }) };
    const geometry = createWardrobeGeometry(() => state);
    const selectionState = { addKey: null };

    const presenter = createAddMenuPresenter({
        $: id => elements[id],
        model,
        selectionState,
        geometry,
        addCabinet: () => {},
        roomProducts: () => ''
    });

    presenter.renderAddChoices();

    // Verify categories markup does not contain data-category="all"
    assert.ok(!categoriesEl.innerHTML.includes('data-category="all"'), 'categories markup must not contain all tab');
    assert.ok(!categoriesEl.innerHTML.includes('>All<'), 'categories markup must not have an All button');
    assert.ok(categoriesEl.innerHTML.includes('data-category="utilities"'), 'wall categories must include utilities');
    assert.ok(categoriesEl.innerHTML.includes('data-category="openings"'), 'wall categories must include openings');
});
