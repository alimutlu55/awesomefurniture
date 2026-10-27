// Mounted app QA on local fixture copies only; no cloud session writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5179', output = 'output/installation-clearance';
const source = 'output/cargo-audit/current-design.json', bytes = await readFile(source, 'utf8'), project = JSON.parse(bytes);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, isMobile: width === 375, hasTouch: width === 375 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/clearance-fixture', r => r.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/clearance-fixture');
    const mounted = await page.evaluate(async project => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { projectToScene, sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { validateForManufacture } = await import('/src/domain/drawings/manufacturing-validation.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      setLengthUnit('mm');
      const scene = projectToScene(project); scene.activeWardrobe = 14;
      window.clearanceEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      const current = sceneToProject(project, window.clearanceEditor.scene());
      window.clearanceEditor.viewport.render(current, { selection: { wardrobeId: current.wardrobes.find(p => p.editorLayout.cabinetId === 14).id,
        sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      const input = { studio: scene.studio, pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) };
      return { x: scene.wardrobes.find(p => p.id === 14).x,
        clashes: validateForManufacture(input).findings.filter(f => f.severity === 'critical') };
    }, project);
    const original = project.wardrobes.find(p => p.editorLayout.cabinetId === 14);
    assert.ok(Math.abs(mounted.x - original.position.x - 3.3) < 1e-7);
    assert.deepEqual(mounted.clashes, []);
    await page.locator('.contextual-actions [data-action="resize"]').click();
    const strip = page.locator('[data-construction="cornerStrip"]'); await strip.waitFor({ state: 'visible' });
    assert.equal(await strip.inputValue(), '40');
    await strip.fill('50'); await strip.press('Tab');
    assert.equal(await strip.inputValue(), '50');
    const shifted = await page.evaluate(() => window.clearanceEditor.scene().wardrobes.find(p => p.id === 14));
    assert.ok(Math.abs(shifted.x - mounted.x - 1) < 1e-7); assert.equal(shifted.state.w, 30);
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.ok(Math.abs((await page.evaluate(() => window.clearanceEditor.scene().wardrobes.find(p => p.id === 14).x)) - mounted.x) < 1e-7);
    await page.screenshot({ path: output + '/saved-design-' + width + '.png' });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
    await dialog.locator('img').first().evaluate(i => i.decode());
    assert.equal(await dialog.locator('.drawings-release').isVisible(), false, 'saved design passes manufacturing validation');
    await page.screenshot({ path: output + '/drawings-' + width + '.png' });
    const plan = await dialog.locator('img[alt="1 Plan"]').getAttribute('src');
    await writeFile(output + '/plan.svg', decodeURIComponent(plan.split(',').slice(1).join(',')));
    await page.getByRole('button', { name: 'Close technical drawings', exact: true }).click();
    const panes = await page.evaluate(async () => {
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { automaticInstallationParts } = await import('/src/domain/kitchen/automatic-installation.ts');
      const unit = (id, x, kind) => ({ id, name: kind, x, y: 0, z: 0, angle: 0,
        state: { ...createKitchenDesign(kind), sel: 0, item: -1, divider: -1, space: null, open: false } });
      const scene = { wardrobes: [unit(1, 0, 'base'), unit(2, 30.9, 'end-panel'), unit(3, 32.7, 'end-panel'), unit(4, 63.6, 'base')], activeWardrobe: 1, nextWardrobeId: 5 };
      window.clearanceEditor.replaceDesign(sceneToProject({ schemaVersion: 1, id: 'separator-qa', name: 'Separator', units: 'cm', wardrobes: [] }, scene));
      const current = window.clearanceEditor.scene();
      return { count: current.wardrobes.filter(p => p.state.unit === 'end-panel').length,
        width: current.wardrobes.find(p => p.state.unit === 'end-panel').state.w,
        x: current.wardrobes.find(p => p.id === 4).x,
        automatic: automaticInstallationParts(current.wardrobes).length };
    });
    assert.equal(panes.count, 1); assert.equal(panes.width, 1.8); assert.equal(panes.automatic, 2);
    assert.ok(Math.abs(panes.x - 61.8) < 1e-7);
    await page.waitForTimeout(1000); // Let the camera finish framing the replacement design before visual QA.
    await page.screenshot({ path: output + '/shared-pane-' + width + '.png' });
    assert.deepEqual(errors, []); await page.close();
  }
  assert.equal(await readFile(source, 'utf8'), bytes);
  console.log('Saved-design clearance, configurable strips, undo, drawing viewer and shared separator verified at 375 and 1440 px.');
} finally { await browser.close(); }
