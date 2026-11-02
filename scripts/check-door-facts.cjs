// Real browser check: a chosen door leaf's Details (P1-11) at 1440×900 and 375×812 open the toolbar's own popover with
// that leaf's facts: its drawing, size, hinges, handle and rule status. Screenshots go to SHOT_DIR when it is set.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) {
      const touch = width < 900, page = await browser.newPage({ viewport: { width, height }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto((process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173') + '/#spec=' + encodeURIComponent(JSON.stringify({ specVersion: 1, wardrobes: [{ width: 200, height: 230, depth: 60, doors: 'hinged' }] })));
      const el = id => page.locator(`[data-editor-id="${id}"]`), app = el('app'), toolbar = el('toolbar');
      await el('add-furniture-btn').waitFor(); await page.waitForTimeout(800);
      const view = await el('view').boundingBox(), fy = touch ? .56 : .4;
      const tap = async (fx, y = fy) => {
        const x = view.x + view.width * fx, yy = view.y + view.height * y;
        if (touch) await page.touchscreen.tap(x, yy); else await page.mouse.click(x, yy);
        await page.waitForTimeout(400);
      };
      await tap(.5, .4); await tap(.62);
      const key = await app.getAttribute('data-leaf');
      assert.match(key ?? '', /^\d\.\d+\.\d$/, `${width}: a leaf is chosen`);
      await toolbar.locator('[data-action="leaf-facts"]').click(); await page.waitForTimeout(300);
      const facts = page.locator(`.contextual-popover [data-door-facts="${key}"]`);
      await facts.waitFor();
      const text = (await facts.textContent()).replace(/\s+/g, ' ');
      assert.match(text, /Size\s*\d+ × \d+ × \d+ mm/, `${width}: its size`);
      assert.match(text, /Hinges\s*\d+ × Concealed hinge/, `${width}: its hinges`);
      assert.match(text, /Handle\s*Bar handle 128 mm/, `${width}: its handle`);
      assert.match(text, /Rules\s*(OK|Check|Problem)/, `${width}: what the rules say`);
      assert.equal(await facts.locator('svg rect').count() >= 4, true, `${width}: a drawing with its hinges and handle`);
      const box = await facts.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${width}: inside the screen`);
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/door-facts-${width}x${height}.png` });
      assert.deepEqual(errors, [], `${width}: no page errors`);
      await page.close();
      console.log(`Door facts ${width}×${height} passed: ${text.slice(0, 120)}`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
