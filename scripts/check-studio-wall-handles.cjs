const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390 });
      await page.goto(base + '/#spec=' + encodeURIComponent(JSON.stringify({ specVersion: 1, room: { template: 'wall' }, wardrobes: [] })));
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const handles = page.locator('[data-extend-id]');
      const walls = page.locator('.sp2d-wall-poly');
      assert.equal(await page.locator('.sp2d-floating-toolbar,[data-tool]').count(), 0, 'Select / Draw wall toolbar is gone');
      assert.equal(await handles.count(), 2, 'A plus is available at each open wall end');
      for (const id of ['c2', 'c1']) {
        const handle = page.locator('[data-extend-id="' + id + '"]');
        const box = await handle.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width, 'Add-wall handle is reachable');
        if (width === 390) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        else await handle.click();
        await frame();
        assert.equal(await handles.count(), 2, 'Only the two free ends keep plus controls');
        assert.equal(await handle.count(), 0, 'The newly joined corner is no longer a free end');
      }
      assert.equal(await walls.count(), 3);
      await page.locator('[data-editor-id="undo2"]').click(); await frame();
      assert.equal(await walls.count(), 2, 'One undo removes one wall');
      await page.locator('[data-editor-id="redo2"]').click(); await frame();
      assert.equal(await walls.count(), 3, 'Redo restores the added wall');
      await handles.last().focus(); await page.keyboard.press('Enter'); await frame();
      assert.equal(await walls.count(), 4, 'The plus control also supports keyboard activation');
      await page.screenshot({ path: '/tmp/studio-wall-handles-' + width + '.png' });
      await page.evaluate(() => window.furnidraw.build({ specVersion: 1, room: { width: 400, depth: 350 }, wardrobes: [] }));
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      assert.equal(await handles.count(), 0, 'Closed rooms do not regain midpoint plus handles');
      console.log('PASS ' + width + ': open-end plus controls, add connected walls, Undo/Redo, keyboard access, no drafting toolbar');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
