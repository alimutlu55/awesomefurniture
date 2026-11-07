// Moving a wardrobe next to another: it catches side by side and fronts in line, the guides show only that, and
// it lands exactly there, even when the finger drifts as it lifts.
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
   await page.route(base + '/move-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor"></div></body></html>' }));
   await page.goto(base + '/move-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), original = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    let camera;
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () { original.call(this); camera = this; };
    const a = { ...createEditorState(), w: 100, h: 230, d: 60, n: 1 }, b = { ...createEditorState(), w: 100, h: 200, d: 60, n: 1 };
    let editor;
    try { editor = mountEditor({ root: document.querySelector('#editor'), initialScene: {
     wardrobes: [{ id: 1, name: 'A', x: 0, y: 0, z: 0, angle: 0, state: a }, { id: 2, name: 'B', x: 150, y: 0, z: 2.6, angle: 0, state: b }],
     activeWardrobe: 2, nextWardrobeId: 3 } }); }
    finally { THREE.PerspectiveCamera.prototype.updateProjectionMatrix = original; }
    window.fx = { editor, camera, THREE };
   });
   await page.locator('#editor').locator('canvas').waitFor(); await page.waitForTimeout(800);
   const pose = () => page.evaluate(() => { const w = window.fx.editor.scene().wardrobes[1]; return { x: w.x, z: w.z }; });
   const project = p => page.evaluate(p => {
    const { camera, THREE } = window.fx, r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
    camera.updateMatrixWorld(true); const q = new THREE.Vector3(...p).project(camera);
    return { x: r.x + (q.x + 1) * r.width / 2, y: r.y + (1 - q.y) * r.height / 2 };
   }, p);
   const guides = () => page.evaluate(() => {
    const l = document.querySelector('#editor').shadowRoot.querySelector('[data-smart-guides]');
    return l && !l.hidden ? Number(l.dataset.guideCount) : 0;
   });
   const cdp = await page.context().newCDPSession(page);
   const drag = async (from, to, during) => {
    const a = await project(from), b = await project(to);
    if (mobile) {
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
     for (let n = 1; n <= 20; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * n / 20, y: a.y + (b.y - a.y) * n / 20, id: 1 }] });
     await page.waitForTimeout(150); if (during) await during();
     // A finger lifting drifts a few pixels.
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + 3, y: b.y - 2, id: 1 }] });
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
     await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 20 });
     await page.waitForTimeout(150); if (during) await during();
     await page.mouse.move(b.x + 2, b.y - 1); await page.mouse.up();
    }
    await page.waitForTimeout(250);
   };
   // B stands 12 cm right of A, 2.6 cm forward. Drag it to about 1.5 cm short of touching, fronts 2.6 cm out.
   const grip = [199, 60, 32.4];
   { const q = await project(grip); if (mobile) await page.touchscreen.tap(q.x, q.y); else await page.mouse.click(q.x, q.y); }
   await page.waitForTimeout(1500);
   let during = 0;
   await drag(grip, [150.5, 60, 32.4], async () => {
    during = await guides();
    await page.screenshot({ path: `${shots}/wardrobe-move-${width}.png` });
   });
   const p = await pose();
   console.log(width, 'landed', JSON.stringify(p), 'guides during', during);
   assert.ok(Math.abs(p.x - 100) < .01, 'lands side by side, touching: x=' + p.x);
   assert.ok(Math.abs(p.z) < .01, 'fronts land in line: z=' + p.z);
   assert.ok(during >= 1 && during <= 2, 'only the alignments that hold are drawn: ' + during);
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px: a wardrobe moved next to another lands touching with fronts in line`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
