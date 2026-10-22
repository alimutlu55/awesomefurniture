// Run against the Vite dev server: MOBILE_TEST_URL=http://127.0.0.1:4173 node scripts/check-boundary-cursor.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [375, 1440]) {
   const height = width === 375 ? 812 : 900, touch = width === 375;
   const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/boundary-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/boundary-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
    window.boundaryEditor = mountEditor({ root: document.querySelector('#editor'), initialScene:
     { studio: createStudio('under-stairs'), wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1 } });
   });
   await page.locator('[data-view-mode="studio"]').click();
   await page.locator('[data-action="ceiling"]').click();
   await page.locator('[data-add-ceiling="landing"]:visible').click();
   const toolbar = page.locator('[data-editor-id="toolbar"]');
   let selected = false;
   for (const y of [.51, .53, .55, .49, .45, .57]) {
    for (const x of [.5, .6, .4, .7, .3]) {
     await page.mouse.click(x * width, y * height);
     if (await toolbar.getAttribute('data-context') === 'ceiling') { selected = true; break; }
    }
    if (selected) break;
   }
   assert.ok(selected, 'Ceiling creation selects the new shape');
   await page.waitForTimeout(500);
   const plus = page.locator('.room-handle.split-handle'), grip = page.locator('.room-grip');
   const dimensions = async locator => locator.evaluate(el => { const s = getComputedStyle(el); return [s.width, s.height]; });
   const plusSize = await dimensions(plus);
   assert.equal(plusSize[0], plusSize[1]); assert.deepEqual(await dimensions(grip), plusSize);
   const dots = await page.locator('.room-handle.point').evaluateAll(es => es.map(el => {
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
   }));
   const b = await plus.boundingBox(), origin = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
   let first = 0, distance = Infinity;
   dots.forEach((a, k) => {
    const b = dots[(k + 1) % dots.length], ux = b.x - a.x, uy = b.y - a.y;
    const f = Math.max(0, Math.min(1, ((origin.x - a.x) * ux + (origin.y - a.y) * uy) / (ux * ux + uy * uy)));
    const d = Math.hypot(origin.x - a.x - f * ux, origin.y - a.y - f * uy);
    if (d < distance) { distance = d; first = k; }
   });
   const snapshot = await page.evaluate(() => window.boundaryEditor.snapshot());
   await plus.evaluate(el => el.dataset.testCursor = 'captured');
   const cdp = await page.context().newCDPSession(page);
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...origin, id: 1 }] });
   else { await page.mouse.move(origin.x, origin.y); await page.mouse.down(); }
   for (let offset = 0; offset < dots.length; offset++) {
    const edge = (first + offset) % dots.length, a = offset ? dots[edge] : origin, b = dots[(edge + 1) % dots.length];
    for (let n = 1; n <= 16; n++) {
     const x = a.x + (b.x - a.x) * n / 16, y = a.y + (b.y - a.y) * n / 16;
     if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
     else await page.mouse.move(x, y);
     await page.waitForTimeout(18);
     const box = await plus.boundingBox();
     assert.ok(Math.hypot(box.x + box.width / 2 - x, box.y + box.height / 2 - y) < .2, 'Cursor follows every boundary position');
     assert.equal(await plus.getAttribute('data-test-cursor'), 'captured');
    }
   }
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
   else { await plus.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up(); }
   assert.equal(await page.evaluate(() => window.boundaryEditor.snapshot()), snapshot, 'Cursor movement leaves geometry and history unchanged');
   const restored = await plus.boundingBox();
   assert.ok(Math.hypot(restored.x + restored.width / 2 - origin.x, restored.y + restored.height / 2 - origin.y) < .2);
   await page.screenshot({ path: '/tmp/wardrobe-boundary-' + width + '.png' });
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: ${touch ? 'touch' : 'mouse'} follows the full ceiling outline, cancels, retains its DOM node; + and resize are both ${plusSize.join(' × ')}`);
   await page.evaluate(() => window.boundaryEditor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
