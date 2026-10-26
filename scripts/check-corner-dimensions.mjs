// Vite must be running. Checks the mounted editor, including the pose-dependent ruler cache.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5177';
const output = 'output/corner-widths';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500, isMobile: width < 500 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/corner-width-fixture', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/corner-width-fixture');
    await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createEditorState } = await import('/src/application/projects/editor-state.ts');
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      const threeUrl = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
      const THREE = await import(threeUrl), lookAt = THREE.Object3D.prototype.lookAt;
      const add = THREE.Scene.prototype.add;
      THREE.Scene.prototype.add = function (...objects) { window.cornerRenderScene = this; return add.apply(this, objects); };
      THREE.PerspectiveCamera.prototype.lookAt = function (...args) {
        if (this.fov !== 35) return lookAt.apply(this, args);
        this.position.set(-190, 165, 280);
        return lookAt.call(this, 0, 45, 25);
      };
      setLengthUnit('mm');
      const state = { ...createEditorState(), ...createKitchenDesign('base'), w: 117.9 };
      const scene = { wardrobes: [
        { id: 1, name: 'Corner cabinet', x: 0, z: 0, y: 0, angle: 0, state },
        // A real installation joint: the side starts 25 mm beyond the selected carcass front.
        { id: 2, name: 'Return', x: 29.95, z: 61.5, y: 0, angle: 270, state: { ...createEditorState(), ...createKitchenDesign('base', 'drawers') } },
      ], activeWardrobe: 1, nextWardrobeId: 3 };
      const editor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      const render = (active = 1) => {
        const project = sceneToProject({ schemaVersion: 1, id: 'corner', name: 'Corner QA', units: 'mm', wardrobes: [] }, editor.scene());
        const selected = project.wardrobes.find(w => w.editorLayout.cabinetId === active);
        editor.viewport.render(project, { selection: { wardrobeId: selected.id, sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      };
      window.cornerFixture = { editor, render };
      render();
    });
    const labels = () => page.locator('.corner-width').allTextContents();
    const frontState = () => page.evaluate(() => {
      const cabinet = window.cornerRenderScene.children.find(o => o.userData.wardrobe === 1);
      const objects = []; cabinet.traverse(o => objects.push(o));
      return { fixed: objects.filter(o => o.userData.fixedCornerReturn).length,
        handles: objects.filter(o => o.isGroup && o.children.length === 3 && o.children.every(c => c.geometry?.type === 'CylinderGeometry')).length };
    });
    await page.waitForFunction(() => document.querySelector('#editor').shadowRoot.querySelectorAll('.corner-width').length === 2);
    assert.deepEqual(await labels(), ['W 599 mm', 'To edge 580 mm']);
    assert.deepEqual(await frontState(), { fixed: 1, handles: 1 }, 'covered leaf has no handle');
    await page.evaluate(() => { const f = window.cornerFixture; f.render(2); f.editor.scene().wardrobes[1].x += 200; f.render(2); });
    assert.deepEqual(await frontState(), { fixed: 0, handles: 2 }, 'unselected cabinet refreshes when its return moves');
    await page.evaluate(() => { const f = window.cornerFixture; f.editor.scene().wardrobes[1].x -= 200; f.render(); });
    assert.deepEqual(await frontState(), { fixed: 1, handles: 1 }, 'bringing the return back restores its fixed cover');
    for (const el of await page.locator('.corner-width').all()) {
      assert.equal(await el.getAttribute('data-measurement-readonly'), 'true');
      assert.equal(await el.isVisible(), true);
      const r = await el.boundingBox();
      assert.ok(r.x >= 0 && r.x + r.width <= width && r.y >= 0 && r.y + r.height <= 900, 'label stays on screen');
    }
    await page.screenshot({ path: `${output}/editor-${width}.png` });
    await page.locator('.contextual-actions [data-action="resize"]').click();
    await page.locator('[data-editor-id="w"]').focus();
    assert.match(await page.locator('.scrub-w').textContent(), /Overall W 1179 mm/);
    assert.equal(await page.locator('.scrub-w').getAttribute('aria-valuenow'), '117.9', 'overall control keeps the full model width');
    assert.deepEqual(await labels(), ['W 599 mm', 'To edge 580 mm'], 'surface measurements remain separate during size editing');
    await page.locator('[data-editor-id="w"]').blur();
    // Change only a neighbour's pose: this used to take the cache path that ignores scene positions.
    await page.evaluate(() => { const f = window.cornerFixture; f.editor.scene().wardrobes[1].x += 1.25; f.render(); });
    assert.deepEqual(await labels(), ['W 612 mm', 'To edge 567 mm'], 'shared rounded stops sum to 1179');
    await page.evaluate(() => { const f = window.cornerFixture; f.editor.scene().wardrobes[1].state.d = 40; f.render(); });
    assert.deepEqual(await labels(), ['W 702 mm', 'Return W 400 mm', 'W 77 mm'], 'changed neighbour depth refreshes selected rulers');
    await page.evaluate(() => { const f = window.cornerFixture; f.editor.scene().wardrobes.pop(); f.render(); });
    assert.equal(await page.locator('.corner-width').count(), 0);
    assert.match(await page.locator('.scrub-w').textContent(), /1179 mm/);
    assert.deepEqual(await frontState(), { fixed: 0, handles: 2 }, 'removing the return restores ordinary cupboard doors');
    assert.deepEqual(errors, [], 'editor has no browser errors');
    await page.close();
    console.log(`Corner rulers and handles pass at ${width}px (selection, pose, depth and deletion).`);
  }
} finally { await browser.close(); }
