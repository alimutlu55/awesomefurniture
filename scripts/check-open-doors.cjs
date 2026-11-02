// Real browser check: Open doors in a selected piece's More menu (P1-12) at 1440×900 and 375×812. With reduced motion
// the doors are open at once (no frames in between); pressed again they close to exactly how they were. Without reduced
// motion they swing (a moment after the press they are not yet where they end). Screenshots go to SHOT_DIR when it is set.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const [width, height] of [[1440, 900], [375, 812]]) for (const reduced of [true, false]) {
      const touch = width < 900, page = await browser.newPage({ viewport: { width, height }, isMobile: touch, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto((process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173') + '/#spec=' + encodeURIComponent(JSON.stringify({ specVersion: 1,
        wardrobes: [{ width: 200, height: 230, depth: 60, doors: 'hinged', for: { long: 4, short: 6, folded: 20 } }] })));
      const el = id => page.locator(`[data-editor-id="${id}"]`), toolbar = el('toolbar');
      await el('add-furniture-btn').waitFor(); await page.waitForTimeout(800);
      const view = await el('view').boundingBox();
      const x = view.x + view.width / 2, y = view.y + view.height * .4;
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      await page.waitForTimeout(900);
      // How much two shots of the view differ: the share of pixels whose brightness moved by more than a little.
      const shot = () => page.screenshot({ clip: { x: view.x, y: view.y + view.height * .1, width: view.width, height: view.height * .6 } });
      const differ = (a, b) => page.evaluate(async ([a, b]) => {
        const read = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data; };
        const [p, q] = [await read(a), await read(b)], luma = (d, i) => d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
        let n = 0; for (let i = 0; i < p.length; i += 4) if (Math.abs(luma(p, i) - luma(q, i)) > 24) n++;
        return n / (p.length / 4);
      }, [a.toString('base64'), b.toString('base64')]);
      const toggle = async () => {
        await toolbar.locator('[data-action="more"]').click();
        await page.locator('.contextual-popover [data-action="open-doors"]').click();
      };
      const shut = await shot();
      await toggle(); await page.waitForTimeout(60);
      const early = await shot();
      await page.waitForTimeout(1500);
      const open = await shot();
      assert.ok(await differ(open, shut) > .05, `${width}: the doors are open`);
      if (reduced) assert.ok(await differ(early, open) < .002, `${width}: with reduced motion they are open at once`);
      else assert.ok(await differ(early, open) > .002, `${width}: without it they swing`);
      if (reduced && process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/open-${width}x${height}.png` });
      await toggle(); await page.waitForTimeout(1500);
      assert.ok(await differ(await shot(), shut) < .002, `${width}: pressed again they close as they were`);
      if (reduced && process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/closed-${width}x${height}.png` });
      assert.deepEqual(errors, [], `${width}: no page errors`);
      await page.close();
      console.log(`Open doors ${width}×${height}${reduced ? ' reduced motion' : ''} passed`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
