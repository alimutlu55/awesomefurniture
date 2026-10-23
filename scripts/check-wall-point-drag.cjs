// Requires Vite. A cut wall end must move its geometry without exposing a duplicate dot.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  const widths = process.env.POINT_WIDTH ? [Number(process.env.POINT_WIDTH)] : [375, 1440];
  const cuts = process.env.POINT_CUT ? [process.env.POINT_CUT] : ['profile', 'inner', 'saved', 'depth'];
  for (const width of widths) for (const cut of cuts) {
   const touch = width === 375;
   const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/point-drag-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/point-drag-fixture');
   await page.evaluate(async cut => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { rectangleStudio } = await import('/src/domain/studio/studio-templates.ts');
    const { splitSolidBoundary, replaceSurfaceSections, surfaceSolid } = await import('/src/domain/studio/studio-solid-boundary.ts');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera, editor;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    const at = cut === 'depth' ? { edge: 2, section: 0, across: true, fraction: .37 } : { edge: 2, section: cut === 'inner' ? 0 : 1, fraction: .5 };
    let studio = splitSolidBoundary(rectangleStudio(400, 240), 'wall', 'w1', at);
    if (cut === 'saved') studio = replaceSurfaceSections(studio, 'wall', 'w1', surfaceSolid(studio, 'wall', 'w1').sections);
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     studio, wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1,
    } }); } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    window.pointFixture = { editor, camera, THREE };
   }, cut);
   await page.locator('[data-view-mode="studio"]').click(); await page.waitForTimeout(500);
   const project = point => page.evaluate(point => {
    const { camera, THREE } = window.pointFixture; camera.updateMatrixWorld(true);
    const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
    const p = new THREE.Vector3(...point).project(camera);
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
   }, point);
   const at = await project([-100, 130, 0]);
   if (touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y);
   assert.equal(await page.locator('[data-editor-id="toolbar"]').getAttribute('data-context'), 'wall');
   const room = await page.evaluate(() => window.pointFixture.editor.scene().studio);
   const wall = room.walls[0], original = room.corners.find(c => c.id === wall.a);
   const key = 'corner:' + original.id, handle = page.locator(`[data-room-handle="${key}"]`);
   const centre = async () => { const r = await handle.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
   const start = await centre(), target = await project([original.x + 60, 0, original.z + 45]);
   const dots = page.locator('.room-handle.point'), count = await dots.count();
   await handle.evaluate(el => el.dataset.testOriginal = 'same-node');
   const cdp = await page.context().newCDPSession(page);
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
   else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
   for (let n = 1; n <= 12; n++) {
    const p = { x: start.x + (target.x - start.x) * n / 12, y: start.y + (target.y - start.y) * n / 12 };
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] });
    else await page.mouse.move(p.x, p.y);
    assert.equal(await dots.count(), count); assert.equal(await handle.getAttribute('data-test-original'), 'same-node');
   }
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
   const moved = await page.evaluate(id => window.pointFixture.editor.scene().studio.corners.find(c => c.id === id), original.id);
   assert.ok(Math.hypot(moved.x - original.x, moved.z - original.z) > 30, 'the wall corner actually moved');
   const position = await centre(), expected = await project([moved.x, 0, moved.z]);
   assert.ok(Math.hypot(position.x - expected.x, position.y - expected.y) < .25, 'the existing handle follows the wall geometry');
   const leftBehind = await dots.evaluateAll((es, start) => es.filter(el => {
    const r = el.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - start.x, r.y + r.height / 2 - start.y) < 8;
   }).map(el => el.dataset.roomHandle), start);
   assert.deepEqual(leftBehind, [], 'no black handle remains at the old location');
   if (cut !== 'depth') {
    const point = page.locator('[data-room-handle="wall-point:w1:3"]'), r = await point.boundingBox();
    const start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    const before = await page.evaluate(() => window.pointFixture.editor.scene().studio.walls[0].outline[3]);
    await point.evaluate(el => el.dataset.testOriginal = 'same-point');
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    for (let n = 1; n <= 12; n++) {
     const p = { x: start.x, y: start.y + n * 3 };
     if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] });
     else await page.mouse.move(p.x, p.y);
     assert.equal(await dots.count(), count); assert.equal(await point.getAttribute('data-test-original'), 'same-point');
    }
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
    const wall = await page.evaluate(() => window.pointFixture.editor.scene().studio.walls[0]);
    assert.ok(wall.outline[3].y < before.y - 10, 'the bend reshapes the actual wall');
    if (wall.sections) assert.deepEqual(wall.sections[0].outline, wall.sections[1].outline, 'matching faces move together');
    assert.equal(await dots.evaluateAll((es, start) => es.filter(el => {
     const r = el.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - start.x, r.y + r.height / 2 - start.y) < 8;
    }).length, start), 0, 'no matching shape handle stays behind');
   }
   assert.deepEqual(errors, []);
   await page.screenshot({ path: `/tmp/wall-point-moved-${cut}-${width}.png` });
   console.log(`PASS ${width}px ${cut}: one captured point moves the wall; no duplicate remains`);
   await page.evaluate(() => window.pointFixture.editor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
