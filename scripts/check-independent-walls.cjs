// Run against STUDIO_URL (default http://127.0.0.1:5174). Uses the real editor and pointer controls.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 375, 812]].filter(x => !process.env.STUDIO_DEVICE || x[0] === process.env.STUDIO_DEVICE)) {
      const phone = name === 'phone';
      const page = await browser.newPage({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto((process.env.STUDIO_URL || 'http://127.0.0.1:5174') + '/editor.html');
      await page.locator('[data-editor-id="walls-btn"]').waitFor();
      await page.evaluate(async () => {
        const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
        const { createEditorState } = await import('/src/application/projects/editor-state.ts');
        const { createStudio } = await import('/src/domain/studio/studio-templates.ts');
        const { translateStudio } = await import('/src/domain/studio/studio-edit.ts');
        const root = document.createElement('div');
        root.style.cssText = 'position:absolute;inset:0';
        document.getElementById('editor-root').replaceWith(root);
        window.solidRoot = root;
        window.solidEditor = mountEditor({ root, initialScene: {
          wardrobes: [{ id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() }],
          activeWardrobe: 1, nextWardrobeId: 2, studio: translateStudio(createStudio('wall'), 0, -30),
        } });
      });
      const snapshot = () => page.evaluate(() => JSON.parse(window.solidEditor.snapshot()));
      const el = id => page.locator('[data-editor-id="' + id + '"]');
      const tap = async locator => { phone ? await locator.tap() : await locator.click(); await page.waitForTimeout(200); };
      await page.waitForTimeout(800);
      const before = await snapshot();
      await tap(el('walls-btn'));
      await tap(page.locator(phone ? '.mobile-add-products [data-add-room="wall"]' : '[data-editor-id="padd-room"] [data-add-room="wall"]'));
      assert.equal(await el('toolbar').getAttribute('data-context'), 'wall');
      const added = await snapshot(), wall = added.studio.walls.at(-1);
      assert.equal(wall.independent, true);
      assert.equal(added.studio.walls.length, 2);
      assert.deepEqual(added.studio.walls[0], before.studio.walls[0]);
      assert.deepEqual(added.studio.corners.slice(0, 2), before.studio.corners);
      assert.ok([wall.a, wall.b].every(id => !before.studio.corners.some(c => c.id === id)));
      assert.equal(await page.locator('.room-handle.split-handle').count(), 0, 'independent walls have no attached extension grips');
      assert.equal(await page.locator('.room-rotate').count(), 1);
      assert.equal(await page.locator('.room-axis').count(), 3);

      // Drag rotation and undo it; the original wall remains unchanged.
      const rotate = await page.locator('.room-rotate').boundingBox();
      await page.mouse.move(rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(rotate.x + rotate.width / 2 + i * 5, rotate.y + rotate.height / 2);
      await page.mouse.up();
      const turned = await snapshot();
      assert.notDeepEqual(turned.studio.corners.slice(2), added.studio.corners.slice(2), 'rotation drag changes this wall');
      assert.deepEqual(turned.studio.corners.slice(0, 2), before.studio.corners);
      await page.keyboard.press('ControlOrMeta+z');
      assert.deepEqual((await snapshot()).studio, added.studio);
      // Undo focuses the wardrobe. Redo retains the test wall's known geometry; reselect its box by its grip location.
      // A fresh editor with the same scene and a click on the wall gives stable selection without moving its camera.
      await page.evaluate(async scene => {
        const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
        window.solidEditor.dispose();
        const root = window.solidRoot;
        window.solidEditor = mountEditor({ root, initialScene: scene });
      }, added);
      await page.waitForTimeout(800);
      // Add one more independent wall through the catalogue; it is selected immediately.
      await tap(el('walls-btn'));
      await tap(page.locator(phone ? '.mobile-add-products [data-add-room="wall"]' : '[data-editor-id="padd-room"] [data-add-room="wall"]'));
      const all = await snapshot(), current = all.studio.walls.at(-1), others = all.studio.walls.slice(0, -1);
      assert.equal(await page.locator('.room-face').count(), 6);
      assert.equal(await page.locator('[data-room-ceiling]').count(), 0);
      const face = (dimension, side) => page.locator('.room-face[data-dimension="' + dimension + '"][data-side="' + side + '"]');
      await page.evaluate(() => { window.wallPointerEvents = []; for (const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) window.solidRoot.shadowRoot.addEventListener(type, e => { if (e.target.closest('.room-handle')) window.wallPointerEvents.push({ type, x:e.clientX,y:e.clientY,id:e.pointerId,button:e.button,kind:e.pointerType,handle:e.target.closest('.room-handle').outerHTML.slice(0,180) }); }, true); });
      const session = await page.context().newCDPSession(page);
      const drag = async (locator, pixels) => {
        const box = await locator.boundingBox();
        assert.ok(box, 'handle is visible');
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const direction = await locator.locator('.mv-ic').evaluate(el => {
          const m = new DOMMatrix(getComputedStyle(el).transform); return { x: m.a, y: m.b };
        });
        const hit = await locator.evaluate((el, p) => { const hit = el.getRootNode().elementFromPoint(p.x, p.y); return { ok: hit?.closest('.room-handle') === el, styles: {pe:getComputedStyle(el).pointerEvents, z:getComputedStyle(el).zIndex}, stack:el.getRootNode().elementsFromPoint(p.x,p.y).slice(0,6).map(x=>x.outerHTML.slice(0,100)), hit: hit?.outerHTML.slice(0, 300), target: el.outerHTML.slice(0, 250) }; }, { x, y });
        if (!hit.ok) { await page.screenshot({ path: '/tmp/wall-handle-failure-' + name + '.png' }); console.log({ x, y, ...hit }); }
        assert.equal(hit.ok, true, 'handle can be grabbed without another target covering it');
        if (phone) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        else { await page.mouse.move(x, y); await page.mouse.down(); }
        for (let i = 1; i <= 12; i++) {
          const point = { x: x + direction.x * pixels * i / 12, y: y + direction.y * pixels * i / 12 };
          if (phone) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
          else await page.mouse.move(point.x, point.y);
        }
        if (phone) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.mouse.up();
        await page.waitForTimeout(150);
      };
      const selected = async () => (await snapshot()).studio.walls.find(w => w.id === current.id);
      for (const axis of ['x', 'y', 'z']) {
        const start = await snapshot();
        await drag(page.locator('.room-axis[data-axis="' + axis + '"]'), 30);
        const after = await snapshot();
        assert.notDeepEqual(after.studio, start.studio, axis + ' movement responds to dragging');
        assert.deepEqual(after.studio.walls.slice(0, -1), others);
        assert.deepEqual(after.wardrobes, before.wardrobes);
      }
      for (const dimension of ['length', 'height', 'depth']) for (const side of [-1, 1]) {
        const handle = face(dimension, side);
        if (phone) assert.ok((await handle.boundingBox()).width >= 44);
        const start = await snapshot();
        await drag(handle, 35);
        const after = await snapshot();
        const size = scene => { const w = scene.studio.walls.at(-1); if (dimension === 'height') return w.height; if (dimension === 'depth') return w.thickness; const a = scene.studio.corners.find(c => c.id === w.a), b = scene.studio.corners.find(c => c.id === w.b); return Math.hypot(b.x-a.x,b.z-a.z); };
        if (!(size(after) > size(start) + 1)) { console.log({ dimension, side, before:size(start), after:size(after), events:await page.evaluate(()=>window.wallPointerEvents), reason:await page.locator('.shape-reason').allTextContents() }); await page.screenshot({path:'/tmp/wall-touch-failure.png'}); }
        assert.ok(size(after) > size(start) + 1, dimension + ' face expands the chosen dimension');
        assert.deepEqual(after.studio.walls.slice(0, -1), others);
        assert.deepEqual(after.wardrobes, before.wardrobes);
      }
      // Shape a slab entirely with face dragging, then lift it with the existing direction arrow.
      for (let i = 0; i < 12 && (await selected()).height > 1.01; i++) await drag(face('height', 1), -100);
      assert.ok((await selected()).height <= 1.01, 'top face can be pulled down to a thin slab');
      const depth = (await selected()).thickness;
      await drag(face('depth', 1), 60);
      assert.ok((await selected()).thickness > depth);
      await drag(page.locator('.room-axis[data-axis="y"]'), 50);
      assert.ok((await selected()).y > 0, 'whole slab lifts with the same Y direction arrow');
      for (const dimension of ['length', 'height', 'depth']) for (const side of [-1, 1]) {
        const handle = face(dimension, side), box = await handle.boundingBox();
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        assert.equal(await handle.evaluate((el, p) => el.getRootNode().elementFromPoint(p.x,p.y)?.closest('.room-handle') === el, point), true, 'thin slab face remains independently touchable');
      }
      await page.screenshot({ path: path.join(process.env.STUDIO_SHOTS || '/tmp/independent-walls-shots', 'direct-slab-' + name + '.png') });
      assert.deepEqual(errors, []);
      console.log('direct wall face shaping, movement, rotation and slab: ' + name + ' ok');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
