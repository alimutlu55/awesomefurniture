import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5178', output = 'output/automatic-installation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 500, isMobile: width < 500 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/installation-fixture', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/installation-fixture');
    await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createEditorState } = await import('/src/application/projects/editor-state.ts');
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      const threeUrl = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
      const THREE = await import(threeUrl), add = THREE.Scene.prototype.add;
      THREE.Scene.prototype.add = function (...objects) { window.installationScene = this; return add.apply(this, objects); };
      const lookAt = THREE.Object3D.prototype.lookAt;
      THREE.PerspectiveCamera.prototype.lookAt = function (...args) {
        if (this.fov !== 35) return lookAt.apply(this, args);
        this.position.set(-190, 165, 280); return lookAt.call(this, 0, 45, 25);
      };
      setLengthUnit('mm');
      const state = { ...createEditorState(), ...createKitchenDesign('base', 'corner'), w: 102, leftPanelThickness: 1.8 };
      const scene = { wardrobes: [
        { id: 1, name: 'Corner cabinet', x: 0, z: 0, y: 0, angle: 0, state },
        { id: 2, name: 'Cargo', x: 22, z: 49.8, y: 0, angle: 270, state: { ...createEditorState(), ...createKitchenDesign('base', 'cargo'), rightPanelThickness: 1.8 } },
      ], activeWardrobe: 1, nextWardrobeId: 3 };
      const editor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      window.installationEditor = editor;
      const project = sceneToProject({ schemaVersion: 1, id: 'installation', name: 'Installation', units: 'mm', wardrobes: [] }, editor.scene());
      const selected = project.wardrobes.find(w => w.editorLayout.cabinetId === 1);
      editor.viewport.render(project, { selection: { wardrobeId: selected.id, sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
    });
    await page.waitForFunction(() => document.querySelector('#editor').shadowRoot.querySelectorAll('.corner-width').length === 3);
    assert.deepEqual(await page.locator('.corner-width').allTextContents(), ['W 400 mm', 'Strip 40 mm', 'To edge 580 mm']);
    const parts = await page.evaluate(() => {
      const run = window.installationScene.children.find(o => o.name === 'kitchen-runs'), found = [];
      run.traverse(o => { if (o.userData.installationPart) found.push(o.geometry.parameters.width); });
      return found.sort((a, b) => a - b);
    });
    assert.deepEqual(parts, [1.8, 1.8, 4], 'two end panes and the additive return strip are rendered');
    await page.screenshot({ path: output + '/app-' + width + '.png' });
    await page.locator('.contextual-actions [data-action="resize"]').click();
    const strip = page.locator('[data-construction="cornerStrip"]'), left = page.locator('[data-construction="leftPanelThickness"]'), right = page.locator('[data-construction="rightPanelThickness"]');
    await strip.waitFor({ state: 'visible' });
    assert.equal(await strip.inputValue(), '40'); assert.equal(await left.inputValue(), '18'); assert.equal(await right.inputValue(), '0');
    assert.equal(await page.locator('#kitchen-construction .room-field-hint').count(), 0);
    await strip.fill('35'); await strip.press('Tab');
    assert.equal(await strip.inputValue(), '35');
    assert.deepEqual(await page.locator('.corner-width').allTextContents(), ['W 405 mm', 'Strip 35 mm', 'To edge 580 mm']);
    await strip.fill('40'); await strip.press('Tab');
    assert.equal(await strip.inputValue(), '40');
    await page.screenshot({ path: output + '/size-' + width + '.png' });
    assert.deepEqual(errors, []); await page.close();
  }
  const drawing = await browser.newPage({ viewport: { width: 1600, height: 1132 } });
  await drawing.setContent('<html><body style="margin:0;background:white"><img style="width:1600px;height:auto" src="' + base + '/output/automatic-installation/plan.svg"></body></html>');
  await drawing.locator('img').evaluate(img => img.decode());
  await drawing.screenshot({ path: output + '/plan.png' }); await drawing.close();
  console.log('Automatic installation: app and Size verified at 375 and 1440 px.');
} finally { await browser.close(); }
