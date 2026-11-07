// Design check (Insight panel): a design the manufacturing check blocks shows what is wrong and why, its fix runs the
// editor's own command in one undo step, and the check, prices, passport and change history follow. Phone and desktop.
// Run with the dev or preview server up (MOBILE_TEST_URL, default http://127.0.0.1:4173). SHOTS=<dir> saves screenshots.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = process.env.SHOTS;
const T = { timeout: 120000 };

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const [name, width, height] of [['phone', 375, 812], ['desktop', 1440, 900]]) {
   const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 900, isMobile: width <= 900, deviceScaleFactor: shots ? 2 : 1, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/insight-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/insight-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    // One 124 cm bay: two shelves of bedding over shirts. Its shelves span further than an 18 mm shelf may.
    const state = { ...createEditorState(), w: 124, h: 220, d: 60, n: 1, wt: [1, 100, 100, 100, 100, 100], dividers: [],
     secs: [[{ k: 'shelf', h: 35, purpose: 'linen' }, { k: 'shelf', h: 35, purpose: 'linen' }, { k: 'short', h: 106 }], [], [], [], [], []] };
    window.insightEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: { wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 30, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 } });
   });
   await page.waitForTimeout(1500);
   const scene = () => page.evaluate(() => window.insightEditor.scene().wardrobes[0].state.n);
   const shot = async step => { if (shots) await page.screenshot({ path: `${shots}/insight-${name}-${step}.png` }); };

   await page.locator('[data-editor-id="menu-btn"]').click(T);
   await page.waitForTimeout(300);
   assert.equal(await page.locator('.insight-item .insight-count').innerText(T), '3', `${name}: the menu counts the blocking findings`);
   await page.locator('.insight-item').click(T);
   const panel = page.locator('.insight');
   await panel.locator('.in-finding').first().waitFor(T);
   assert.match(await panel.locator('.in-status').innerText(T), /Not ready to build/);
   const titles = await panel.locator('.in-finding b').allInnerTexts();
   assert.ok(titles.some(t => /Shelf spans 1204 mm/.test(t)), `${name}: the span the manufacturing check blocks is shown while designing`);
   assert.ok(titles.some(t => /bends .* mm with .* kg \(Bedding & linen\)/.test(t)), `${name}: so is the sag under what the planner put on it`);
   await shot('1-findings');

   await panel.locator('.in-fix.primary', { hasText: 'Split the bay' }).first().click(T);
   await page.waitForFunction(() => window.insightEditor.scene().wardrobes[0].state.n === 2, null, T);
   await page.waitForTimeout(400);
   assert.equal(await scene(), 2, `${name}: the fix split the bay`);
   assert.match(await panel.locator('.in-status').innerText(T), /Ready to build|Can be built/, `${name}: nothing blocks once the bay is split`);
   await shot('2-fixed');

   await panel.locator('[data-tab="price"]').click(T);
   assert.equal(await panel.locator('.in-way').count(), 3, `${name}: priced three ways`);
   await panel.locator('[data-currency="pln"]').click(T);
   assert.match(await panel.locator('.in-way b').first().innerText(T), /zł/);
   await shot('3-price');
   await panel.locator('[data-tab="passport"]').click(T);
   assert.ok(await panel.locator('.in-stat').count() >= 9, `${name}: the passport counts parts, sheets, holes, hardware, weight and time`);
   await shot('4-passport');
   await panel.locator('[data-tab="changes"]').click(T);
   assert.match(await panel.locator('.in-changes').innerText(T), /1 → 2 bays/, `${name}: the change history says what the fix did`);
   await shot('5-changes');

   assert.deepEqual(errors, []);
   console.log(`PASS ${width}x${height}: the design check shows a blocked span, splits the bay, and prices, counts and logs the result`);
   await page.evaluate(() => window.insightEditor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
