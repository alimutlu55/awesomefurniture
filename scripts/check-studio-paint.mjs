// Regression: painting must work even when existing furniture overlaps the wall.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';

const base = process.env.STUDIO_PAINT_TEST_URL ?? 'http://127.0.0.1:5177';
const output = process.env.STUDIO_PAINT_OUTPUT ?? '/tmp/wardrobe-wall-paint-verification';
const fixture = '.studio-paint-review.html';
await mkdir(output, { recursive: true });
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0"><main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
import { createEditorModel } from '/src/application/projects/editor-model.ts';
import { createStudio } from '/src/domain/studio/studio-templates.ts';
import { createCabinetGeometry } from '/src/domain/geometry/cabinet-geometry.js';
import { studioObstacles } from '/src/domain/studio/studio-obstacles.ts';
const model = createEditorModel(); model.scene.studio = createStudio('bedroom');
window.hasOverlap = createCabinetGeometry(() => [], () => studioObstacles(model.scene.studio)).cabinetCollides(model.activeCabinet());
window.fixtureEditor = mountEditor({root:document.querySelector('#fixture'),initialScene:model.scene});
</script></body></html>`);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 375]) {
    const phone = width === 375;
    const page = await browser.newPage({ viewport: { width, height: phone ? 812 : 900 },
      isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const read = () => page.evaluate(() => JSON.parse(window.fixtureEditor.snapshot()));
    try {
      await page.goto(`${base}/${fixture}`);
      await page.waitForFunction(() => window.fixtureEditor);
      assert.equal(await page.evaluate(() => window.hasOverlap), true);
      const furniture = (await read()).wardrobes;
      await page.locator('[data-view-mode="studio"]').click();
      await page.waitForTimeout(1200);
      const view = await page.locator('[data-editor-id="view"]').boundingBox();
      await page.mouse.click(view.x + view.width * (phone ? .87 : .68), view.y + view.height * (phone ? .41 : .38));
      const paint = page.locator('[data-action="wall-paint"]');
      await paint.click();
      const panel = page.locator('.wall-paint-panel');
      await panel.locator('[data-paint-color="#637380"]').click();
      await panel.locator('[data-wall-finish="satin"]').click();
      assert.equal(await panel.locator('.wall-paint-current').textContent(), 'Slate Blue');
      assert.equal(await panel.locator('[data-wall-finish="satin"]').getAttribute('aria-pressed'), 'true');
      let scene = await read();
      assert.equal(scene.studio.walls.filter(w => w.color === '#637380' && w.finish === 'satin').length, 1);
      assert.deepEqual(scene.wardrobes, furniture, 'paint never moves or resizes furniture');
      await panel.locator('input').check();
      await panel.locator('[data-paint-color="#9da995"]').click();
      scene = await read();
      assert.ok(scene.studio.walls.every(w => w.color === '#9da995'));
      await page.keyboard.press('ControlOrMeta+z');
      assert.equal((await read()).studio.walls.filter(w => w.color === '#637380').length, 1);
      await page.keyboard.press('ControlOrMeta+Shift+z');
      assert.ok((await read()).studio.walls.every(w => w.color === '#9da995'));
      assert.deepEqual((await read()).wardrobes, furniture);
      assert.equal(await page.getByText('A wardrobe is in the way.', { exact: false }).count(), 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/paint-behind-furniture-${phone ? 'phone' : 'desktop'}.png` });
      console.log(`PASS ${width}px: wall color, finish, all walls and undo/redo behind overlapping furniture`);
    } catch (error) {
      await page.screenshot({ path: `${output}/failure-${width}.png` }); throw error;
    } finally { await page.close(); }
  }
} finally { await browser.close(); await unlink(fixture).catch(() => {}); }
