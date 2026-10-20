const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [375, 844, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: width <= 900, reducedMotion: 'reduce' });
   page.setDefaultTimeout(10000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/canvas-selection-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor"></div></body></html>' }));
   await page.goto(base + '/canvas-selection-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    // Read the actual camera used by the mounted renderer, without a production debug API.
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    const state = createEditorState();
    state.n = 1; state.w = 100; state.secs = [[{ k: 'shelf', h: 30, x: 0, y: 0, w: 96.4 }]];
    state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: 96.4, y: 100 }];
    let editor;
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2,
    } }); } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    editor.snapshot();
    const canvas = document.querySelector('#editor').shadowRoot.querySelector('canvas');
    window.canvasFixture = { editor, camera, THREE, lastPointer: null };
    canvas.addEventListener('pointerdown', e => { window.canvasFixture.lastPointer = e.pointerId; });
   });
   const canvas = page.locator('#editor').locator('canvas');
   const toolbar = page.locator('[data-editor-id="toolbar"]');
   const context = () => toolbar.getAttribute('data-context');
   const state = () => page.evaluate(() => window.canvasFixture.editor.scene().wardrobes[0].state);
   const project = point => page.evaluate(point => {
    const { camera, THREE } = window.canvasFixture;
    const canvas = document.querySelector('#editor').shadowRoot.querySelector('canvas'), r = canvas.getBoundingClientRect();
    camera.updateMatrixWorld(true);
    const p = new THREE.Vector3(...point).project(camera);
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
   }, point);
   const tapAt = async point => {
    if (width <= 900) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(100);
   };
   const tapWorld = async point => tapAt(await project(point));
   const background = async () => {
    const r = await canvas.boundingBox(); return { x: r.x + 12, y: r.y + r.height * .45 };
   };
   const chooseDivider = async () => {
    if (await context() === 'none') await tapWorld([0, 155, 30]);
    await tapWorld([0, 109.8, 30]);
    assert.equal(await context(), 'divider'); assert.equal((await state()).divider, 0);
   };
   await page.waitForTimeout(250);
   // Selecting a frame chooses the wardrobe and releases an item or board within that same wardrobe.
   await chooseDivider();
   await tapWorld([49.1, 170, 30]);
   assert.equal(await context(), 'wardrobe'); assert.equal((await state()).divider, -1);
   await tapWorld([0, 24.8, 30]);
   assert.equal(await context(), 'item'); assert.equal((await state()).item, 0);
   await tapWorld([49.1, 170, 30]);
   assert.equal(await context(), 'wardrobe'); assert.equal((await state()).item, -1);

   const cdp = await page.context().newCDPSession(page);
   for (const releaseFirst of [1, 2]) {
    await chooseDivider();
    const before = await state(), board = await project([0, 109.8, 30]), empty = await background();
    const a = { ...board, id: 1 }, b = { ...empty, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    const remaining = releaseFirst === 1 ? b : a;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [remaining] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(80);
    assert.deepEqual((await state()).dividers, before.dividers, 'pinch takeover does not edit the divider');
    await tapAt(await background());
    assert.equal(await context(), 'none', `background click works after releasing finger ${releaseFirst} first`);
   }
   // A genuine lostpointercapture event must cancel the divider and free future canvas clicks.
   await chooseDivider();
   const beforeLoss = await state(), board = await project([0, 109.8, 30]);
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...board, id: 1 }] });
   await page.evaluate(() => {
    const cv = document.querySelector('#editor').shadowRoot.querySelector('canvas');
    cv.releasePointerCapture(window.canvasFixture.lastPointer);
   });
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: board.x + 1, y: board.y, id: 1 }] });
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
   await tapAt(await background());
   assert.equal(await context(), 'none');
   assert.deepEqual((await state()).dividers, beforeLoss.dividers);
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: frame releases item/divider; both multi-touch release orders and lost capture leave background selection working`);
   await page.evaluate(() => window.canvasFixture.editor.dispose());
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
