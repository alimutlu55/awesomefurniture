// Start Vite separately; exercises the room editor through public DOM controls.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  fs.mkdirSync('docs/verification', { recursive: true });
  for (const width of [1440, 375]) {
   const mobile = width === 375;
   const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
   const errors = [];
   page.on('pageerror', e => errors.push(e.message));
   const control = id => page.locator(`[data-editor-id="${id}"]`);
   const handle = (kind, id) => page.locator(`[data-room-kind="${kind}"][data-room-id="${id}"]`);
   const field = key => page.locator(`[data-room-field="${key}"]`);
   await page.goto((process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173') + '/editor.html');
   await control('room-toggle').click();
   await page.locator('[data-studio="bedroom"]').click();
   await control('room-edit').click();
   await page.waitForTimeout(700);
   assert.equal(await page.locator('[data-room-kind="wall"]').count(), 4);
   await handle('wall', 'w3').click();
   const length = await field('length').inputValue();
   await field('height').fill('280'); await field('height').blur();
   assert.equal(await field('height').inputValue(), '280');
   await control('undo2').click();
   assert.equal(await field('height').inputValue(), '260');
   await page.locator('[data-room-action="add-door"]').click();
   assert.equal(await page.locator('[data-room-kind="opening"]').count(), 3);
   await handle('opening', 'o3').click();
   await field('width').fill('90'); await field('width').blur();
   assert.equal(await field('width').inputValue(), '90');
   await page.locator('[data-room-action="delete"]').click();
   assert.equal(await page.locator('[data-room-kind="opening"]').count(), 2);
   await handle('wall', 'w3').click();
   assert.equal(await field('length').inputValue(), length);
   // Move the front wall outward, undo once, then cancel a second gesture.
   const box = await handle('wall', 'w3').boundingBox();
   const before = await handle('wall', 'w2').getAttribute('aria-label');
   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
   await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 35, { steps: 8 }); await page.mouse.up();
   assert.notEqual(await handle('wall', 'w2').getAttribute('aria-label'), before, 'wall drag changes joined length');
   await control('undo2').click();
   assert.equal(await handle('wall', 'w2').getAttribute('aria-label'), before, 'one undo restores drag');
   const resetBox = await handle('wall', 'w3').boundingBox();
   await page.mouse.move(resetBox.x + resetBox.width / 2, resetBox.y + resetBox.height / 2);
   await page.mouse.down(); await page.mouse.move(resetBox.x + resetBox.width / 2, resetBox.y + resetBox.height / 2 + 25, { steps: 5 });
   await page.keyboard.press('Escape'); await page.mouse.up();
   assert.equal(await handle('wall', 'w2').getAttribute('aria-label'), before, 'Escape restores drag');
   const panel = await control('room-panel').boundingBox();
   assert.ok(panel.x >= -1 && panel.x + panel.width <= width + 1, 'room panel fits width');
   await page.screenshot({ path: `docs/verification/studio-edit-${width}.png` });
   assert.deepEqual(errors, []);
   console.log(`PASS studio ${width}: fields, openings, drag, undo, cancel and screenshot`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
