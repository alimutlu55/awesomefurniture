import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.MOBILE_TEST_URL ?? 'http://127.0.0.1:4173';
const shots = new URL('../docs/verification/studio-fixtures/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
try {
  for (const view of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 375, height: 812 }]) {
    const phone = view.width < 900;
    const page = await browser.newPage({ viewport: view, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/editor.html');
    await page.locator('[data-editor-id="view-modes"]').waitFor();
    await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
      const root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0';
      document.getElementById('editor-root').replaceWith(root);
      window.fixtureEditor = mountEditor({ root, initialScene: { wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1, studio: createStudio('bedroom') } });
    });
    const el = id => page.locator(`[data-editor-id="${id}"]`), toolbar = el('toolbar');
    const tap = async locator => { if (phone) await locator.tap(); else await locator.click(); };
    const scene = () => page.evaluate(() => window.fixtureEditor.scene());
    await tap(page.locator('[data-view-mode="studio"]'));
    await tap(toolbar.locator('[data-action="fixtures"]'));
    await page.locator('[data-add-fixture="toilet"]:visible').waitFor();
    assert.equal(await page.locator('[data-add-fixture]:visible').count(), 15);
    await page.locator('[data-fixture-search]').fill('sink');
    assert.equal(await page.locator('[data-add-fixture]:visible').count(), 1);
    await page.locator('[data-fixture-search]').fill('');
    await page.locator('[data-fixture-filter]').selectOption('Laundry');
    assert.equal(await page.locator('[data-add-fixture]:visible').count(), 2);
    await page.locator('[data-fixture-filter]').selectOption('');
    await page.screenshot({ path: shots + 'catalog-' + view.name + '.png' });
    await tap(page.locator('[data-fixture-preset="toilet-boxed"]'));
    await page.locator('.fixture-editor:visible').waitFor();
    assert.equal(await toolbar.getAttribute('data-context'), 'studio-fixture');
    assert.equal((await scene()).studio.fixtures.length, 1);
    assert.equal((await scene()).studio.enclosures.length, 1);
    await tap(page.locator('[data-fixture-action="select-assembly"]'));
    if (phone) await tap(page.locator('[data-fixture-action="done"]')); else await tap(el('left-close'));
    await page.waitForTimeout(700);
    const beforeDrag = (await scene()).studio.enclosures[0].anchor.offset;
    const undoBeforeDrag = Number(await el('undo2').locator('small').textContent());
    const dragAt = await page.locator('.measurement-line:visible').first().evaluate(svg => {
      const nums = [...svg.querySelector('path').getAttribute('d').matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)];
      const a = { x: Number(nums[0][1]), y: Number(nums[0][2]) }, b = { x: Number(nums[1][1]), y: Number(nums[1][2]) };
      const cv = svg.getRootNode().querySelector('canvas').getBoundingClientRect(), scale = Math.hypot(b.x - a.x, b.y - a.y) / 37;
      return { x: cv.x + (a.x + b.x) / 2, y: cv.y + (a.y + b.y) / 2 + scale * 20 };
    });
    if (phone) {
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...dragAt, id: 1 }] });
      for (let n = 1; n <= 8; n++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: dragAt.x + n * 4, y: dragAt.y, id: 1 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
    } else {
      await page.mouse.move(dragAt.x, dragAt.y); await page.mouse.down();
      for (let n = 1; n <= 8; n++) await page.mouse.move(dragAt.x + n * 4, dragAt.y);
      await page.mouse.up();
    }
    assert.notEqual((await scene()).studio.enclosures[0].anchor.offset, beforeDrag, 'surface drag moves the selected assembly');
    assert.equal(Number(await el('undo2').locator('small').textContent()), undoBeforeDrag + 1, 'drag is one undo step');
    await tap(el('undo2'));
    assert.equal((await scene()).studio.enclosures[0].anchor.offset, beforeDrag);
    const beforeCancel = (await scene()).studio;
    if (phone) {
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...dragAt, id: 1 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: dragAt.x + 25, y: dragAt.y, id: 1 }] });
      await page.keyboard.press('Escape');
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach();
    } else {
      await page.mouse.move(dragAt.x, dragAt.y); await page.mouse.down(); await page.mouse.move(dragAt.x + 25, dragAt.y);
      await page.keyboard.press('Escape'); await page.mouse.up();
    }
    assert.deepEqual((await scene()).studio, beforeCancel, 'Escape restores a dragged assembly');
    assert.equal(Number(await el('undo2').locator('small').textContent()), undoBeforeDrag, 'cancel adds no undo step');
    await tap(toolbar.locator('[data-action="fixture-installation"]'));
    const enclosureDepth = page.locator('[data-fixture-field="enclosure.d"]');
    await enclosureDepth.fill('20'); await enclosureDepth.press('Enter');
    assert.equal((await scene()).studio.enclosures[0].d, 20);
    assert.match(await page.locator('.fixture-total').textContent(), /74 cm/);
    await page.locator('[data-fixture-field="enclosure.d"]').fill('10');
    await page.locator('[data-fixture-field="enclosure.d"]').press('Enter');
    assert.equal((await scene()).studio.enclosures[0].d, 20, 'small installation enclosure is refused');
    await page.locator('[data-fixture-select="enclosure.finish"]').selectOption('tile');
    assert.equal((await scene()).studio.enclosures[0].finish, 'tile');
    await page.waitForTimeout(400);
    await page.screenshot({ path: shots + 'installation-' + view.name + '.png' });
    await tap(page.locator('[data-fixture-tab="size"]'));
    await page.locator('[data-fixture-field="w"]').fill('40'); await page.locator('[data-fixture-field="w"]').press('Enter');
    assert.equal((await scene()).studio.fixtures[0].w, 40);
    await tap(page.locator('[data-fixture-tab="finish"]'));
    await tap(page.locator('[data-fixture-color="color"][data-color="#3d4142"]'));
    assert.equal((await scene()).studio.fixtures[0].color, '#3d4142');
    if (phone) await tap(page.locator('[data-fixture-action="done"]'));
    await tap(toolbar.locator('[data-action="more"]'));
    await tap(page.locator('[data-action="duplicate-assembly"]'));
    assert.equal((await scene()).studio.fixtures.length, 2);
    assert.equal((await scene()).studio.enclosures.length, 2);
    await tap(el('undo2'));
    assert.equal((await scene()).studio.fixtures.length, 1);
    await tap(toolbar.locator('[data-action="fixtures"]'));
    await tap(page.locator('[data-fixture-preset="vanity-set"]'));
    assert.equal((await scene()).studio.fixtures.length, 5);
    await tap(page.locator('[data-fixture-tab="type"]'));
    assert.equal(await page.locator('[data-fixture-select="variant"]').inputValue(), 'floating');
    const before = await scene();
    await page.evaluate(async () => {
      const { sceneToProject, projectToScene } = await import('/src/application/projects/editor-mapper.ts');
      const { createProject } = await import('/src/domain/project/project.ts');
      const { serializeProject, deserializeProject } = await import('/src/infrastructure/serialization/project-codec.ts');
      const p = deserializeProject(serializeProject(sceneToProject(createProject('fixture-ui', 'Bathroom'), window.fixtureEditor.scene())));
      window.fixtureEditor.replaceDesign(p);
      window.fixtureSaved = projectToScene(p);
    });
    assert.deepEqual((await scene()).studio, before.studio, 'save and reopen retain the complete bathroom');
    await page.waitForTimeout(500);
    await page.screenshot({ path: shots + 'bathroom-' + view.name + '.png' });
    assert.deepEqual(errors, []);
    await page.close();
    console.log('Studio fixtures ' + view.name + ': catalog, exact edits, enclosure validation, finishes, assemblies, undo and reopening passed.');
  }
} finally { await browser.close(); }
