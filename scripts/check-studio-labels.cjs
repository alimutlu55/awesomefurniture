const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.addInitScript(() => localStorage.setItem('wardrobeForge.lengthUnit', 'mm'));
      await page.goto(base + '/#spec=' + encodeURIComponent(JSON.stringify({
        specVersion: 1, room: { width: 500, depth: 400 }, wardrobes: [{ against: 1, width: 140, height: 180, autoDesign: false }],
      })));
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const read = () => page.locator('.sp2d-svg').evaluate(svg => {
        const text = svg.querySelector('.sp2d-dimension-label .sp2d-dim-text');
        return { font: Number.parseFloat(getComputedStyle(text).fontSize), zoom: svg.querySelector('[id$="sp2d-world"]').getScreenCTM().a };
      });
      await page.locator('.sp2d-dimension-label').first().waitFor();
      await page.mouse.move(width / 2, 440);
      let previous = await read();
      for (let n = 0; n < 6; n++) {
        await page.mouse.wheel(0, 120); await frame();
        const current = await read();
        assert.ok(current.font <= previous.font + .01, 'Zooming out never enlarges labels');
        if (current.zoom <= .6) assert.ok(Math.abs(current.font / current.zoom - 20) < .05, 'Text scales with the plan');
        previous = current;
      }
      const labels = page.locator('.sp2d-plan-label');
      assert.ok(await labels.count() > 0);
      assert.equal(await page.locator('[data-edit-wall]').count(), 0, 'No label edit actions remain');
      assert.equal(await labels.locator('[role="button"]').count(), 0);
      assert.ok(await labels.evaluateAll(es => es.every(e => getComputedStyle(e).pointerEvents === 'none')));
      const label = await page.locator('.sp2d-dimension-label').first().boundingBox();
      await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2); await frame();
      assert.equal(await page.locator('[data-editor-id="left"]').isVisible(), false, 'Label tap does not open settings');
      assert.ok(await page.locator('.sp2d-dimension-line line').count() > 0, 'Architectural dimension lines are visible');
      assert.equal(await page.locator('.sp2d-dimension-label rect').count(), 0, 'Dimension text has no badge background');
      await page.screenshot({ path: '/tmp/studio-overview-labels-' + width + '.png' });
      for (let n = 0; n < 12; n++) { await page.mouse.wheel(0, -120); await frame(); }
      assert.ok((await read()).font <= 12.01, 'Zooming in cannot make labels oversized');
      console.log('PASS ' + width + ': proportional overview labels, maximum text size, dimension lines, no click actions');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
