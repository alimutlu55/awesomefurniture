// Door/window clearances on one wall, including phone selection and a touch drag.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = path.join(__dirname, '../docs/verification/studio-opening-clearances');
const spec = { specVersion: 1, room: { width: 400, depth: 350, openings: [
  { wall: 2, kind: 'window', from: 34, width: 120, height: 120, sill: 90 },
  { wall: 2, kind: 'door', from: 200, width: 80, height: 205 },
] }, wardrobes: [] };
(async () => {
  fs.mkdirSync(shots, { recursive: true });
  for (const [engine, type, widths] of [['chromium', chromium, [375, 1440]], ['webkit', webkit, [375]]]) {
    const browser = await type.launch({ headless: true });
    try { for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: width === 375 ? 812 : 900 }, hasTouch: width === 375, isMobile: width === 375 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('https://*.supabase.co/**', r => r.fulfill({ status: 400, body: '{}' }));
      await page.addInitScript(() => localStorage.setItem('wardrobeForge.lengthUnit', 'mm'));
      await page.goto(base + '/editor.html#spec=' + encodeURIComponent(JSON.stringify(spec)));
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      const gap = page.locator('.sp2d-dimension-label .sp2d-dim-text').filter({ hasText: /^460 mm$/ });
      const point = async locator => {
        const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      for (const [name, selector] of [['window', '.sp2d-window-glass'], ['door', '.sp2d-door-leaf']]) {
        const p = await point(page.locator(selector));
        if (width === 375) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
        await gap.waitFor();
        assert.equal(await gap.count(), 1, 'one shared edge-to-edge clearance when ' + name + ' is selected');
        const value = await gap.boundingBox();
        assert.ok(value.x >= 0 && value.x + value.width <= width, 'gap is within the viewport');
        const own = page.locator('.sp2d-dimension-label.sp2d-accent .sp2d-dim-text');
        assert.match(await own.textContent(), name === 'door' ? /800 mm × 2050 mm/ : /1200 mm × 1200 mm/);
        await page.locator('.mobile-feedback').waitFor({ state: 'hidden', timeout: 15000 });
        await page.screenshot({ path: path.join(shots, `${engine}-${width}-${name}.png`) });
      }
      if (engine === 'chromium' && width === 375) {
        const p = await point(page.locator('.sp2d-window-glass'));
        const zoom = await page.locator('[data-editor-id="sp2d-world"]').evaluate(e => e.getScreenCTM().a);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
        for (let n = 1; n <= 6; n++) await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + 20 * zoom * n / 6, id: 1 }],
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.locator('.sp2d-dimension-label .sp2d-dim-text').filter({ hasText: /^260 mm$/ }).waitFor();
        await page.locator('[data-editor-id="undo2"]').tap(); await gap.waitFor();
      }
      assert.deepEqual(errors, []);
      console.log('PASS', engine, width, 'both selections show the shared gap; own sizes preserved');
      await page.close();
    } } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
