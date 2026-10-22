// Requires the Vite dev server. Check the actual renderer camera across wall and ceiling taps.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  const widths = [375, 1440].filter(w => !process.env.CAMERA_WIDTH || w === Number(process.env.CAMERA_WIDTH));
  const surfaces = ['wall', 'ceiling'].filter(k => !process.env.CAMERA_SURFACE || k === process.env.CAMERA_SURFACE);
  for (const width of widths) for (const kind of surfaces) {
   const touch = width === 375;
   const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/wall-camera-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/wall-camera-fixture');
   await page.evaluate(async kind => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { rectangleStudio } = await import('/src/domain/studio/studio-templates.ts');
    const { addCeiling } = await import('/src/domain/studio/studio-ceiling.ts');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera, editor;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     studio: kind === 'ceiling' ? addCeiling(rectangleStudio(400, 240), 'w1', 'box') : rectangleStudio(400, 240),
     wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 30, angle: 0, state: { ...createEditorState(), w: 160 } }],
     activeWardrobe: 1, nextWardrobeId: 2,
    } }); } finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    window.wallCameraFixture = { editor, camera, THREE };
   }, kind);
   await page.locator('[data-view-mode="studio"]').click();
   await page.waitForTimeout(500);
   const pose = () => page.evaluate(() => {
    const { camera } = window.wallCameraFixture;
    return [...camera.position.toArray(), ...camera.quaternion.toArray(), ...camera.projectionMatrix.elements];
   });
   const zoom = async () => {
    await page.locator('[data-editor-id="zoom-in"]').dispatchEvent('click');
    await page.waitForTimeout(300);
   };
   const initial = await pose();
   for (let n = 0; n < (kind === 'ceiling' && !touch ? 1 : 3); n++) await zoom();
   assert.notDeepEqual(await pose(), initial, 'the camera actually zoomed in before selection');
   // Orbit in empty canvas space, then tap the surface from this custom view.
   await page.mouse.move(35, 150); await page.mouse.down();
   await page.mouse.move(80, kind === 'ceiling' ? 85 : 160, { steps: 12 }); await page.mouse.up();
   await page.waitForTimeout(300);
   for (const repeat of [false, true]) {
    if (repeat) await zoom();
    const before = await pose();
    const point = await page.evaluate(kind => {
     const { camera, THREE } = window.wallCameraFixture;
     const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
     camera.updateMatrixWorld(true);
     const p = new THREE.Vector3(...(kind === 'ceiling' ? [0, 240, 60] : [-100, 130, 0])).project(camera);
     return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
    }, kind);
    assert.ok(point.x > 0 && point.x < width && point.y > 80 && point.y < 750, `${kind} tap is on screen: ${JSON.stringify(point)}`);
    if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `/tmp/${kind}-camera-preserved-${width}.png` });
    assert.equal(await page.locator('[data-editor-id="toolbar"]').getAttribute('data-context'), kind);
    const after = await pose();
    before.forEach((value, i) => assert.ok(Math.abs(value - after[i]) < 1e-7, `${width}px ${repeat ? 'repeat' : 'first'} ${kind} tap moved camera component ${i}`));
   }
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: first and repeat ${kind} taps preserve the zoomed, orbited renderer camera`);
   await page.evaluate(() => window.wallCameraFixture.editor.dispose());
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
