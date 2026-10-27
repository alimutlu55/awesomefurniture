import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5181', output = 'output/no-cabinet-cascade';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, isMobile: width === 375, hasTouch: width === 375 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/no-cascade-fixture', r => r.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/no-cascade-fixture');
    const before = await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createEditorState } = await import('/src/application/projects/editor-state.ts');
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      setLengthUnit('mm');
      const unit = (id, x, z, angle, preset) => ({ id, name: preset, x, y: 0, z, angle,
        state: { ...createEditorState(), ...createKitchenDesign('base', preset) } });
      const blind = unit(1, 0, 0, 0, 'corner'); blind.state.w = 102;
      const scene = { wardrobes: [blind, unit(2, 22, 49.8, 270, 'cargo'), unit(3, 22, 94.8, 270, 'base')], activeWardrobe: 2, nextWardrobeId: 4 };
      window.noCascadeEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      window.noCascadeRender = () => {
        const project = sceneToProject({ schemaVersion: 1, id: 'no-cascade', name: 'No cascade', units: 'cm', wardrobes: [] }, window.noCascadeEditor.scene());
        window.noCascadeEditor.viewport.render(project, { selection: { wardrobeId: project.wardrobes.find(p => p.editorLayout.cabinetId === 2).id,
          sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      };
      window.noCascadeRender();
      return window.noCascadeEditor.scene().wardrobes.map(p => [p.id, p.x, p.y, p.z, p.angle]);
    });
    const positions = () => page.evaluate(() => window.noCascadeEditor.scene().wardrobes.map(p => [p.id, p.x, p.y, p.z, p.angle]));
    await page.locator('.contextual-actions [data-action="resize"]').click();
    const strip = page.locator('[data-construction="cornerStrip"]'); await strip.waitFor({ state: 'visible' });
    assert.equal(await strip.inputValue(), '40');
    await strip.fill('50'); await strip.press('Tab');
    assert.equal(await strip.inputValue(), '40', 'growing into a neighbour is rejected');
    assert.deepEqual(await positions(), before);
    await strip.fill('35'); await strip.press('Tab');
    assert.equal(await strip.inputValue(), '35'); assert.deepEqual(await positions(), before);
    const dimension = page.locator('[data-editor-id="w"]');
    await dimension.fill('299'); await dimension.press('Tab');
    assert.equal(await page.evaluate(() => window.noCascadeEditor.scene().wardrobes.find(p => p.id === 2).state.w), 29.9);
    assert.deepEqual((await positions()).filter(p => p[0] !== 2), before.filter(p => p[0] !== 2));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await positions(), before);
    await page.evaluate(() => window.noCascadeRender());
    assert.deepEqual(await positions(), before, 'save/render cannot reflow the neighbours afterwards');
    await page.screenshot({ path: output + '/app-' + width + '.png' });
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('No cascading cabinet moves: blocked strip growth, accepted smaller sizes, undo and reopening verified at 375 and 1440 px.');
} finally { await browser.close(); }
