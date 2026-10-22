const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const attached = process.env.INTERIOR_ATTACHED === '1';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of (process.env.INTERIOR_WIDTH ? [Number(process.env.INTERIOR_WIDTH)] : [375, 1440]))
  for (const furniture of (process.env.INTERIOR_FURNITURE ? [process.env.INTERIOR_FURNITURE] : ['wardrobe', 'cabinet'])) {
   const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: width <= 900, reducedMotion: 'reduce' });
   page.setDefaultTimeout(10000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/interior-drag-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor"></div></body></html>' }));
   await page.goto(base + '/interior-drag-fixture');
   await page.evaluate(async ({ furniture, attached }) => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
    const { createWardrobeGeometry } = await import('/src/domain/geometry/wardrobe-geometry.js');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    const cabinet = furniture === 'cabinet', state = cabinet ? { ...createEditorState(), ...createKitchenDesign('base') } : createEditorState();
    state.n = 1; state.w = cabinet ? 60 : 100; state.doors = 'none'; state.open = true;
    state.secs = [[{ k: 'shelf', h: cabinet ? 15 : 30, x: 0, y: 0, w: state.w - 3.6 }]];
    const rules = createWardrobeGeometry(() => state), sw = rules.widths()[0];
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: sw, y: cabinet ? 32 : 100 },
     { i: 0, orientation: 'vertical', x: sw / 2, y0: cabinet ? 45 : 130, y1: rules.ih(), roofFit: true }];
    if (attached) {
     state.secs[0][0].w = sw / 2 - .9;
     state.dividers[0] = { i: 0, orientation: 'horizontal', x0: 0, x1: sw / 2 - .9, y: rules.ih() * .25 };
     state.dividers[1].y0 = 0;
     state.dividers.push({ i: 0, orientation: 'horizontal', x0: sw / 2 + .9, x1: sw, y: rules.ih() * .65 });
    }
    let editor;
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     wardrobes: [{ id: 1, name: 'Furniture', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2,
    } }); } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    editor.snapshot();
    window.dragFixture = { editor, camera, THREE, rules: createWardrobeGeometry(() => editor.scene().wardrobes[0].state) };
   }, { furniture, attached });
   const canvas = page.locator('#editor').locator('canvas'), bar = page.locator('[data-editor-id="toolbar"]');
   const state = () => page.evaluate(() => window.dragFixture.editor.scene().wardrobes[0].state);
   const pose = () => page.evaluate(() => { const c = window.dragFixture.editor.scene().wardrobes[0]; return { x: c.x, y: c.y, z: c.z, angle: c.angle }; });
   const point = async (kind, index = 0) => page.evaluate(({ kind, index }) => {
    const { editor, rules } = window.dragFixture, c = editor.scene().wardrobes[0], s = c.state;
    if (kind === 'frame') return [(index < 5 ? 1 : -1) * (s.w / 2 - .9), s.h * [.7, .9, .3, .15, .5][index % 5], s.d / 2];
    if (kind === 'space') return [s.w * .3, s.h * .7, s.d / 2];
    if (kind === 'fitting') { const g = rules.itemGeom(0, index); return [(g.x0 + g.x1) / 2 - s.w / 2, (g.y0 + g.y1) / 2, s.d / 2]; }
    const r = rules.visibleRect(s.dividers[index]);
    return [-s.w / 2 + 1.8 + (r.x0 + r.x1) / 2, rules.interiorFloor() + (r.y0 + r.y1) / 2, s.d / 2];
   }, { kind, index });
   const project = p => page.evaluate(p => {
    const { camera, THREE } = window.dragFixture, r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
    camera.updateMatrixWorld(true); const q = new THREE.Vector3(...p).project(camera);
    return { x: r.x + (q.x + 1) * r.width / 2, y: r.y + (1 - q.y) * r.height / 2 };
   }, p);
   const onCanvas = q => page.evaluate(q => document.querySelector('#editor').shadowRoot.elementFromPoint(q.x, q.y)?.tagName === 'CANVAS', q);
   const framePoint = async () => {
    // Array grips and Add labels are real controls. Grab an exposed part of
    // the frame, as a person would, rather than dragging through those buttons.
    for (let n = 0; n < 10; n++) { const p = await point('frame', n); if (await onCanvas(await project(p))) return p; }
    throw new Error('No exposed frame point to drag');
   };
   const tap = async p => { const q = await project(p); if (width <= 900) await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y); await page.waitForTimeout(100); };
   const cdp = await page.context().newCDPSession(page);
   const checkDistances = async () => {
    const result = await page.evaluate(() => {
     const { rules } = window.dragFixture, m = rules.dividerMeasurements(1);
     return ['before', 'after'].map(side => ({ expected: m[side], side }));
    });
    for (const { expected, side } of result) {
     const badge = page.getByRole('slider', { name: side === 'before' ? 'Distance left of divider' : 'Distance right of divider', exact: true });
     assert.ok(expected > 1, 'a real opening has a positive distance');
     assert.ok(Math.abs(Number(await badge.getAttribute('aria-valuenow')) - expected) < .001, 'control value follows the moving divider');
     assert.equal(await badge.textContent(), await badge.getAttribute('aria-valuetext'), 'visible distance matches the control value');
    }
   };
   const drag = async (p, dx, dy, during) => {
    const a = await project(p), b = await project([p[0] + dx, p[1] + dy, p[2]]);
    assert.equal(await page.evaluate(a => document.querySelector('#editor').shadowRoot.elementFromPoint(a.x, a.y)?.tagName, a), 'CANVAS', 'drag starts on the model rather than an overlay control');
    if (width <= 900) {
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
     for (let n = 1; n <= 10; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * n / 10, y: a.y + (b.y - a.y) * n / 10, id: 1 }] });
     if (during) await during();
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 10 }); if (during) await during(); await page.mouse.up(); }
    await page.waitForTimeout(100);
   };
   await canvas.waitFor(); await page.waitForTimeout(200);
   await tap(await point('fitting'));
   assert.match(await bar.getAttribute('data-context'), /wardrobe|kitchen/);
   assert.equal(await page.locator('[data-editor-id="crumb"]').textContent(), 'Furniture', 'first click selects furniture without an interior selection');
   const initialPose = await pose();
   // Cross the touch tap tolerance in screen pixels even when the scene is framed far away.
   await drag(await framePoint(), 20, 0);
   assert.notDeepEqual(await pose(), initialPose, 'the furniture layer can move furniture');
   await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(100);
   assert.deepEqual(await pose(), initialPose);
   await tap(await point('board', 1));
   assert.equal((await state()).divider, 1, 'second click selects the vertical divider');
   await checkDistances();
   const vertical = (await state()).dividers[1].x;
   await drag(await point('board', 1), 8, 0, checkDistances);
   assert.ok((await state()).dividers[1].x > vertical + 3, 'vertical divider follows a horizontal drag');
   assert.deepEqual(await pose(), initialPose);
   assert.equal(await page.locator('.ground-rotate:visible,.array-grip:visible').count(), 0, 'interior selection has no furniture transform grips');
   if (attached) {
    await checkDistances();
    await page.locator('[data-action="resize"]').click();
    const left = page.getByRole('slider', { name: 'Distance left of divider', exact: true });
    const value = Number(await left.getAttribute('aria-valuenow'));
    await left.focus(); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100);
    assert.ok(Math.abs(Number(await left.getAttribute('aria-valuenow')) - (value - 1)) < .001, 'opening remains editable with attached shelves');
    await checkDistances();
    await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(100); await checkDistances();
    await page.screenshot({ path: `/tmp/wardrobe-divider-distances-${width}-${furniture}.png` });
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px ${furniture}: attached shelves and fitting, live distance labels/control values, exact positioning and undo`);
    await page.evaluate(() => window.dragFixture.editor.dispose()); await page.close(); continue;
   }
   await tap(await point('board', 0));
   const shelf = (await state()).dividers[0].y;
   await drag(await point('board', 0), 0, furniture === 'cabinet' ? 5 : 12);
   assert.ok((await state()).dividers[0].y > shelf + 2, 'shelf board follows a vertical drag');
   assert.deepEqual(await pose(), initialPose);
   await tap(await point('fitting')); assert.equal((await state()).item, 0);
   const before = (await state()).secs[0][0].y;
   await drag(await point('fitting'), 0, 12);
   assert.ok((await state()).secs[0][0].y > before + 2, 'fitting follows a vertical drag: ' + JSON.stringify({ before, after: (await state()).secs[0][0] }));
   assert.deepEqual(await pose(), initialPose);
   await drag(await framePoint(), 10, 0); assert.deepEqual(await pose(), initialPose, 'dragging the frame cannot move furniture while an item is selected');
   await canvas.focus(); await page.keyboard.press('Escape');
   assert.equal((await state()).item, -1); assert.equal((await state()).divider, -1);
   await drag(await framePoint(), 10, 0); assert.deepEqual(await pose(), initialPose, 'a selected section cannot move furniture');
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px ${furniture}: two selection layers, direct vertical-divider/shelf/fitting drags, furniture locked inside`);
   await page.evaluate(() => window.dragFixture.editor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
