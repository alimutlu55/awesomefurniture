const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const near = (a, b, message) => assert.ok(Math.abs(a - b) < .001, `${message}: ${a} != ${b}`);

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of (process.env.EDGE_WIDTH ? [Number(process.env.EDGE_WIDTH)] : [375, 1440])) {
   for (const kind of (process.env.EDGE_KIND ? [process.env.EDGE_KIND] : ['oven-gap', 'fitted-drawer', 'wardrobe', 'wall-unit', 'slope-board'])) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500, isMobile: width < 500, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/edge-resize-fixture', route => route.fulfill({ contentType: 'text/html', body:
     '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/edge-resize-fixture');
    await page.evaluate(async kind => {
     const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
     const { createEditorState } = await import('/src/application/projects/editor-state.ts');
     const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
     const { createWardrobeGeometry } = await import('/src/domain/geometry/wardrobe-geometry.js');
     const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
     const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
     const f = window.edgeFixture = { THREE };
     THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); f.camera = this; };
     const kitchen = kind === 'oven-gap' || kind === 'fitted-drawer', wall = kind === 'wall-unit';
     const state = { ...createEditorState(), ...(kitchen || wall ? createKitchenDesign(wall ? 'upper' : 'tall') : {}),
      n: 1, w: 100, h: kitchen ? 150 : 120, d: 60, doors: 'none', open: true, item: -1, dividers: [] };
     state.secs = [[{ k: 'drawer', h: 20, y: 0 }, { k: kitchen ? kind === 'fitted-drawer' ? 'drawer' : 'sdrawer' : 'shelf', h: kitchen ? 10 : 25, y: 25 },
      { k: kitchen ? 'oven' : 'shelf', h: kitchen ? 60 : 20, y: kitchen ? 35 : 50 }]];
     if (kind === 'slope-board') {
      state.n = 2; state.w = 201.8; state.wt = [1, 1]; state.secs = [[], state.secs[0]]; f.bay = 1;
      state.shape = { template: 'custom', top: [{ x: 0, y: 140 }, { x: 201.8, y: 100 }] };
      state.dividers = [{ i: 1, orientation: 'horizontal', x0: 0, x1: 98.2, y: 20.9 }];
     } else f.bay = 0;
     try { f.editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
      wardrobes: [{ id: 1, name: kind, x: 0, y: wall ? 142 : 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2,
     } }); } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
     f.rules = createWardrobeGeometry(() => f.editor.scene().wardrobes[0].state);
    }, kind);
    await page.waitForTimeout(300);
    const read = () => page.evaluate(() => {
     const { editor, rules, bay } = window.edgeFixture, state = editor.scene().wardrobes[0].state;
     return { items: structuredClone(state.secs[bay]), g: rules.itemGeom(bay, 1), floor: rules.interiorFloor(), selected: state.item,
      minH: rules.effectiveMin(state.secs[bay][1].k) };
    });
    const project = async (frame = false) => page.evaluate(frame => {
     const f = window.edgeFixture, c = f.editor.scene().wardrobes[0], s = c.state, g = f.rules.itemGeom(f.bay, 1);
     const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
     f.camera.updateMatrixWorld(true);
     const p = new f.THREE.Vector3(frame ? s.w / 2 - .9 : (g.x0 + g.x1) / 2 - s.w / 2,
      c.y + (frame ? s.h * .7 : (g.y0 + g.y1) / 2), s.d / 2).project(f.camera);
     return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
    }, frame);
    const tap = async point => {
     if (width < 500) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
     await page.waitForTimeout(150);
    };
    await tap(await project(true)); await tap(await project());
    assert.equal((await read()).selected, 1, `${kind}: fitting is selected`);
    const bottom = page.getByRole('button', { name: 'Resize item height from the bottom', exact: true });
    const top = page.getByRole('button', { name: 'Resize item height from the top', exact: true });
    await bottom.waitFor({ state: 'visible' });
    const cdp = await page.context().newCDPSession(page);
    const start = async handle => {
     const box = await handle.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
     if (width < 500) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
     else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
     return point;
    };
    const move = async (point, dy) => {
     if (width < 500) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + dy, id: 1 }] });
     else await page.mouse.move(point.x, point.y + dy, { steps: 6 });
     await page.waitForTimeout(80);
    };
    const end = async (cancel = false) => {
     if (width < 500) await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
     else { if (cancel) await page.keyboard.press('Escape'); await page.mouse.up(); }
     await page.waitForTimeout(150);
    };
    const before = await read(); near(before.g.freeTop, 0, 'touching the item above');
    const point = await start(bottom); await move(point, 90);
    const grown = await read(); assert.ok(grown.items[1].h > before.items[1].h + 1, `${kind}: bottom drag grows into the lower gap`);
    near(grown.g.y1, before.g.y1, 'top stays fixed');
    near(grown.items[1].y, kind === 'slope-board' ? 21.8 : 20, 'stops exactly at the support');
    const guides = page.locator('[data-smart-guides]');
    assert.ok(await guides.isVisible(), 'the real resize handler shows Smart Guides at the supporting edge');
    assert.ok(Number(await guides.getAttribute('data-guide-count')) > 0, 'alignment is shown with guide lines');
    assert.equal((await guides.textContent()).trim(), '', 'Smart Guides never add alignment text');
    assert.ok((await guides.locator('svg path').evaluateAll(paths => paths.map(p => getComputedStyle(p).stroke)))
     .every(color => color === 'rgb(50, 129, 91)' || color === 'rgb(95, 159, 120)'), 'all Smart Guide strokes are green');
    assert.ok((await guides.locator('svg path').evaluateAll(paths => paths.map(p => parseFloat(getComputedStyle(p).strokeWidth))))
     .every(width => width <= .75), 'guide strokes remain hairlines at every camera zoom');
    assert.ok((await guides.locator('svg path').evaluateAll(paths => paths.map(p => (p.getAttribute('d').match(/M/g) || []).length)))
     .every(count => count === 1), 'guides have no endpoint crosses or ornaments');
    assert.equal(await guides.evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'guides leave drag handles interactive');
    for (const index of [0, 2]) near(grown.items[index].y, before.items[index].y, 'neighbors stay fixed');
    await page.screenshot({ path: `/tmp/wardrobe-item-edge-${width}-${kind}-grown.png` });
    await move(point, 130); near((await read()).items[1].h, grown.items[1].h, 'drag cannot pass through the support');
    await move(point, -80); near((await read()).items[1].h, Math.min(before.items[1].h, before.minH), 'reversal shrinks to minimum without sticking');
    await move(point, 90); await end(); near((await read()).items[1].h, grown.items[1].h, 'release retains the resized geometry');
    assert.equal(await guides.isVisible(), false, 'release clears resize guides');
    await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(150);
    assert.deepEqual((await read()).items, before.items, 'one undo restores the original section');
    const cancelPoint = await start(bottom); await move(cancelPoint, 90); await end(true);
    assert.deepEqual((await read()).items, before.items, 'cancellation restores original geometry');
    await bottom.focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
    near((await read()).items[1].h, before.items[1].h + 1, 'keyboard down grows the bottom');
    await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(150);
    await top.focus(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(100);
    near((await read()).items[1].h, before.items[1].h, 'top still respects the upper neighbor');
    await page.locator('[data-action="resize"]').first().click();
    const heightField = page.locator('[data-editor-id="ih"]');
    await heightField.focus(); await page.waitForTimeout(80);
    assert.ok(await guides.isVisible(), 'the Size field uses the same line guides as the edge handle');
    assert.equal((await guides.textContent()).trim(), '', 'Size assistance also has no alignment text');
    await heightField.press('Tab'); await page.waitForTimeout(80);
    assert.equal(await guides.isVisible(), false, 'leaving the Size field clears guides');
    if (kind === 'wardrobe') {
     const alignedHeight = (await read()).items[1].h;
     await heightField.fill((alignedHeight - .1).toFixed(1)); await heightField.press('Tab'); await page.waitForTimeout(80);
     near((await read()).items[1].h, alignedHeight, 'the Size field automatically closes a 1 mm gap');
     await heightField.fill((alignedHeight - .2).toFixed(1)); await heightField.press('Tab'); await page.waitForTimeout(80);
     near((await read()).items[1].h, alignedHeight - .2, 'the Size field preserves a gap beyond 1 mm');
     await page.locator('#editor').locator('canvas').focus();
     await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(80);
     near((await read()).items[1].h, alignedHeight, 'one undo reverses the unsnapped edit');
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px ${kind}: bottom handle grows between neighbors, stops at support, reverses, cancels, undoes and accepts keyboard input`);
    await page.screenshot({ path: `/tmp/wardrobe-item-edge-${width}-${kind}.png` });
    await page.evaluate(() => window.edgeFixture.editor.dispose()); await page.close();
   }
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
