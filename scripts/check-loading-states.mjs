// Deliberately held requests exercise loading, refresh, failure, retry and image readiness without a database.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.LOADING_TEST_URL ?? 'http://127.0.0.1:5177';
const output = process.env.LOADING_TEST_OUTPUT ?? '/tmp/wardrobe-loading-verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/loading-review', route => route.fulfill({ contentType: 'text/html', body: `
    <html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
    <script type="module">
      import { mountDesignLibrary } from '/src/presentation/designs/design-library.ts';
      import { createLoadingState } from '/src/presentation/components/loading-state.ts';
      import { createDesignImageLoading } from '/src/presentation/ai/design-image-loading.ts';
      import { createEditorLifetime } from '/src/presentation/viewport/editor-lifetime.js';
      import css from '/src/presentation/components/loading-state.css?raw';
      import imageCss from '/src/presentation/ai/design-image-loading.css?raw';
      const style = document.createElement('style'); style.textContent = css + imageCss; document.head.append(style);
      const pending = new Map(); let openCount = 0, rejectOpen;
      const items = ['Bedroom storage', 'Kitchen ideas'].map((name,i) => ({id:String(i),name,revision:1,updatedAt:'2026-10-25'}));
      const library = mountDesignLibrary(document, {
        open: () => { openCount++; return new Promise((_, reject) => { rejectOpen = reject; }); },
        preview: id => new Promise(resolve => pending.set(id, resolve)),
        refresh: async () => library.update({items,currentId:'0',localOnly:true,warning:null}),
        create: async () => {}, rename: async () => {}, duplicate: async () => {}, remove: async () => {},
      });
      library.show(); library.loading(true);
      window.review = { library, items, pending, get openCount(){return openCount;}, failOpen:()=>rejectOpen(new Error('Try opening this design again.')),
        populate: () => { library.update({items,currentId:'0',localOnly:true,warning:null}); library.loading(false); },
        createLoadingState,
        loader: createDesignImageLoading(document,createEditorLifetime(),{onCancel:()=>window.review.loader.stop()}) };
      document.body.append(review.loader.element);
    </script></body></html>` }));
  await page.goto(base + '/loading-review');
  const library = page.locator('#design-library');
  await library.locator('.ui-placeholder--design-list').waitFor();
  assert.equal(await library.locator('.empty').isVisible(), false, 'no empty-state flash during the first fetch');
  assert.equal(await library.locator('.ui-placeholder-row').count(), 4);
  await page.screenshot({ path: output + '/mobile-designs-loading.png' });
  await page.evaluate(() => review.populate());
  const row = library.getByRole('button', { name: 'Open Bedroom storage', exact: true });
  await row.waitFor(); await library.locator('.preview-frame.ui-loading-surface').first().waitFor();
  const before = await row.boundingBox();
  await page.evaluate(() => {
    for (const resolve of review.pending.values()) resolve('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="88" height="82"><rect width="88" height="82" fill="#c8b28d"/></svg>'));
  });
  await library.locator('.preview-frame:not(.ui-loading-surface)').first().waitFor();
  assert.deepEqual(await row.boundingBox(), before, 'preview readiness never shifts a row');
  await page.evaluate(() => review.library.loading(true));
  assert.equal(await row.isVisible(), true, 'refresh retains the existing designs');
  assert.equal(await row.isDisabled(), true);
  assert.equal(await library.locator('.list.ui-loading-surface').count(), 1);
  await page.evaluate(() => review.library.loading(false));
  await row.click();
  assert.equal(await row.evaluate(el => el.classList.contains('ui-loading-surface')), true);
  await row.dispatchEvent('click');
  assert.equal(await page.evaluate(() => review.openCount), 1, 'a pending action cannot be submitted twice');
  await page.evaluate(() => review.failOpen());
  await library.getByText('Try opening this design again.', { exact: true }).waitFor();
  assert.equal(await row.isEnabled(), true, 'failure clears the busy state');
  assert.equal(await row.evaluate(el => el.classList.contains('ui-loading-surface')), false);
  await library.getByRole('button', { name: 'Retry', exact: true }).click();
  assert.equal(await library.locator('.message.error').count(), 0, 'successful retry clears the previous error');
  await page.evaluate(() => {
    const target = document.createElement('div'); target.setAttribute('aria-busy', 'false');
    const loading = review.createLoadingState(target); loading.start(); loading.start(); loading.stop();
    if (target.getAttribute('aria-busy') !== 'false' || target.classList.contains('ui-loading-surface')) throw new Error('busy state was not restored');
    review.library.update({items:[],currentId:null,localOnly:true,warning:null});
  });
  assert.equal(await library.locator('.empty').isVisible(), true, 'a completed empty result offers a new design');
  await page.evaluate(() => { review.library.loading(true); review.library.error('The connection was interrupted.'); review.library.loading(false); });
  assert.equal(await library.locator('.empty').isVisible(), false, 'failure never looks like an empty library');
  assert.equal(await library.locator('.ui-placeholder--design-list').isVisible(), false);
  assert.equal(await library.getByRole('button', { name: 'Retry', exact: true }).isEnabled(), true);
  await page.evaluate(() => { review.library.hide(); review.loader.start(); review.loader.rendering(); });
  await page.locator('.ai-magic').waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'loading fits at ' + width);
  }
  await page.screenshot({ path: output + '/desktop-image-loading.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.ai-magic').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.locator('.ai-magic').isVisible(), false, 'cancel removes the loading surface');
  await page.evaluate(() => { document.documentElement.dataset.theme='dark'; review.library.show(); review.library.loading(true); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output + '/mobile-designs-loading-dark.png' });
  assert.deepEqual(errors, []);
  console.log('PASS loading states: first fetch, retained refresh, stable previews, repeated clicks, errors, retry, empty results, cancel, reduced motion, and 320–1440px.');
} finally { await browser.close(); }
