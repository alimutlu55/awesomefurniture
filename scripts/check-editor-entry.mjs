import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.EDITOR_ENTRY_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch();

try {
  for (const width of [390, 1365]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, reducedMotion: 'reduce' });
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { value: false }));
    await context.route('https://*.supabase.co/**', route => route.fulfill({ status: 400, json: {} }));
    await context.route('**/api/credits', route => route.fulfill({ status: 503, json: { error: { code: 'CREDITS_UNAVAILABLE' } } }));
    const events = [];
    await context.route('**/api/analytics', route => {
      const batch = route.request().postDataJSON();
      events.push(...batch.events);
      return route.fulfill({ status: 204 });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const welcome = page.locator('.xp-welcome');
    const pieces = () => page.evaluate(() => window.__furnidrawEditor?.scene().wardrobes.map(cabinet => ({
      product: cabinet.state.product, width: cabinet.state.w, shape: cabinet.state.shape?.template,
    })));
    const add = () => page.getByRole('button', { name: 'Add furniture', exact: true }).click();
    const flush = async event => {
      if (events.some(item => item.event === event)) return;
      await page.waitForResponse(res => res.url().endsWith('/api/analytics') && events.some(item => item.event === event));
    };
    const drawings = async () => {
      await page.getByRole('dialog', { name: 'Technical drawings', exact: true }).locator('.drawings-sheet').first().waitFor();
    };
    const closeDrawings = () => page.getByRole('button', { name: 'Close technical drawings', exact: true }).click();

    await page.goto(base + '/wardrobe-designer/');
    await page.locator('button[data-shape="alcove"]').click();
    await page.locator('#study-width').press('End');
    assert.equal(await page.locator('#width-output').textContent(), '320');
    assert.equal(await page.locator('#study-width').getAttribute('aria-valuetext'), '320 cm');
    await page.locator('#study-start').click();
    await page.getByRole('button', { name: 'Back to your designs' }).waitFor();
    assert.deepEqual((await pieces()).map(({ width, shape }) => [width, shape]), [[320, 'alcove']]);
    assert.equal(await welcome.isVisible(), false);
    await flush('starter_design_loaded');
    assert.equal(events.find(event => event.event === 'editor_session_started').context.referrerPath, '/wardrobe-designer/');
    assert.equal(events.find(event => event.event === 'editor_session_started').properties.entry_type, 'wardrobe_starter');
    assert.equal(events.some(event => event.event === 'design_first_work_committed'), false);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    await drawings();
    await closeDrawings();
    await page.reload();
    await page.getByRole('button', { name: 'Back to your designs' }).waitFor();
    assert.equal((await pieces())[0].width, 320);

    await page.goto(base + '/kitchen-cabinet-design-software/');
    await page.locator('#study-start').click();
    await page.getByRole('button', { name: 'Back to your designs' }).waitFor();
    assert.deepEqual((await pieces()).map(({ product, width }) => [product, width]), [['kitchen', 60]]);
    assert.equal(await welcome.isVisible(), false);
    await add();
    await page.locator('[data-add-kitchen="base"]:visible').click();
    assert.deepEqual((await pieces()).map(({ product }) => product), ['kitchen', 'kitchen']);
    await flush('design_first_work_committed');
    assert.deepEqual(events.filter(event => event.event === 'design_first_work_committed').map(event => event.properties.piece_count), [2]);

    const manual = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600, reducedMotion: 'reduce' });
    await manual.route('https://*.supabase.co/**', route => route.fulfill({ status: 400, json: {} }));
    const manualPage = await manual.newPage();
    await manualPage.goto(base + '/editor/?welcome=1');
    await manualPage.getByRole('button', { name: 'Design it myself', exact: true }).click();
    assert.equal(await manualPage.locator('.xp-welcome').isVisible(), false);
    await manualPage.getByRole('button', { name: 'Add furniture', exact: true }).click();
    await manualPage.getByRole('button', { name: 'Regular', exact: true }).click();
    assert.equal(await manualPage.evaluate(() => window.__furnidrawEditor.scene().wardrobes.length), 1);
    await manual.close();

    for (const fits of [true, false]) {
      await page.goto(base + '/editor/?welcome=1');
      await welcome.locator(`[data-space="${fits ? 'free' : 'alcove'}"]`).click();
      await welcome.getByRole('button', { name: 'Next', exact: true }).click();
      await welcome.locator(`[data-persona="${fits ? 'light' : 'two'}"]`).click();
      await welcome.getByRole('button', { name: 'Build', exact: true }).click();
      const action = fits ? 'View dimensioned drawings' : 'Adjust my layout';
      await page.getByRole('button', { name: action, exact: true }).click({ timeout: 40000 }).catch(async error => {
        const details = await page.locator('.xp-welcome:visible, .xp-reveal:visible').allTextContents();
        throw new Error(`Expected "${action}". Current panels ${JSON.stringify(details)}`, { cause: error });
      });
      if (fits) { await drawings(); await closeDrawings(); }
      else await page.locator('[data-editor-id="wizard"]').waitFor();
    }

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Wardrobe handoff, kitchen cabinet addition, manual design, first edit and both fit report actions passed at ${width}px.`);
  }
} finally {
  await browser.close();
}
