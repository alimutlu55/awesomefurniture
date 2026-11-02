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
        model.scene.studio = withSurfaceProfile(model.scene.studio, ref, s.points.map((p, i) => ({ ...p, y: i === 2 ? 238.7 : i === 3 ? 250 : p.y })));
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
      assert.equal(await page.locator('[data-shape-act="auto-align"]').count(), 0, 'alignment needs no button');
      const at = await page.locator('svg.surface-shape-svg').evaluate(svg => {
        const corner = svg.querySelector('[data-corner="2"]');
        const x = Number(corner.getAttribute('cx')), y = Number(corner.getAttribute('cy'));
        const m = svg.getScreenCTM();
        const start = new DOMPoint(x, y).matrixTransform(m);
        const end = new DOMPoint(x, -259.2).matrixTransform(m);
        return { start: {x:start.x,y:start.y}, end: {x:end.x,y:end.y} };
      });
      await page.mouse.move(at.start.x, at.start.y);
      await page.mouse.down();
      await page.mouse.move(at.end.x, at.end.y, { steps: 8 });
      await page.mouse.up();
      assert.equal(await page.evaluate(() => window.fixture.editor.points()[2].y), 260, 'corner snaps automatically at 10 mm');
      assert.equal(await page.evaluate(() => window.fixture.checkpoints.length), 1);
      await page.locator('[data-shape-act="undo"]').evaluate(b => b.click());
      assert.equal(await page.evaluate(() => window.fixture.model.snapshot() === window.fixture.before), true);
      // Clear the corner selection, so Height edits the whole outline.
      await page.locator('svg.surface-shape-svg').press('Escape');
      const height = page.locator('[data-shape-field="height"]');
      await height.fill('259'); await height.press('Enter');
      assert.equal(await height.inputValue(), '260', 'typed height snaps at 10 mm');
      await height.fill('258.9'); await height.press('Enter');
      assert.equal(await height.inputValue(), '258.9', 'typed height releases beyond 10 mm');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: no button, automatic corner and typed size snapping, 10 mm release, undo`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
