const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(base + '/auto-align-fixture', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="editor" style="max-width:450px"></div>' }));
      await page.goto(base + '/auto-align-fixture');
      await page.evaluate(async () => {
        await import('/src/presentation/editor/surface-shape.css');
        const { createSurfaceShapeEditor } = await import('/src/presentation/editor/surface-shape-editor.ts');
        const { createEditorModel } = await import('/src/application/projects/editor-model.ts');
        const { createSceneCommands } = await import('/src/application/commands/scene-commands.ts');
        const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
        const { surfaceProfile, withSurfaceProfile } = await import('/src/domain/studio/surface-profile.ts');
        const model = createEditorModel();
        model.scene.wardrobes = [];
        model.scene.studio = createStudio('bedroom');
        const ref = { kind: 'wall', id: 'w1' };
        const s = surfaceProfile(model.scene.studio, ref);
        model.scene.studio = withSurfaceProfile(model.scene.studio, ref, s.points.map((p, i) => ({ ...p, y: i === 2 ? 238.7 : i === 3 ? 258.5 : p.y })));
        const checkpoints = [], redo = [];
        const sceneCommands = createSceneCommands(() => model.scene, { checkpoint: () => checkpoints.push(model.snapshot()) });
        const editor = createSurfaceShapeEditor({ document, model, sceneCommands,
          history: { checkpoint: s => checkpoints.push(s) }, listen: (el, type, fn, options) => el.addEventListener(type, fn, options),
          callbacks: { refresh: () => editor.render(), redraw() {}, rebuild() {}, report(m) { throw Error(m); }, viewChanged() {},
            history(step) {
              const from = step === 'undo' ? checkpoints : redo, to = step === 'undo' ? redo : checkpoints;
              to.push(model.snapshot()); model.restore(from.pop()); editor.render();
            } } });
        document.querySelector('#editor').append(editor.root); editor.open(ref);
        window.fixture = { model, editor, checkpoints, before: model.snapshot() };
      });
      const align = page.getByRole('button', { name: 'Auto align', exact: true });
      assert.ok(await align.isVisible());
      const box = await align.boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= width);
      await align.click();
      assert.ok(await align.isDisabled());
      assert.deepEqual(await page.evaluate(() => window.fixture.editor.points().map(p => p.y)), [0, 0, 260, 260]);
      assert.equal(await page.evaluate(() => window.fixture.checkpoints.length), 1);
      // Desktop hides the sheet's Undo button, so exercise the same click handler directly there.
      await page.locator('[data-shape-act="undo"]').evaluate(b => b.click());
      assert.equal(await page.evaluate(() => window.fixture.model.snapshot() === window.fixture.before), true);
      assert.ok(await align.isEnabled());
      await page.locator('[data-shape-act="redo"]').evaluate(b => b.click());
      assert.ok(await align.isDisabled());
      await page.getByRole('button', { name: 'Side', exact: true }).click();
      assert.ok(await align.isVisible());
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: auto align, single undo step, undo/redo and Side view`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
