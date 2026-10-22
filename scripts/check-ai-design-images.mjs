// Run with Vite on 5177: node --import tsx scripts/check-ai-design-images.mjs
// No provider calls: generation is mocked at the browser boundary; reference capture is real WebGL.
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { modelSpecification } from '../src/application/projects/design-image-model-specification.ts';
import { drawingFixture } from './professional-drawing-fixtures.mjs';

const output = process.env.AI_IMAGE_OUTPUT ?? '/tmp/wardrobe-ai-verification';
const baseUrl = process.env.AI_IMAGE_BASE_URL ?? 'http://127.0.0.1:5177';
await mkdir(output, { recursive: true });

const fixture = '.ai-image-review.html';
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
import { buildFromSpec } from '/src/application/spec/build-from-spec.ts';
import { projectToScene } from '/src/application/projects/editor-mapper.ts';
import { verifyNeutralReferenceCapture } from '/scripts/verify-neutral-reference-capture.mjs';
window.referenceColorCheck = await verifyNeutralReferenceCapture();
localStorage.setItem('debug', 'true');
const built = buildFromSpec({specVersion:1,room:{width:360,depth:240,height:260},wardrobes:[{against:1,width:180,height:220,depth:60,shape:'sloped',for:{short:12,pants:8,folded:20}}]},'preview');
const wardrobe = projectToScene(built.project); wardrobe.wardrobes[0].state.open=true;
const scene = new URLSearchParams(location.search).has('kitchen') ? ${JSON.stringify(drawingFixture('l'))} : wardrobe;
window.fixtureEditor=mountEditor({root:document.querySelector('#fixture'),initialScene:scene});
</script></body></html>`);

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  let calls = 0, body, finishGeneration;
  await page.route('**/api/design-images', async route => {
    calls++; body = route.request().postDataJSON();
    await new Promise(resolve => { finishGeneration = resolve; });
    await route.fulfill({ json: { model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/jpeg', data: body.references[1].data }, text: 'An oak design with <warm> lighting.' } });
  });

  for (const kind of ['wardrobe', 'kitchen']) {
    console.log(`Verifying ${kind}: option dialog, capture, magical waiting, and download.`);
    await page.goto(`${baseUrl}/${fixture}${kind === 'kitchen' ? '?kitchen' : ''}`);
    await page.getByRole('button', { name: 'Generate image with AI', exact: true }).waitFor();
    const before = await page.evaluate(() => window.fixtureEditor.snapshot());

    // Clicking the toolbar AI button opens the dialog with options instead of generating immediately
    await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /Generate image/i });
    await dialog.waitFor();

    // Verify option to generate image with style selection
    const generateBtn = dialog.getByRole('button', { name: /Generate image/i });
    assert.equal(await generateBtn.isVisible(), true, 'presents option to generate image');
    assert.equal(await dialog.getByRole('radio', { name: /Realistic photo/i }).isVisible(), true);
    assert.equal(await dialog.getByRole('radio', { name: /Studio look/i }).isVisible(), true);
    assert.equal(await dialog.getByRole('radio', { name: /Concept render/i }).isVisible(), true);

    await dialog.locator('.ai-reference-preview:not([hidden])').waitFor({ timeout: 60_000 });
    assert.equal(calls, kind === 'wardrobe' ? 0 : 1, 'opening prepares references without a provider request');
    assert.ok(await dialog.locator('.ai-reference-grid img').count() >= 3);
    assert.match(await dialog.locator('.ai-reference-preview summary').textContent(), /not sent to Gemini/);
    const reviewedJSON = await dialog.locator('.ai-reference-preview pre').textContent();
    const reviewedImages = await dialog.locator('.ai-reference-grid img').evaluateAll(async images => Promise.all(images.map(async image => {
      const bytes = new Uint8Array(await (await fetch(image.src)).arrayBuffer());
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    })));
    await dialog.locator('.ai-reference-preview summary').click();
    await page.screenshot({ path: `${output}/${kind}-references-desktop.png` });
    await page.setViewportSize({ width: 375, height: 844 });
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'reference preview fits on mobile');
    await page.screenshot({ path: `${output}/${kind}-references-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });

    const requested = page.waitForRequest('**/api/design-images', { timeout: 60_000 });
    await generateBtn.click();
    await requested;

    // Magical waiting state
    const loading = dialog.locator('.ai-magic.is-rendering');
    await loading.waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), true);
    assert.equal(await dialog.getByRole('link', { name: 'Download image', exact: true }).isVisible(), false);
    await page.screenshot({ path: `${output}/${kind}-loading-desktop.png` });

    await page.setViewportSize({ width: 375, height: 844 });
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'loading fits on mobile');
    await page.screenshot({ path: `${output}/${kind}-loading-mobile.png` });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await loading.evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'reduced motion has no animations');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 1000 });

    finishGeneration();
    await dialog.getByRole('link', { name: 'Download image', exact: true }).waitFor({ timeout: 60_000 });
    assert.equal(await loading.isVisible(), false, 'loading ends when the image arrives');
    assert.equal(await dialog.locator('.ai-model-text').isVisible(), false, 'agent text is ignored and not shown to user');
    assert.equal(calls, kind === 'wardrobe' ? 1 : 2);
    assert.equal(body.references.length, 3);
    assert.deepEqual((body.decorSwatches ?? []).map(swatch => swatch.data), reviewedImages.slice(3), 'manufacturer swatches match the preview');
    assert.deepEqual(body.references.map(ref => ref.data), reviewedImages.slice(0, 3), 'generation submits the exact images reviewed before clicking Generate');
    assert.deepEqual(JSON.parse(reviewedJSON), JSON.parse(JSON.stringify(modelSpecification(body.specification))), 'preview matches the design snapshot retained by the app');
    assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 12 * 1024 * 1024, 'high-quality references fit the API request limit');
    assert.ok(body.references.every(ref => ref.data.length <= 6 * 1024 * 1024), 'each reference fits the image limit');
    assert.equal(new Set(body.references.map(image => createHash('sha256').update(image.data).digest('hex'))).size, 3, 'distinct reference viewpoints');
    assert.equal(new Set(body.references.map(image => image.camera.position.join(','))).size, 3, 'distinct camera positions');
    assert.ok(body.references.every(image => image.camera.position[1] === 135 && image.camera.target[1] === 135), 'all cameras are level at eye height');
    assert.equal(await page.evaluate(() => window.referenceColorCheck), true, 'reference colors and renderer state survive capture and failure');
    assert.equal(body.specification.units, 'cm');
    assert.ok(body.specification.technicalDrawings.length > 4);

    // Verify reference captures are 1K nonblank images without exposing raw technical clutter in the UI
    const stats = await page.evaluate(async refs => {
      return Promise.all(refs.map(async ref => {
        const img = new Image();
        img.src = `data:${ref.mimeType};base64,${ref.data}`;
        await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
        const context = canvas.getContext('2d'); context.drawImage(img, 0, 0, 32, 24);
        return { width: img.naturalWidth, height: img.naturalHeight, colors: new Set(context.getImageData(0, 0, 32, 24).data).size };
      }));
    }, body.references);
    assert.ok(stats.every(image => image.width === 1024 && image.height === 768 && image.colors > 70), '1K nonblank images');

    for (const image of body.references) await writeFile(`${output}/${kind}-${image.view}.jpg`, Buffer.from(image.data, 'base64'));
    await writeFile(`${output}/${kind}-specification.json`, JSON.stringify(body.specification, null, 2));
    await page.screenshot({ path: `${output}/${kind}-desktop.png` });

    const imageDownload = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
    assert.equal((await imageDownload).suggestedFilename(), 'design-ai.jpg');

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.fixtureEditor.snapshot()), before, 'capture leaves the design untouched');
  }

  await page.setViewportSize({ width: 375, height: 844 });
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Generate image/i });
  await page.screenshot({ path: `${output}/mobile.png` });
  const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 375);
  assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'no horizontal overflow');
  await dialog.getByRole('button', { name: /Close/i }).click();

  // Failure is visible and retryable; the previous result stays downloadable.
  await page.unroute('**/api/design-images');
  await page.route('**/api/design-images', route => route.fulfill({ status: 503,
    json: { error: { code: 'NOT_CONFIGURED', message: 'AI image generation is not configured. Set GEMINI_API_KEY on the server.' } } }));
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  await dialog.getByRole('button', { name: 'Try Again' }).click();
  await dialog.getByRole('status').filter({ hasText: 'Image generation is temporarily unavailable. Please try again later.' }).waitFor({ timeout: 60_000 });
  assert.doesNotMatch(await dialog.innerText(), /GEMINI_API_KEY|not configured|credentials|billing/i, 'internal API messages never reach customers');
  assert.equal(await dialog.getByRole('button', { name: 'Try Again' }).isEnabled(), true);
  assert.equal(await dialog.getByRole('link', { name: 'Download image', exact: true }).isVisible(), true);
  assert.equal(await dialog.locator('.ai-magic').isVisible(), false, 'loading ends on error');
  await page.screenshot({ path: `${output}/error-mobile.png` });
  await dialog.getByRole('button', { name: /Close/i }).click();

  // Closing a pending request stops its animation, restores controls, and preserves the last result.
  await page.unroute('**/api/design-images');
  let cancelResponse;
  await page.route('**/api/design-images', async route => {
    await new Promise(resolve => { cancelResponse = resolve; });
    await route.fulfill({ status: 503, json: { error: { code: 'PROVIDER_ERROR' } } }).catch(() => {});
  });
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  const cancellationRequest = page.waitForRequest('**/api/design-images', { timeout: 60_000 });
  await dialog.getByRole('button', { name: 'Try Again' }).click();
  await cancellationRequest;
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  cancelResponse();
  await dialog.getByRole('button', { name: /Close/i }).click();
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  await dialog.getByRole('button', { name: 'Try Again' }).waitFor();
  assert.equal(await dialog.locator('.ai-magic').isVisible(), false, 'cancelled animation stays stopped on reopen');
  assert.equal(await dialog.getByRole('link', { name: 'Download image', exact: true }).isVisible(), true);
  await dialog.getByRole('button', { name: /Close/i }).click();

  await page.evaluate(() => window.fixtureEditor.dispose());
  assert.equal(await page.getByRole('button', { name: 'Generate image with AI', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`AI image browser verification passed. Captures and screenshots: ${output}`);
} finally {
  await browser?.close(); await unlink(fixture).catch(() => {});
}
