// Real browser check: a tap or click on a shut door of the chosen wardrobe chooses that one leaf (named on the editor as
// bay.row.leaf), with the mouse at 1440×900 and by touch at 375×812; Escape or a tap on empty space lets it go, and with
// the doors open a tap reaches inside instead. Choosing a leaf is not an undo step and is not saved.
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
      const el = id => page.locator(`[data-editor-id="${id}"]`), app = el('app');
      await el('add-furniture-btn').waitFor(); await page.waitForTimeout(800);
      const tap = async (fx, fy) => {
        const view = await el('view').boundingBox(), x = view.x + view.width * fx, y = view.y + view.height * fy;
        if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        await page.waitForTimeout(350);
      };
      // Where the doors are: the phone frames the wardrobe lower, with its Add item pill across the middle.
      const fy = touch ? .56 : .4, leaf = () => app.getAttribute('data-leaf');
      const saved = () => page.evaluate(() => JSON.stringify(window.furnidraw.describe()));
      // The first tap chooses the wardrobe (the editor's outer layer); a door is chosen inside it.
      await tap(.5, .4);
      assert.equal(await leaf(), null, `${width}: choosing the wardrobe chooses no leaf`);
      const before = await saved(), undo = el('undo2'), undoable = await undo.isEnabled();
      // The doors' leaves: one tap at a time across the front, each names the leaf under it, from left to right.
      const seen = [];
      for (const fx of [.38, .45, .55, .62]) {
        await tap(fx, fy);
        const key = await leaf();
        assert.match(key ?? '', /^\d\.\d+\.\d$/, `${width}: a tap on a shut door at ${fx} chooses a leaf`);
        seen.push(key);
      }
      const order = seen.map(k => k.split('.').map(Number)).map(([bay, , n]) => bay * 10 + n);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${width}: leaves left to right ${seen}`);
      assert.ok(new Set(seen).size > 1, `${width}: different doors are different leaves (${seen})`);
      await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/leaf-selected-${width}x${height}.png` : `/tmp/door-selection-${width}.png` });
      await tap(.62, fy);
      assert.equal(await leaf(), seen[3], `${width}: the same door again is the same leaf`);
      assert.equal(await saved(), before, `${width}: choosing a leaf changes nothing in the design`);
      assert.equal(await undo.isEnabled(), undoable, `${width}: choosing a leaf is not an undo step`);
      // Escape lets the leaf go (the bay it closes stays chosen); so does a tap on empty space.
      if (!touch) {
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        assert.equal(await leaf(), null, `${width}: Escape lets the leaf go`);
        await tap(.45, fy);
        assert.match(await leaf() ?? '', /^\d\.\d+\.\d$/);
      }
      await tap(.06, .12);
      assert.equal(await leaf(), null, `${width}: a tap on empty space lets the leaf go`);
      // With the doors open a tap reaches inside: the bay, not a leaf.
      await tap(.5, .4);
      await el('open').evaluate(b => b.click()); await page.waitForTimeout(900);
      await tap(.45, fy);
      assert.equal(await leaf(), null, `${width}: with the doors open a tap chooses no leaf`);
      assert.deepEqual(errors, [], `${width}: no page errors`);
      await page.close();
      console.log(`Door selection ${width}×${height} passed: ${seen.join(', ')}`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
