// Requires the Vite dev server. Exercises actual 3D return edges, not a projected profile loop.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  const widths = process.env.BOUNDARY_WIDTH ? [Number(process.env.BOUNDARY_WIDTH)] : [375, 1440];
  const shapes = process.env.BOUNDARY_SHAPE ? [process.env.BOUNDARY_SHAPE] : ['landing', 'stairs', 'slope', 'box', 'wall'];
  for (const width of widths) for (const shape of shapes) {
   const height = width === 375 ? 812 : 900, touch = width === 375, kind = shape === 'wall' ? 'wall' : 'ceiling';
   const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/boundary-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/boundary-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); window.boundaryCamera = this; };
    try { window.boundaryEditor = mountEditor({ root: document.querySelector('#editor'), initialScene:
     { studio: createStudio('under-stairs'), wardrobes: [], activeWardrobe: 0, nextWardrobeId: 1 } });
    } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    window.boundaryTHREE = THREE;
   });
   await page.locator('[data-view-mode="studio"]').click();
   await page.waitForTimeout(500);
   if (kind === 'ceiling') {
    await page.locator('[data-action="ceiling"]').click();
    await page.locator(`[data-add-ceiling="${shape}"]:visible`).click();
    await page.waitForTimeout(300);
   }
   const toolbar = page.locator('[data-editor-id="toolbar"]');
   let selected = false;
   for (const y of [.51, .53, .55, .49, .45, .57]) {
    for (const x of [.5, .6, .4, .7, .3]) {
     await page.mouse.click(x * width, y * height);
     await page.waitForTimeout(75);
     if (await toolbar.getAttribute('data-context') === kind) { selected = true; break; }
    }
    if (selected) break;
   }
   if (!selected) await page.screenshot({ path: '/tmp/inner-corner-selection-failed.png' });
   assert.ok(selected, `${shape}: selection is available`);
   await page.waitForTimeout(500);
   if (process.env.BOUNDARY_ZOOM) {
    const span = () => page.locator('.room-handle.point').evaluateAll(es => {
     const xs = es.map(el => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; });
     return Math.max(...xs) - Math.min(...xs);
    });
    const before = await span();
    for (let k = 0; k < 3; k++) await page.locator('[data-editor-id="zoom-in"]').dispatchEvent('click');
    await page.waitForTimeout(500); assert.ok(await span() > before * 1.2, 'The close-up really zoomed the 3D geometry');
   }
   const part = await page.evaluate(kind => {
    const scene = window.boundaryEditor.scene();
    return kind === 'ceiling' ? scene.studio.ceilings.at(-1) : scene.studio.walls[0];
   }, kind);
   const plus = page.locator(`[data-room-handle="${kind}-split:${part.id}"]`);
   const centre = async locator => { const r = await locator.boundingBox(); assert.ok(r); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
   assert.equal(await page.locator('.room-handle.point').count(), kind === 'wall' ? 2 : part.profile.length, 'default controls match the original layout');
   assert.equal(await page.locator('[data-room-handle*="section:"]').count(), 0, 'uncut solids have no back-face handles');
   // Project the solid itself: the cursor must reach these edges without adding control dots there.
   const rings = await page.evaluate(async ({ kind, id }) => {
    const { surfaceSolid } = await import('/src/domain/studio/studio-solid-boundary.ts');
    const solid = surfaceSolid(window.boundaryEditor.scene().studio, kind, id), camera = window.boundaryCamera;
    camera.updateMatrixWorld(true);
    const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
    return solid.sections.map(s => s.outline.map(p => {
     const world = solid.world({ ...p, u: s.u }), q = new window.boundaryTHREE.Vector3(world.x, world.y, world.z).project(camera);
     return { x: r.x + (q.x + 1) * r.width / 2, y: r.y + (1 - q.y) * r.height / 2 };
    }));
   }, { kind, id: part.id });
   const origin = await centre(plus), dots = rings.at(-1), outer = dots[0], inner = rings[0][0], next = rings[0][1];
   assert.ok(Math.hypot(inner.x - outer.x, inner.y - outer.y) > .1, 'The return edge has a real depth projection');
   const dimensions = async locator => locator.evaluate(el => { const s = getComputedStyle(el); return [s.width, s.height]; });
   const size = await dimensions(plus); assert.equal(size[0], size[1]);
   if (kind === 'ceiling' && shape !== 'slope') assert.deepEqual(await dimensions(page.locator('.room-grip')), size);
   const snapshot = await page.evaluate(() => window.boundaryEditor.snapshot());
   await page.screenshot({ path: `/tmp/wardrobe-default-${shape}-${width}.png` });
   await plus.evaluate(el => el.dataset.testCursor = 'captured');
   const cdp = await page.context().newCDPSession(page);
   const start = async () => touch
    ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...await centre(plus), id: 1 }] })
    : (await page.mouse.move((await centre(plus)).x, (await centre(plus)).y), page.mouse.down());
   const move = async (a, b, count = 20) => {
    for (let n = 1; n <= count; n++) {
     const x = a.x + (b.x - a.x) * n / count, y = a.y + (b.y - a.y) * n / count;
     if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
     else await page.mouse.move(x, y);
     await page.waitForTimeout(18);
     const actual = await centre(plus);
     assert.ok(Math.hypot(actual.x - x, actual.y - y) < .25, `${shape}: 3D edge position ${n}: ${JSON.stringify({ actual, x, y })}`);
     assert.equal(await plus.getAttribute('data-test-cursor'), 'captured');
    }
   };
   await start();
   // First follow the existing outer outline to point 0, rather than cutting across the face.
   let edge = 0, distance = Infinity;
   dots.forEach((a, k) => {
    const b = dots[(k + 1) % dots.length], ux = b.x - a.x, uy = b.y - a.y;
    const f = Math.max(0, Math.min(1, ((origin.x - a.x) * ux + (origin.y - a.y) * uy) / (ux * ux + uy * uy)));
    const d = Math.hypot(origin.x - a.x - ux * f, origin.y - a.y - uy * f);
    if (d < distance) { distance = d; edge = k; }
   });
   let from = origin;
   for (let k = edge; k >= 0; k--) { await move(from, dots[k]); from = dots[k]; }
   await move(outer, inner); await move(inner, next); // Turn into depth, reach the inner corner, then continue on the inner rim.
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
   else { await plus.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up(); }
   assert.equal(await page.evaluate(() => window.boundaryEditor.snapshot()), snapshot);
   const restored = await centre(plus); assert.ok(Math.hypot(restored.x - origin.x, restored.y - origin.y) < .25);
   await start(); from = origin;
   for (let k = edge; k >= 0; k--) { await move(from, dots[k]); from = dots[k]; }
   await move(outer, inner);
   if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
   assert.equal(await page.locator('.room-handle.point').count(), kind === 'wall' ? 2 : part.profile.length, 'moving the plus does not add any black handles');
   assert.equal(await plus.evaluate(el => getComputedStyle(el).zIndex), '5');
   await page.screenshot({ path: `/tmp/wardrobe-inner-corner-${shape}-${width}${process.env.BOUNDARY_ZOOM ? '-zoom' : ''}.png` });
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px ${shape}: ${touch ? 'touch' : 'mouse'} turns through depth onto the wall-side inner corner and rim; cancellation restores the cursor; handle size ${size.join(' × ')}`);
   await page.evaluate(() => window.boundaryEditor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
