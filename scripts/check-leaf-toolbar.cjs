// Real browser check: a chosen door leaf's toolbar (P1-05b) at 1440×900 and 375×812. Hinge side hangs the leaf on its
// other side and Leaves splits its opening, each redrawn at once and undone in one step (the doors look as they did);
// Handle opens the handle choice in Fronts. Screenshots go to SHOT_DIR when it is set.
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
      const press = async locator => { if (touch) await locator.tap(); else await locator.click(); await page.waitForTimeout(500); };
      // The doors as drawn: the part of the view the wardrobe stands in, without the toolbar or labels.
      // How much of it differs between two shots: the share of pixels whose brightness moved by more than a little.
      const differ = (a, b) => page.evaluate(async ([a, b]) => {
        const read = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data; };
        const [p, q] = [await read(a), await read(b)], luma = (d, i) => d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
        let n = 0; for (let i = 0; i < p.length; i += 4) if (Math.abs(luma(p, i) - luma(q, i)) > 24) n++;
        return n / (p.length / 4);
      }, [a.toString('base64'), b.toString('base64')]);
      const changed = async (a, b) => await differ(a, b) > .001;
      // The doors look as they did once the view has settled (a sheet or menu fading out tints the whole scene for a moment).
      const settled = async before => {
        for (let k = 0; k < 8; k++) { if (await differ(await doors(), before) < .0002) return true; await page.waitForTimeout(250); }
        return false;
      };
      const doors = () => page.screenshot({ clip: { x: view.x + view.width * .25, y: view.y + view.height * (touch ? .38 : .2), width: view.width * .5, height: view.height * (touch ? .1 : .3) } });
      await tap(.5, .4); await tap(.62);
      assert.equal(await app.getAttribute('data-leaf'), '0.0.1', `${width}: the right leaf is chosen`);
      assert.equal(await toolbar.getAttribute('data-context'), 'leaf', `${width}: the toolbar is the leaf's`);
      assert.deepEqual(await toolbar.locator('.contextual-actions button').evaluateAll(es => es.map(e => e.dataset.action)), ['leaf-hinge', 'leaf-leaves', 'leaf-handle', 'leaf-facts']);
      const shut = await doors();
      // Hinge side: drawn at once, one undo step back to how it was.
      const side = await toolbar.locator('[data-action="leaf-hinge"]').textContent();
      assert.match(side, /^Hinged (left|right)$/, `${width}: the tool says which side the door hangs on`);
      await press(toolbar.locator('[data-action="leaf-hinge"]'));
      assert.ok(await changed(await doors(), shut), `${width}: the leaf hangs on its other side`);
      assert.equal(await toolbar.locator('[data-action="leaf-hinge"]').textContent(), side.endsWith('left') ? 'Hinged right' : 'Hinged left', `${width}: and now says the other`);
      assert.equal(await app.getAttribute('data-leaf'), '0.0.1', `${width}: the leaf stays chosen`);
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/leaf-hinge-${width}x${height}.png` });
      await press(el('undo2'));
      assert.ok(await settled(shut), `${width}: one undo hangs it back`);
      // Leaves: the opening as one leaf; the chosen right leaf is gone, so the one left is chosen. Undo splits it again.
      await press(toolbar.locator('[data-action="leaf-leaves"]'));
      const menu = page.locator('.contextual-popover[role="menu"]');
      assert.deepEqual(await menu.locator('button').allTextContents(), ['1 door', '2 doors']);
      assert.equal(await menu.locator('[aria-checked="true"]').textContent(), '2 doors', `${width}: the opening's count is checked`);
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/leaf-leaves-menu-${width}x${height}.png` });
      await press(menu.locator('[data-action="leaves-1"]'));
      assert.equal(await app.getAttribute('data-leaf'), '0.0.0', `${width}: the leaf left is chosen`);
      assert.ok(await changed(await doors(), shut), `${width}: one leaf across the opening`);
      await press(el('undo2'));
      await tap(.62);
      assert.equal(await app.getAttribute('data-leaf'), '0.0.1', `${width}: the right leaf is back`);
      assert.ok(await settled(shut), `${width}: one undo splits it again (the selection is not part of the design)`);
      // Handle: the handle choice, in Fronts.
      await press(toolbar.locator('[data-action="leaf-handle"]'));
      assert.equal(await el('left').getAttribute('data-context-section'), 'fronts', `${width}: Fronts opens`);
      assert.ok(await page.locator('[data-handle="kind"]').evaluate(e => e.getRootNode().activeElement === e), `${width}: on the handle choice`);
      if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/leaf-handle-${width}x${height}.png` });
      assert.deepEqual(errors, [], `${width}: no page errors`);
      await page.close();
      console.log(`Leaf toolbar ${width}×${height} passed`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
