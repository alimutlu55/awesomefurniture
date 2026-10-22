const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const [width, height] of [[375, 812], [844, 390], [1440, 900]]) for (const kind of ['wardrobe', 'drawers', 'slope']) {
   const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, isMobile: width <= 900, reducedMotion: 'reduce' });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/size-drawer-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/size-drawer-fixture');
   await page.evaluate(async kind => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
    const { rectangleStudio } = await import('/src/domain/studio/studio-templates.ts');
    const { createSceneCommands } = await import('/src/application/commands/scene-commands.ts');
    const state = kind === 'drawers' ? { ...createEditorState(), ...createKitchenDesign('base', 'drawers') } : { ...createEditorState(), n: 1, w: 200 };
    const scene = { wardrobes: [{ id: 1, name: kind, x: 0, y: 0, z: 30, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
    if (kind === 'wardrobe') scene.studio = rectangleStudio(218.2, 60.8, 250);
    if (kind === 'drawers') scene.wardrobes.push(...[-1, 1].map((side, i) => ({ id: i + 2, name: 'Neighbor',
     x: side * (state.w / 2 + 50.4), y: 0, z: 30, angle: 0, state: { ...createEditorState(), w: 100 } })));
    if (kind === 'slope') {
     scene.studio = rectangleStudio(400, 160, 300);
     scene.wardrobes[0].x = -100;
     scene.studio.ceilings = [{ id: 'k1', wall: 'w1', run: 'across', depth: 160,
      profile: [{ t: 0, y: 100 }, { t: 160, y: 260 }] }];
     createSceneCommands(() => scene).followCeilings();
    }
    window.sizeEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
    const root = document.querySelector('#editor').shadowRoot;
    root.querySelector('[data-editor-id="left"]').dataset.contextSection = 'resize';
    root.querySelector('[data-editor-id="app"]').classList.add('props-open');
   }, kind);
   const el = id => page.locator(`[data-editor-id="${id}"]`);
   const cdp = await page.context().newCDPSession(page);
   const read = axis => page.evaluate(axis => {
    const root = document.querySelector('#editor').shadowRoot;
    const range = root.querySelector(`[data-dimension="${axis}"]`), number = root.querySelector(`[data-editor-id="${axis}"]`);
    return { min: Number(range.min), max: Number(range.max), value: Number(range.value), number: Number(number.value),
     actual: window.sizeEditor.scene().wardrobes[0].state[axis] };
   }, axis);
   for (const axis of ['w', 'h', 'd']) {
    const range = el(axis + '-range'); await range.scrollIntoViewIfNeeded();
    const before = await read(axis);
    assert.ok(before.value >= before.min && before.value <= before.max, `${kind} ${axis}: current size is on the track`);
    const box = await range.boundingBox(), y = box.y + box.height / 2;
    const x = box.x + 10 + (box.width - 20) * (before.value - before.min) / (before.max - before.min || 1);
    const start = async () => width <= 900
     ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
     : (await page.mouse.move(x, y), page.mouse.down());
    const move = async fraction => {
     const to = box.x + 2 + (box.width - 4) * fraction;
     if (width <= 900) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to, y: y + 3, id: 1 }] });
     else await page.mouse.move(to, y, { steps: 4 });
     await page.waitForTimeout(60);
     const now = await read(axis);
     assert.ok(Math.abs(now.value - now.actual) < .11 && Math.abs(now.number - now.actual) < .01, `${kind} ${axis}: thumb, number and geometry agree`);
     assert.equal(now.min, before.min); assert.equal(now.max, before.max);
     return now;
    };
    await start();
    await move(.2); const right = await move(1); await move(.5); await move(1);
    assert.ok(Math.abs(right.actual - before.max) < .11, `${kind} ${axis}: the full track reaches its valid boundary`);
    if (width <= 900) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
    await page.waitForTimeout(80);
   }
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}x${height} ${kind}: native Size drawer sliders remain responsive and synchronized through reversals and geometric boundaries`);
   await page.evaluate(() => window.sizeEditor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
