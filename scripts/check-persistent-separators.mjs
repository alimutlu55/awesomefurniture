// Local, mounted browser QA. Pass a read-only copy of the shared project; no cloud session writes.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5180';
const source = process.argv[2] || 'output/dimension-joint-audit/project.json', output = 'output/persistent-separators';
const bytes = await readFile(source, 'utf8'), project = JSON.parse(bytes);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, isMobile: width === 375, hasTouch: width === 375 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/separator-fixture', r => r.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/separator-fixture');
    const audit = await page.evaluate(async project => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { projectToScene, sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const { automaticInstallationParts } = await import('/src/domain/kitchen/automatic-installation.ts');
      const { validateForManufacture } = await import('/src/domain/drawings/manufacturing-validation.ts');
      const { technicalDrawings } = await import('/src/domain/drawings/technical-drawings.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      setLengthUnit('mm');
      const scene = projectToScene(project); scene.activeWardrobe = 29;
      window.separatorEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      window.selectSeparatorCabinet = id => {
        const current = sceneToProject(project, window.separatorEditor.scene());
        window.separatorEditor.viewport.render(current, { selection: { wardrobeId: current.wardrobes.find(p => p.editorLayout.cabinetId === id).id,
          sectionId: null, itemId: null, dividerId: null }, tool: 'select', openPanel: null });
      };
      window.selectSeparatorCabinet(29);
      const current = window.separatorEditor.scene(), parts = automaticInstallationParts(current.wardrobes);
      const common = parts.filter(p => 'sources' in p && p.sources.some(s => s.ownerId === 23 && s.side === 1));
      const input = { studio: current.studio, pieces: current.wardrobes.map(p => ({ ...p, design: p.state })) };
      const chains = technicalDrawings(input)[0].views.flatMap(v => v.items).filter(p => p.kind === 'dims')
        .map(p => p.stops.slice(1).map((s, i) => s - p.stops[i]));
      return { common: common.map(p => [Math.round(p.state.w * 10), Math.round(p.state.h * 10), Math.round(p.state.d * 10)]),
        critical: validateForManufacture(input).findings.filter(f => f.severity === 'critical'), chains };
    }, project);
    assert.deepEqual(audit.common, [[18, 2700, 580]]); assert.deepEqual(audit.critical, []);
    assert.ok(audit.chains.every(row => !row.some((n, i) => n === 599 && row[i + 1] === 1)));
    assert.ok(audit.chains.every(row => !row.some((n, i) => n === 17 && row.slice(i, i + 4).join(',') === '17,1,17,1')));
    await page.waitForFunction(() => document.querySelector('#editor').shadowRoot.querySelectorAll('.corner-width').length === 3);
    await page.screenshot({ path: output + '/app-' + width + '.png' });
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
    await dialog.locator('img').first().evaluate(img => img.decode());
    assert.equal(await dialog.locator('.drawings-release').isVisible(), false);
    await page.screenshot({ path: output + '/plan-' + width + '.png' });
    const svg = await dialog.locator('img[alt="1 Plan"]').getAttribute('src');
    await writeFile(output + '/plan.svg', decodeURIComponent(svg.split(',').slice(1).join(',')));
    const upper = dialog.locator('img[alt="2 Upper furniture plan"]');
    await upper.evaluate(img => img.decode());
    const upperSvg = decodeURIComponent((await upper.getAttribute('src')).split(',').slice(1).join(','));
    assert.ok(upperSvg.includes('P8L'), 'the full shared upright remains on the upper plan');
    await writeFile(output + '/upper-plan.svg', upperSvg);
    await upper.scrollIntoViewIfNeeded();
    await page.screenshot({ path: output + '/upper-plan-' + width + '.png' });
    await page.getByRole('button', { name: 'Close technical drawings', exact: true }).click();
    await page.evaluate(async () => {
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const scene = { wardrobes: [{ id: 1, name: 'Persistent separator test', x: 0, y: 0, z: 0, angle: 0,
        state: { ...createKitchenDesign('base'), sel: 0, item: -1, divider: -1, space: null, open: false } }], activeWardrobe: 1, nextWardrobeId: 2 };
      window.separatorEditor.replaceDesign(sceneToProject({ schemaVersion: 1, id: 'pane-qa', name: 'Pane QA', units: 'cm', wardrobes: [] }, scene));
      window.selectSeparatorCabinet(1);
    });
    await page.locator('.contextual-actions [data-action="more"]').click();
    await page.locator('.contextual-popover').getByRole('menuitem', { name: 'Duplicate', exact: true }).click();
    const duplicated = await page.evaluate(async () => {
      const { automaticInstallationParts } = await import('/src/domain/kitchen/automatic-installation.ts');
      const scene = window.separatorEditor.scene();
      return { bodies: scene.wardrobes.length, x: scene.wardrobes[1]?.x, parts: automaticInstallationParts(scene.wardrobes).length,
        intent: scene.wardrobes.map(p => p.state.endPanelSides) };
    });
    assert.equal(duplicated.bodies, 2); assert.ok(Math.abs(duplicated.x - 61.8) < 1e-7); assert.equal(duplicated.parts, 3);
    assert.deepEqual(duplicated.intent, [[-1, 1], [-1, 1]]);
    await page.waitForTimeout(800); // Capture the completed framing animation.
    await page.screenshot({ path: output + '/retained-' + width + '.png' });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await page.evaluate(() => window.separatorEditor.scene().wardrobes.length), 1);
    await page.evaluate(async () => {
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { sceneToProject } = await import('/src/application/projects/editor-mapper.ts');
      const box = (id, x, unit) => ({ id, name: unit, x, y: 0, z: 0, angle: 0,
        state: { ...createKitchenDesign(unit), sel: 0, item: -1, divider: -1, space: null, open: false } });
      const scene = { wardrobes: [box(1, 0, 'base'), box(2, 30.9, 'end-panel')], activeWardrobe: 1, nextWardrobeId: 3 };
      window.separatorEditor.replaceDesign(sceneToProject({ schemaVersion: 1, id: 'explicit-qa', name: 'Explicit pane', units: 'cm', wardrobes: [] }, scene));
      window.selectSeparatorCabinet(1);
    });
    await page.locator('.contextual-actions [data-action="new"]').click();
    const cabinets = page.getByRole('button', { name: /Cabinets/ });
    if (await cabinets.count()) await cabinets.first().click();
    await page.locator('[data-add-kitchen="tall"]:visible').first().click();
    const explicit = await page.evaluate(() => {
      const boxes = window.separatorEditor.scene().wardrobes;
      return { count: boxes.length, panels: boxes.filter(p => p.state.unit === 'end-panel').length,
        paneHeight: boxes.find(p => p.id === 2)?.state.h, tallHeight: boxes.find(p => p.id === 3)?.state.h, x: boxes.find(p => p.id === 3)?.x };
    });
    assert.equal(explicit.count, 3); assert.equal(explicit.panels, 1); assert.equal(explicit.paneHeight, explicit.tallHeight);
    assert.ok(Math.abs(explicit.x - 61.8) < 1e-7);
    await page.waitForTimeout(800);
    await page.screenshot({ path: output + '/explicit-taller-' + width + '.png' });

    assert.deepEqual(errors, []); await page.close();
  }
  assert.equal(await readFile(source, 'utf8'), bytes);
  console.log('Verified shared 18 mm stock, separated drawing chains, retained separator on Duplicate, and undo at 375 and 1440 px.');
} finally { await browser.close(); }
