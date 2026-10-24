// Boards line up while dragged: a shelf level with the shelf next door, a divider centred in its space.
// The existing snap line shows only while it holds, the board lands exactly, undo restores it, Shift is free.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = process.argv[2] || '/tmp';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [1440, 375]) {
   const mobile = width <= 900;
   const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: mobile, reducedMotion: 'reduce' });
   page.setDefaultTimeout(10000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/board-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor"></div></body></html>' }));
   await page.goto(base + '/board-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { createWardrobeGeometry } = await import('/src/domain/geometry/wardrobe-geometry.js');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    const state = { ...createEditorState(), w: 200, h: 230, n: 2, doors: 'none', open: true };
    state.secs = [[], [], [], [], [], []];
    const ws = createWardrobeGeometry(() => state).widths();
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: ws[0], y: 100 }, { i: 1, orientation: 'horizontal', x0: 0, x1: ws[1], y: 120 },
     { i: 1, orientation: 'vertical', x: ws[1] / 2 + 10, y0: 121.8, y1: 190 }];
    let editor;
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     wardrobes: [{ id: 1, name: 'Furniture', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 } }); }
    finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    editor.snapshot();
    window.fx = { editor, camera, THREE, rules: createWardrobeGeometry(() => editor.scene().wardrobes[0].state) };
   });
   const state = () => page.evaluate(() => window.fx.editor.scene().wardrobes[0].state);
   const board = index => page.evaluate(index => {
    const { editor, rules } = window.fx, s = editor.scene().wardrobes[0].state, d = s.dividers[index], r = rules.visibleRect(d), ws = rules.widths();
    const left = 1.8 + ws.slice(0, d.i).reduce((x, w) => x + w + 1.8, 0);
    return [-s.w / 2 + left + (r.x0 + r.x1) / 2, rules.interiorFloor() + (r.y0 + r.y1) / 2, s.d / 2];
   }, index);
   const project = p => page.evaluate(p => {
    const { camera, THREE } = window.fx, r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
    camera.updateMatrixWorld(true); const q = new THREE.Vector3(...p).project(camera);
    return { x: r.x + (q.x + 1) * r.width / 2, y: r.y + (1 - q.y) * r.height / 2 };
   }, p);
   const guide = () => page.evaluate(() => {
    const layer = document.querySelector('#editor').shadowRoot.querySelector('[data-editor-id="snap-layer"]');
    const line = layer?.querySelector('.snap-line');
    return { on: !!layer?.classList.contains('on'), width: line ? parseFloat(line.style.width) : 0 };
   });
   const cdp = await page.context().newCDPSession(page);
   const tap = async p => { const q = await project(p); if (mobile) await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y); await page.waitForTimeout(150); };
   /** Drag in steps; `during` runs before release. With `shift`, the modifier is held (desktop). */
   const drag = async (p, dx, dy, during, shift = false) => {
    const a = await project(p), b = await project([p[0] + dx, p[1] + dy, p[2]]);
    if (mobile) {
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
     for (let n = 1; n <= 16; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * n / 16, y: a.y + (b.y - a.y) * n / 16, id: 1 }] });
     await page.waitForTimeout(120); if (during) await during();
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
     if (shift) await page.keyboard.down('Shift');
     await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 16 });
     await page.waitForTimeout(120); if (during) await during();
     await page.mouse.up(); if (shift) await page.keyboard.up('Shift');
    }
    await page.waitForTimeout(150);
   };
   await page.locator('#editor').locator('canvas').waitFor(); await page.waitForTimeout(300);
   // Furniture first, then the board (two selection layers).
   await tap(await board(0)); await tap(await board(0));
   assert.equal((await state()).divider, 0, 'the shelf board is selected');
   assert.equal((await guide()).on, false, 'no guide before anything moves');
   let during;
   await drag(await board(0), 0, 18.7, async () => {
    during = await guide();
    await page.screenshot({ path: `${shots}/board-level-${width}.png` });
   });
   assert.ok(during.on && during.width > 20, 'the existing snap line shows while the shelf is level with the next one: ' + JSON.stringify(during));
   assert.equal((await state()).dividers[0].y, 120, 'lands exactly level, to the millimetre');
   assert.equal((await guide()).on, false, 'the guide goes when the drag ends');
   await page.locator('#editor').locator('canvas').focus(); await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(150);
   assert.equal((await state()).dividers[0].y, 100, 'one undo puts it back');
   // Far from any line: no guide.
   if ((await state()).divider !== 0) await tap(await board(0));
   assert.equal((await state()).divider, 0, 'the shelf board is still selected after undo');
   await drag(await board(0), 0, -20, async () => { during = await guide(); });
   assert.equal(during.on, false, 'no guide when nothing lines up: ' + JSON.stringify(during));
   assert.ok(Math.abs((await state()).dividers[0].y - 80) < 1.5, 'moved freely: ' + (await state()).dividers[0].y);
   if (!mobile) {
    await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(150);
    await tap(await board(0));
    await drag(await board(0), 0, 19.3, async () => { during = await guide(); }, true);
    const y = (await state()).dividers[0].y;
    assert.equal(during.on, false, 'Shift: no snap and no guide'); assert.ok(y !== 120 && Math.abs(y - 119.3) < 1, 'Shift moves freely: ' + y);
   }
   // The divider in the next bay: centred in its space.
   await tap(await board(2)); await tap(await board(2));
   assert.equal((await state()).divider, 2, 'the divider is selected');
   const ws = await page.evaluate(() => window.fx.rules.widths());
   await drag(await board(2), -9.4, 0, async () => {
    during = await guide();
    await page.screenshot({ path: `${shots}/board-centred-${width}.png` });
   });
   assert.ok(during.on, 'the snap line shows while the divider is centred');
   const d = (await state()).dividers[2]; assert.ok(Math.abs(d.x - ws[1] / 2) < 1e-9, 'exactly centred: ' + d.x);
   const gaps = await page.evaluate(() => { const m = window.fx.rules.dividerMeasurements(2); return [m.before, m.after]; });
   assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-9, 'equal gaps either side: ' + gaps);
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: shelf level with the next bay, divider centred, guide only while aligned, exact landing, undo${mobile ? '' : ', Shift free'}`);
   await page.evaluate(() => window.fx.editor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
