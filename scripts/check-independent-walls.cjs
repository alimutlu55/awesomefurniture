// Run against STUDIO_URL (default http://127.0.0.1:5174). Uses the real editor and pointer controls.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 375, 812]]) {
      const phone = name === 'phone';
      const page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto((process.env.STUDIO_URL || 'http://127.0.0.1:5174') + '/editor.html');
      await page.locator('[data-editor-id="walls-btn"]').waitFor();
      await page.evaluate(async () => {
        const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
        const { createEditorState } = await import('/src/application/projects/editor-state.ts');
        const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
        const { translateStudio } = await import('/src/domain/studio/studio-edit.ts');
        const root = document.createElement('div');
        root.style.cssText = 'position:absolute;inset:0';
        document.getElementById('editor-root').replaceWith(root);
        window.solidRoot = root;
        window.solidEditor = mountEditor({ root, initialScene: {
          wardrobes: [{ id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() }],
          activeWardrobe: 1, nextWardrobeId: 2, studio: translateStudio(createStudio('wall'), 0, -30),
        } });
      });
      const snapshot = () => page.evaluate(() => JSON.parse(window.solidEditor.snapshot()));
      const el = id => page.locator('[data-editor-id="' + id + '"]');
      const tap = async locator => { phone ? await locator.tap() : await locator.click(); await page.waitForTimeout(200); };
      await page.waitForTimeout(800);
      const before = await snapshot();
      await tap(el('walls-btn'));
      await tap(page.locator(phone ? '.mobile-add-products [data-add-room="wall"]' : '[data-editor-id="padd-room"] [data-add-room="wall"]'));
      assert.equal(await el('toolbar').getAttribute('data-context'), 'wall');
      const added = await snapshot(), wall = added.studio.walls.at(-1);
      assert.equal(wall.independent, true);
      assert.equal(added.studio.walls.length, 2);
      assert.deepEqual(added.studio.walls[0], before.studio.walls[0]);
      assert.deepEqual(added.studio.corners.slice(0, 2), before.studio.corners);
      assert.ok([wall.a, wall.b].every(id => !before.studio.corners.some(c => c.id === id)));
      assert.equal(await page.locator('.room-handle.split-handle').count(), 0, 'independent walls have no attached extension grips');
      assert.equal(await page.locator('.room-rotate').count(), 1);
      assert.equal(await page.locator('.room-axis').count(), 3);

      // Drag rotation and undo it; the original wall remains unchanged.
      const rotate = await page.locator('.room-rotate').boundingBox();
      await page.mouse.move(rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(rotate.x + rotate.width / 2 + i * 5, rotate.y + rotate.height / 2);
      await page.mouse.up();
      const turned = await snapshot();
      assert.notDeepEqual(turned.studio.corners.slice(2), added.studio.corners.slice(2), 'rotation drag changes this wall');
      assert.deepEqual(turned.studio.corners.slice(0, 2), before.studio.corners);
      await page.keyboard.press('ControlOrMeta+z');
      assert.deepEqual((await snapshot()).studio, added.studio);
      // Undo focuses the wardrobe. Redo retains the test wall's known geometry; reselect its box by its grip location.
      // A fresh editor with the same scene and a click on the wall gives stable selection without moving its camera.
      await page.evaluate(async scene => {
        const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
        window.solidEditor.dispose();
        const root = window.solidRoot;
        window.solidEditor = mountEditor({ root, initialScene: scene });
      }, added);
      await page.waitForTimeout(800);
      // Add one more independent wall through the catalogue; it is selected immediately.
      await tap(el('walls-btn'));
      await tap(page.locator(phone ? '.mobile-add-products [data-add-room="wall"]' : '[data-editor-id="padd-room"] [data-add-room="wall"]'));
      const all = await snapshot(), current = all.studio.walls.at(-1), others = all.studio.walls.slice(0, -1);
      await tap(el('toolbar').locator('[data-action="wall-size"]'));
      const field = key => page.locator('[data-room-field="' + key + '"]');
      for (const [key, value] of [['length', '180'], ['height', '280'], ['thickness', '24'], ['angle', '30']]) {
        await field(key).fill(value); await field(key).press('Enter'); await page.waitForTimeout(100);
        assert.equal(Number(await field(key).inputValue()), Number(value), key + ' is editable');
      }
      await tap(page.locator('[data-room-ceiling]'));
      assert.equal(Number(await field('height').inputValue()), 12);
      assert.equal(Number(await field('thickness').inputValue()), 280);
      assert.equal(Number(await field('y').inputValue()), 280);
      for (const [key, value] of [['thickness', '350'], ['y', '320']]) {
        await field(key).fill(value); await field(key).press('Enter'); await page.waitForTimeout(100);
      }
      const ceiling = await snapshot(), slab = ceiling.studio.walls.find(w => w.id === current.id);
      assert.equal(slab.height, 12); assert.equal(slab.thickness, 350); assert.equal(slab.y, 320);
      assert.deepEqual(ceiling.studio.walls.slice(0, -1), others);
      assert.deepEqual(ceiling.wardrobes, before.wardrobes);
      await page.screenshot({ path: path.join(process.env.STUDIO_SHOTS || '/tmp/independent-walls-shots', 'ceiling-fields-' + name + '.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(process.env.STUDIO_SHOTS || '/tmp/independent-walls-shots', 'ceiling-' + name + '.png') });
      assert.deepEqual(errors, []);
      console.log('independent walls, drag rotation, depth, ceiling and elevation: ' + name + ' ok');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
