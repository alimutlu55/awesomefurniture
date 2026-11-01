// The door change survives: from the welcome's Bedroom wall wardrobe, Fronts → Hinged by real clicks; Make → Parts →
// Hardware lists hinges; after a reload the doors are still hinged and Make still lists the hinges.
// Dev server on 127.0.0.1:4173 (MOBILE_TEST_URL overrides). RUNS=10 repeats it.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173', RUNS = Number(process.env.RUNS || 1);

async function hardware(page, el) {
  const toolbar = el('toolbar');
  await toolbar.locator('[data-action="make"]').click();
  await page.waitForTimeout(400);
  await toolbar.locator('[data-action="make-parts"]').click();
  const panel = page.locator('.make-panel');
  await panel.waitFor({ state: 'visible' });
  await panel.locator('[data-tab="hardware"]').click();
  await page.waitForTimeout(300);
  const text = await panel.innerText();
  await toolbar.locator('[data-action="make-done"]').click();
  await page.waitForTimeout(400);
  return text;
}
async function selectWardrobe(page, el) {
  const context = () => el('toolbar').getAttribute('data-context'), view = await el('view').boundingBox();
  for (const [fx, fy] of [[.5, .45], [.5, .55], [.45, .5], [.55, .4]]) {
    // A fitting picked through the doors goes back up to its wardrobe.
    for (let k = 0; k < 3 && await context() !== 'wardrobe' && await context() !== 'default' && await context(); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
    if (await context() === 'wardrobe') return;
    await page.mouse.click(view.x + view.width * fx, view.y + view.height * fy);
    await page.waitForTimeout(350);
  }
  if (await context() !== 'wardrobe') throw new Error('could not select the wardrobe: toolbar is ' + await context());
}
async function doorsPressed(page, el) {
  await el('toolbar').locator('[data-action="more"]').click();
  await page.waitForTimeout(250);
  await page.locator('[data-action="fronts"]:visible').first().click();
  await page.waitForTimeout(300);
  return page.locator('[data-d]:visible').evaluateAll(es => es.filter(e => e.classList.contains('on') || e.getAttribute('aria-pressed') === 'true').map(e => e.dataset.d));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (let run = 1; run <= RUNS; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const el = id => page.locator(`[data-editor-id="${id}"]`);
      // The welcome builds the Bedroom wall wardrobe.
      await page.goto(BASE + '/editor.html?welcome=1');
      const welcome = page.locator('.xp-welcome');
      await welcome.waitFor({ state: 'visible' });
      await welcome.locator('[data-space="bedroom"]').click();
      await welcome.locator('.xp-next').click();
      await welcome.locator('.xp-next').click();
      await welcome.waitFor({ state: 'hidden', timeout: 60000 });
      await page.waitForTimeout(2500);
      // Fronts → Hinged, by clicks.
      await selectWardrobe(page, el);
      await el('toolbar').locator('[data-action="more"]').click();
      await page.waitForTimeout(250);
      await page.locator('[data-action="fronts"]:visible').first().click();
      await page.locator('[data-d="hinged"]:visible').first().click();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await selectWardrobe(page, el);
      const before = await hardware(page, el);
      assert.match(before, /hinge/i, 'run ' + run + ': Make lists hinges after Hinged is chosen\n' + before);
      // Reload: the doors are still there.
      await page.waitForTimeout(1500);
      await page.reload();
      await el('add-furniture-btn').waitFor();
      await page.waitForTimeout(2500);
      await selectWardrobe(page, el);
      assert.deepEqual(await doorsPressed(page, el), ['hinged'], 'run ' + run + ': the doors are still hinged after a reload');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await selectWardrobe(page, el);
      const after = await hardware(page, el);
      assert.match(after, /hinge/i, 'run ' + run + ': Make still lists hinges after a reload');
      assert.deepEqual(errors, []);
      console.log('Door persistence run ' + run + ' passed');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
