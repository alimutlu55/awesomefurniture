const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { openSize, setSize } = require('./lib/size-field.cjs');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [375, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true, isMobile: width === 375, reducedMotion: 'reduce' });
   page.setDefaultTimeout(10000);
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route('https://*.supabase.co/**', route => route.fulfill({ status: 400, body: '{}' }));
   const spec = { specVersion: 1, wardrobes: [{ width: 200, height: 230, depth: 60 }] };
   await page.goto(base + '/editor.html#spec=' + encodeURIComponent(JSON.stringify(spec)));
   const el = id => page.locator(`[data-editor-id="${id}"]`);
   const actualWidth = () => page.evaluate(() => window.furnidraw.describe().wardrobes[0].width);
   await el('c').waitFor({ state: 'visible' });
   await page.waitForFunction(() => window.furnidraw?.describe().wardrobes[0]?.width === 200);
   await el('c').click();
   const resize = el('toolbar').locator('[data-action="resize"]');
   await resize.waitFor({ state: 'visible', timeout: 10000 }).catch(async error => {
    console.error(await page.locator('body').innerText());
    console.error(errors);
    await page.screenshot({ path: `/tmp/wardrobe-width-failure-${width}.png` });
    throw error;
   });
   await openSize(page);
   await setSize(page, 'w', 20);
   await page.waitForFunction(() => window.furnidraw.describe().wardrobes[0].width === 20);
   await el('c').focus(); await page.keyboard.press('ControlOrMeta+z');
   await page.waitForFunction(() => window.furnidraw.describe().wardrobes[0].width === 200);
   // Out of range is refused, never quietly changed into another size (the Size drawing's rule).
   await setSize(page, 'w', 19); await page.waitForTimeout(250);
   assert.equal(await actualWidth(), 200, 'a width under 20 cm is refused');
   await setSize(page, 'w', 40);
   await page.waitForFunction(() => window.furnidraw.describe().wardrobes[0].width === 40);
   await el('c').focus(); await page.keyboard.press('ControlOrMeta+z');
   await page.waitForFunction(() => window.furnidraw.describe().wardrobes[0].width === 200);
   await page.screenshot({ path: `/tmp/wardrobe-width-${width}.png` });
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: the width field reaches 20 cm, refuses less and undoes`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
