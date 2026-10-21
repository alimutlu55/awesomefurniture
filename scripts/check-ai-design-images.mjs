// Run with Vite on 5177: node --import tsx scripts/check-ai-design-images.mjs
// No provider calls: generation is mocked at the browser boundary; reference capture is real WebGL.
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { drawingFixture } from './professional-drawing-fixtures.mjs';
const output = process.env.AI_IMAGE_OUTPUT ?? '/tmp/wardrobe-ai-verification';
await mkdir(output, { recursive: true });
const fixture = '.ai-image-review.html';
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
import { buildFromSpec } from '/src/application/spec/build-from-spec.ts';
import { projectToScene } from '/src/application/projects/editor-mapper.ts';
const built = buildFromSpec({specVersion:1,room:{width:360,depth:240,height:260},wardrobes:[{against:1,width:180,height:220,depth:60,shape:'sloped',for:{short:12,pants:8,folded:20}}]},'preview');
const wardrobe = projectToScene(built.project); wardrobe.wardrobes[0].state.open=true;
const scene = new URLSearchParams(location.search).has('kitchen') ? ${JSON.stringify(drawingFixture('l'))} : wardrobe;
window.fixtureEditor=mountEditor({root:document.querySelector('#fixture'),initialScene:scene});
</script></body></html>`);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let calls = 0, body;
  await page.route('**/api/design-images', async route => {
    calls++; body = route.request().postDataJSON();
    await route.fulfill({ json: { model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/jpeg', data: body.references[1].data } } });
  });
  for (const kind of ['wardrobe', 'kitchen']) {
    await page.goto(`http://127.0.0.1:5177/${fixture}${kind === 'kitchen' ? '?kitchen' : ''}`);
    await page.getByRole('button', { name: 'Generate image with AI', exact: true }).waitFor();
    const before = await page.evaluate(() => window.fixtureEditor.snapshot());
    await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Generate image with AI', exact: true });
    await dialog.getByRole('link', { name: 'Download image', exact: true }).waitFor({ timeout: 60_000 });
    assert.equal(calls, kind === 'wardrobe' ? 1 : 2);
    assert.equal(body.references.length, 3);
    assert.equal(new Set(body.references.map(image => createHash('sha256').update(image.data).digest('hex'))).size, 3, 'distinct reference viewpoints');
    assert.equal(new Set(body.references.map(image => image.camera.position.join(','))).size, 3, 'distinct camera positions');
    assert.equal(body.specification.units, 'cm');
    assert.ok(body.specification.technicalDrawings.length > 4);
    const stats = await dialog.locator('.ai-reference-grid img').evaluateAll(async images => Promise.all(images.map(async image => {
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 32, 24);
      return { width: image.naturalWidth, height: image.naturalHeight, colors: new Set(context.getImageData(0, 0, 32, 24).data).size };
    })));
    assert.ok(stats.every(image => image.width === 1440 && image.height === 1080 && image.colors > 70), 'high-resolution nonblank images');
    for (const image of body.references) await writeFile(`${output}/${kind}-${image.view}.jpg`, Buffer.from(image.data, 'base64'));
    await writeFile(`${output}/${kind}-specification.json`, JSON.stringify(body.specification, null, 2));
    await page.screenshot({ path: `${output}/${kind}-desktop.png` });
    const imageDownload = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Download image', exact: true }).click();
    assert.equal((await imageDownload).suggestedFilename(), 'design-ai.jpg');
    const jsonDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download design JSON' }).click();
    assert.equal((await jsonDownload).suggestedFilename(), 'design-specification.json');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.fixtureEditor.snapshot()), before, 'capture leaves the design untouched');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Generate image with AI', exact: true });
  await page.screenshot({ path: `${output}/mobile.png` });
  const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390);
  assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'no horizontal overflow');
  await dialog.getByRole('button', { name: 'Close AI image' }).click();
  // Failure is visible and retryable; the previous result stays downloadable.
  await page.unroute('**/api/design-images');
  await page.route('**/api/design-images', route => route.fulfill({ status: 503,
    json: { error: { code: 'NOT_CONFIGURED', message: 'AI image generation is not configured. Set GEMINI_API_KEY on the server.' } } }));
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  await dialog.getByRole('button', { name: 'Generate again' }).click();
  await dialog.getByRole('status').filter({ hasText: 'GEMINI_API_KEY' }).waitFor({ timeout: 60_000 });
  assert.equal(await dialog.getByRole('button', { name: 'Generate again' }).isEnabled(), true);
  assert.equal(await dialog.getByRole('link', { name: 'Download image', exact: true }).isVisible(), true);
  await page.screenshot({ path: `${output}/error-mobile.png` });
  await dialog.getByRole('button', { name: 'Close AI image' }).click();
  await page.evaluate(() => window.fixtureEditor.dispose());
  assert.equal(await page.getByRole('button', { name: 'Generate image with AI', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`AI image browser verification passed. Captures and screenshots: ${output}`);
} finally {
  await browser?.close(); await unlink(fixture);
}
