import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5178';
const output = 'output/millimetre-edits'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, isMobile: width === 375, hasTouch: width === 375 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/millimetre-fixture', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/millimetre-fixture');
    await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createEditorState } = await import('/src/application/projects/editor-state.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts'); setLengthUnit('mm');
      const state = { ...createEditorState(), w: 100, h: 200, d: 60, n: 1 };
      const scene = { wardrobes: [{ id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, state },
        { id: 2, name: 'B', x: 101, y: 0, z: 0, angle: 0, state: structuredClone(state) }], activeWardrobe: 1, nextWardrobeId: 3 };
      const editor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      window.mmEditor = editor;
      const project = sceneToProject({ schemaVersion: 1, id: 'mm', name: 'Millimetre precision', units: 'mm', wardrobes: [] }, editor.scene());
      editor.viewport.render(project, { selection: { wardrobeId: project.wardrobes[0].id, sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
    });
    await page.locator('.contextual-actions [data-action="resize"]').click();
    const slider = page.locator('[data-dimension="w"]'), input = page.locator('[data-editor-id="w"]');
    await slider.waitFor({ state: 'visible' });
    const gap = () => page.evaluate(() => {
      const [a, b] = window.mmEditor.scene().wardrobes;
      return Math.round((b.x - b.state.w / 2 - a.x - a.state.w / 2) * 1e6) / 1e5;
    });
    assert.equal(await gap(), 10); assert.equal(await slider.getAttribute('step'), '0.1');
    for (let step = 1; step <= 20; step++) {
      await slider.press('ArrowRight');
      assert.equal(await input.inputValue(), String(1000 + step), 'every native range arrow advances exactly 1 mm');
      assert.equal(await gap(), 10 - step / 2, 'nearby cabinet must never magnetically close the gap');
      if (step === 10) await page.screenshot({ path: output + '/gap-5mm-' + width + '.png' });
    }
    for (let step = 1; step <= 20; step++) {
      await slider.press('ArrowLeft'); assert.equal(await gap(), step / 2, 'contact must not hold while reversing');
    }
    await input.fill('1018'); await input.press('Tab'); assert.equal(await gap(), 1, 'exact entry retains a 1 mm gap');
    await input.fill('1010'); await input.press('Tab'); assert.equal(await gap(), 5, 'exact entry retains a 5 mm gap');
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('Phone and desktop: native slider steps, 10..0 mm gaps, reversal and exact 5/1 mm entry passed.');
} finally { await browser.close(); }
