import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5182', output = 'output/zero-separator';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, isMobile: width === 375, hasTouch: width === 375 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/zero-pane-fixture', r => r.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/zero-pane-fixture');
    await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      setLengthUnit('mm');
      window.zeroPaneEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: { wardrobes: [
        { id: 1, name: 'Cabinet', x: 0, y: 0, z: 0, angle: 0, state: { ...createKitchenDesign('base'), sel: 0, item: -1, divider: -1, space: null, open: false } }
      ], activeWardrobe: 1, nextWardrobeId: 2 } });
      window.zeroPaneRender = () => {
        const project = sceneToProject({ schemaVersion: 1, id: 'zero-pane', name: 'Zero pane', units: 'cm', wardrobes: [] }, window.zeroPaneEditor.scene());
        window.zeroPaneEditor.viewport.render(project, { selection: { wardrobeId: project.wardrobes[0].id, sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      };
      window.zeroPaneRender();
    });
    await page.locator('.contextual-actions [data-action="resize"]').click();
    const field = page.locator('[data-construction="endPanelThickness"]'); await field.waitFor({ state: 'visible' });
    assert.equal(await field.inputValue(), '18');
    assert.equal(await field.evaluate(el => el.closest('.size-control').querySelector('input[type="range"]').min), '0');
    await field.fill('0'); await field.press('Tab');
    assert.equal(await field.inputValue(), '0');
    const disabled = await page.evaluate(async () => {
      const { automaticInstallationParts } = await import('/src/domain/kitchen/automatic-installation.ts');
      const scene = window.zeroPaneEditor.scene(), p = scene.wardrobes[0];
      return { thickness: p.state.endPanelThickness, parts: automaticInstallationParts(scene.wardrobes).length, pose: [p.x, p.y, p.z, p.angle] };
    });
    assert.deepEqual(disabled, { thickness: 0, parts: 0, pose: [0, 0, 0, 0] });
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await page.evaluate(() => window.zeroPaneEditor.scene().wardrobes[0].state.endPanelThickness ?? 1.8), 1.8);
    await page.locator('.contextual-actions [data-action="resize"]').click();
    await field.fill('0'); await field.press('Tab');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.zeroPaneRender());
    assert.equal(await page.evaluate(() => window.zeroPaneEditor.scene().wardrobes[0].state.endPanelThickness), 0);
    await page.locator('.contextual-actions [data-action="resize"]').click();
    assert.equal(await field.inputValue(), '0');
    await page.screenshot({ path: output + '/app-' + width + '.png' });
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Zero separator thickness: input, slider minimum, stock removal, undo and reopen verified at 375 and 1440 px.');
} finally { await browser.close(); }
