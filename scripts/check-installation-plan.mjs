// Isolated editor checks. Optional local project copy; never reads or writes a cloud project.
// node --import tsx scripts/check-installation-plan.mjs [project.json] [output/directory]
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installationDrawingFixture } from './installation-drawing-fixture.mjs';
import { projectToScene } from '../src/application/projects/editor-mapper.ts';
import { cornerCabinetWidths } from '../src/domain/kitchen/corner-widths.ts';
const [source, output = 'output/installation-plan'] = process.argv.slice(2), base = 'http://127.0.0.1:5177';
const sourceBytes = source ? await readFile(source, 'utf8') : null;
const scene = sourceBytes ? projectToScene(JSON.parse(sourceBytes)) : installationDrawingFixture();
const selected = scene.wardrobes.find(p => p.state.secs.flat().some(i => i.k === 'corner'));
assert.ok(selected, 'The test design needs a corner cabinet.'); scene.activeWardrobe = selected.id;
const originalStrip = selected.state.cornerStrip ?? 0;
const labels = boxes => cornerCabinetWidths(boxes.find(p => p.id === selected.id), boxes)
  .map(s => (s.strip ? 'Strip ' : s.covered ? 'To edge ' : 'W ') + Math.round((s.to - s.from) * 10) + ' mm');
const expected = labels(scene.wardrobes);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, hasTouch: width === 375, isMobile: width === 375, acceptDownloads: true });
    page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/installation-fixture', r => r.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/installation-fixture');
    await page.evaluate(async ({ scene, selectedId }) => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      setLengthUnit('mm');
      window.fixtureEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      window.renderFixture = (id = selectedId) => {
        const e = window.fixtureEditor, project = sceneToProject({ id: 'local-qa', schemaVersion: 1, name: 'Drawing QA', units: 'cm', wardrobes: [] }, e.scene());
        e.viewport.render(project, { selection: { wardrobeId: project.wardrobes.find(w => w.editorLayout.cabinetId === id).id,
          sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      };
      window.renderFixture();
    }, { scene, selectedId: selected.id });
    await page.waitForFunction(count => document.querySelector('#editor').shadowRoot.querySelectorAll('.corner-width').length === count, expected.length);
    assert.deepEqual(await page.locator('.corner-width').allTextContents(), expected);
    await page.screenshot({ path: output + '/app-' + width + '.png' });
    await page.locator('.contextual-actions [data-action="resize"]').click();
    await page.locator('.corner-joint-summary').waitFor({ state: 'visible' });
    assert.match(await page.locator('.corner-joint-summary').textContent(), /corner = .* overlap \+ .* return strip/);
    const strip = page.getByRole('spinbutton', { name: 'Corner allowance', exact: true });
    await strip.fill('30'); await strip.press('Enter');
    const edited = await page.evaluate(() => window.fixtureEditor.scene().wardrobes);
    assert.equal(edited.find(p => p.id === selected.id).state.cornerStrip, 3);
    assert.deepEqual(await page.locator('.corner-width').allTextContents(), labels(edited));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await page.evaluate(id => window.fixtureEditor.scene().wardrobes.find(p => p.id === id).state.cornerStrip ?? 0, selected.id), originalStrip);
    await page.locator('.contextual-actions [data-action="resize"]').click();
    await page.screenshot({ path: output + '/construction-' + width + '.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
    await dialog.locator('img').first().evaluate(i => i.decode());
    const plan = decodeURIComponent(await dialog.locator('img[alt="1 Plan"]').getAttribute('src'));
    for (const s of cornerCabinetWidths(selected, scene.wardrobes)) assert.ok(plan.includes('>' + Math.round((s.to - s.from) * 10) + '<'));
    assert.ok(await dialog.locator('img[alt$=" Service & lighting schedule"]').count());
    const cornerDetail = dialog.locator('img[alt*=" Corner K"]');
    assert.ok(await cornerDetail.count(), 'installed corner has an enlarged detail');
    assert.match(decodeURIComponent(await cornerDetail.first().getAttribute('src')), /Butt joint:/);
    await page.screenshot({ path: output + '/viewer-' + width + '.png' });
    if (width === 1440) {
      const pdf = page.waitForEvent('download');
      // A reference fixture can have unrelated blocking findings; review exports keep their stamp.
      await dialog.getByRole('button', { name: /^Save (as PDF|review PDF)$/ }).click();
      await (await pdf).saveAs(output + '/drawings.pdf');
    }
    assert.deepEqual(errors, []);
    console.log(width + 'px: model rulers, numeric construction edit, undo, drawing viewer and export pass.');
    await page.close();
  }
} finally { await browser.close(); }
if (source) assert.equal(await readFile(source, 'utf8'), sourceBytes, 'source project must not change');
