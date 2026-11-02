const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390 });
      const spec = { specVersion: 1, room: { width: 500, depth: 400 }, wardrobes: [{ against: 1, width: 140, height: 180, autoDesign: false }] };
      await page.goto(base + '/#spec=' + encodeURIComponent(JSON.stringify(spec)));
      const mode = name => page.locator('button[data-view-mode="' + name + '"]');
      const app = page.locator('[data-editor-id="app"]');
      const planner = page.locator('.studio-2d-planner');
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const tap = async locator => {
        const p = await locator.evaluate(el => {
          const points = [...el.points], m = el.getScreenCTM();
          const x = points.reduce((s, p) => s + p.x, 0) / points.length;
          const y = points.reduce((s, p) => s + p.y, 0) / points.length;
          return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
        });
        if (width === 390) await page.touchscreen.tap(p.x, p.y);
        else await page.mouse.click(p.x, p.y);
        await frame();
      };
      await mode('studio').click();
      await page.locator('[data-studio-format="2d"]').click();
      await planner.waitFor({ state: 'visible' });
      await tap(page.locator('.sp2d-furn-body').first());
      assert.equal(await page.locator('.sp2d-furniture-item.active').count(), 1, 'Furniture is selected');
      for (const wall of ['w3', 'w1']) {
        await tap(page.locator('.sp2d-wall-poly[data-wall-id="' + wall + '"]'));
        assert.equal(await page.locator('.sp2d-wall-poly.selected').getAttribute('data-wall-id'), wall, 'Wall selection survives furniture redraw');
        assert.equal(await page.locator('.sp2d-furniture-item.active').count(), 0, 'Wall selection clears furniture selection');
        assert.equal(await page.locator('[data-editor-id="toolbar"]').getAttribute('data-context'), 'wall');
        await page.locator('[data-action="wall-size"]').click();
        await page.locator('[data-editor-id="left"][data-room-resize]').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.sp2d-wall-poly.selected').getAttribute('data-wall-id'), wall);
        await page.mouse.click(width - 20, 200);
        await page.locator('[data-editor-id="left"][data-room-resize]').waitFor({ state: 'hidden' });
        await tap(page.locator('.sp2d-furn-body').first());
        assert.equal(await page.locator('.sp2d-furniture-item.active').count(), 1);
        assert.equal(await page.locator('.sp2d-wall-poly.selected').count(), 0);
      }
      await page.locator('[data-tool="wall"]').click();
      await mode('furniture').click();
      await planner.waitFor({ state: 'hidden' });
      assert.equal(await app.getAttribute('data-studio-view'), '3d');
      assert.equal(await app.getAttribute('data-view-mode'), 'furniture');
      assert.equal(await page.locator('[data-editor-id="c"]').isVisible(), true, 'Furniture canvas restored');
      assert.equal(await page.locator('.studio-format-seg').isVisible(), false);
      await page.keyboard.press('w');
      assert.equal(await app.getAttribute('data-studio-view'), '3d');
      await mode('studio').click();
      await planner.waitFor({ state: 'hidden' });
      await page.locator('[data-studio-format="2d"]').click();
      await planner.waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-tool="select"]').getAttribute('class'), 'sp2d-btn active');
      assert.equal(await page.locator('.sp2d-draw-line').count(), 0, 'No unfinished drawing survives mode changes');
      console.log('PASS ' + width + ': furniture-to-wall selection, wall settings, Studio-only 2D, clean re-entry');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
