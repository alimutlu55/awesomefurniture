// Real WebGL and UI interaction; image generation is mocked before the provider boundary.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';

const base = process.env.DECOR_TEST_URL ?? 'http://127.0.0.1:5177';
const output = process.env.DECOR_TEST_OUTPUT ?? '/tmp/wardrobe-decor-verification';
const fixture = '.decor-review.html';
await mkdir(output, { recursive: true });
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0"><main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
import { createEditorModel } from '/src/application/projects/editor-model.ts';
import { rectangleStudio } from '/src/domain/studio/studio-templates.ts';
const model = createEditorModel(), state = model.activeCabinet().state;
state.doors='hinged'; state.secs[0]=[{k:'drawer',h:22},{k:'shelf',h:40}];
model.scene.studio=rectangleStudio(400,300); model.activeCabinet().z=115;
window.fixtureEditor=mountEditor({root:document.querySelector('#fixture'),initialScene:model.scene});
</script></body></html>`);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let submitted;
  await page.route('**/api/design-images', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { model: 'gemini-nano-banana-2.1', image: { mimeType: 'image/jpeg', data: submitted.references[0].data } } });
  });
  await page.goto(`${base}/${fixture}`);
  await page.waitForFunction(() => window.fixtureEditor);
  await page.mouse.click(735, 450);
  await page.locator('[data-action="fronts"]').click();
  const linked = page.locator('[data-decor-link]');
  await linked.uncheck();
  await page.locator('[data-decor-section="fronts"] summary').click();
  const cashmere = page.locator('[data-decor-zone="fronts"][data-decor-id="egger-u702-st9"]');
  await cashmere.click();
  await page.locator('[data-material-finish="handle"]').selectOption('handleless_tip_on');
  const read = () => page.evaluate(() => window.fixtureEditor.scene().wardrobes[0].state.materials);
  const materials = await read();
  assert.equal(materials.carcassDecorId, 'egger-h1318-st10'); assert.equal(materials.frontDecorId, 'egger-u702-st9');
  assert.equal(materials.handleFinish, 'handleless_tip_on');
  assert.equal(await cashmere.getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('[data-decor-summary="fronts"]').textContent(), /Egger · U702 ST9 · 18mm/);
  await page.screenshot({ path: `${output}/two-tone-picker-desktop.png` });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  assert.equal((await read()).handleFinish, 'brushed_brass');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+Shift+z');
  assert.equal((await read()).handleFinish, 'handleless_tip_on');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/two-tone-picker-mobile.png` });
  assert.ok(await page.locator('.decor-picker').evaluate(el => el.scrollWidth <= el.clientWidth), 'picker fits narrow sheet');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Generate image with AI', exact: true }).click();
  const generate = page.getByRole('button', { name: 'Generate Image', exact: true });
  await generate.click();
  await page.waitForFunction(() => document.querySelector('#fixture').shadowRoot.querySelector('.ai-result img')?.src);
  assert.equal(submitted.specification.design.furniture[0].materials.frontDecorId, 'egger-u702-st9');
  assert.equal(submitted.references.length, 3);
  assert.equal(submitted.decorSwatches.length, 1); assert.equal(submitted.decorSwatches[0].decorId, 'egger-h1318-st10');
  assert.ok(submitted.decorSwatches[0].data.length > 10000);
  assert.deepEqual(errors, []);
  console.log('Decor picker desktop/mobile, two-tone state, undo/redo, real WebGL capture and manufacturer swatch request passed.');
} finally {
  await browser?.close();
  await unlink(fixture).catch(() => {});
}
