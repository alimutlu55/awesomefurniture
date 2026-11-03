// Real touch input, SVG text rendering and toolbar-safe decorations. Run with node --import tsx.
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { buildFromSpec } = require('../src/application/spec/build-from-spec.ts');
const { projectToScene, sceneToProject } = require('../src/application/projects/editor-mapper.ts');
const { serializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const { addOpening, moveOpening } = require('../src/domain/studio/studio-edit.ts');
const { addFixture } = require('../src/domain/studio/fixtures/fixture-edit.ts');
const { WALL_UTILITIES } = require('../src/domain/studio/wall-utilities.ts');
const { FIXTURES } = require('../src/domain/studio/fixtures/fixture-kinds.ts');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = path.join(__dirname, '../docs/verification/studio-2d-mobile');
const built = buildFromSpec({ specVersion: 1, room: { width: 600, depth: 500, openings: [
  { wall: 2, kind: 'door', width: 80, height: 205, from: 220 }, { wall: 4, kind: 'window', width: 140, height: 100, from: 200 },
] }, wardrobes: [{ against: 1, width: 140, height: 180, autoDesign: false }] }, 'mobile-studio');
assert.ok(built.ok);
const scene = projectToScene(built.project);
scene.studio = addOpening(scene.studio, 'w1', WALL_UTILITIES[0].kind);
scene.studio = moveOpening(scene.studio, scene.studio.openings.at(-1).id, 500);
scene.studio = addFixture(scene.studio, 'w3', FIXTURES[0].key, 200);
const packed = deflateRawSync(serializeProject(sceneToProject(built.project, scene))).toString('base64url');
(async () => {
  fs.mkdirSync(shots, { recursive: true });
  for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]].filter(([name]) => !process.env.STUDIO_ENGINE || name === process.env.STUDIO_ENGINE)) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('https://*.supabase.co/**', r => r.fulfill({ status: 400, body: '{}' }));
      await page.addInitScript(() => localStorage.setItem('wardrobeForge.lengthUnit', 'mm'));
      await page.goto(base + '/editor.html#design=' + packed);
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      await page.waitForTimeout(300);
      const shot = async name => {
        await page.locator('.mobile-feedback').waitFor({ state: 'hidden', timeout: 15000 });
        return page.screenshot({ path: path.join(shots, `${engine}-${name}.png`) });
      };
      const point = locator => locator.evaluate(el => {
        const r = el.getBBox(), m = el.getScreenCTM();
        return { x: m.a * (r.x + r.width / 2) + m.c * (r.y + r.height / 2) + m.e,
          y: m.b * (r.x + r.width / 2) + m.d * (r.y + r.height / 2) + m.f,
          width: r.width * Math.hypot(m.a, m.b) };
      });
      const undo = () => page.locator('[data-editor-id="undo2"] small').textContent().then(t => Number(t || 0));
      const cdp = engine === 'chromium' ? await page.context().newCDPSession(page) : null;
      const drag = async (from, to, cancel = false) => {
        if (cdp) {
          const finger = p => [{ x: p.x, y: p.y, id: 1 }];
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger(from) });
          for (let n = 1; n <= 8; n++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger({ x: from.x + (to.x - from.x) * n / 8, y: from.y + (to.y - from.y) * n / 8 }) });
          }
          await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        } else {
          await page.mouse.move(from.x, from.y); await page.mouse.down();
          await page.mouse.move(to.x, to.y, { steps: 8 });
          if (cancel) await page.keyboard.press('Escape');
          await page.mouse.up();
        }
        await page.waitForTimeout(100);
      };
      const scaleClear = async () => {
        const scale = await page.locator('.sp2d-scale-bar').boundingBox();
        const toolbar = await page.locator('[data-editor-id="toolbar"]').boundingBox();
        assert.ok(scale.y > 0 && scale.y + scale.height <= toolbar.y - 12, 'scale clears the actual toolbar');
        assert.ok(scale.x >= 0 && scale.x + scale.width <= 375, 'scale is within the phone viewport');
        assert.ok(await page.locator('.sp2d-scale-line').evaluate(e => +e.getAttribute('x2')) >= 40);
      };
      await scaleClear(); await shot('overview');
      // Miss the thin window by 18 px, and grab off-centre: no wall drag or recentering jump.
      const window = page.locator('.sp2d-window-glass'), original = await point(window), count = await undo();
      const grab = { x: original.x + 18, y: original.y - 10 };
      await page.touchscreen.tap(grab.x, grab.y);
      assert.equal(await page.locator('.sp2d-window.selected').count(), 1, 'nearby touch selects window');
      await drag(grab, { x: grab.x, y: grab.y - 24 });
      const moved = await point(window);
      assert.ok(Math.abs(moved.y - original.y + 24) < 1.5, 'window follows travel without jumping to finger');
      assert.equal(await undo(), count + 1, 'one checkpoint per touch drag');
      await page.locator('[data-editor-id="undo2"]').tap();
      assert.ok(Math.abs((await point(window)).y - original.y) < 1);
      // A utility's actual mark is only a few pixels wide at this zoom.
      const utility = page.locator('.sp2d-util-box'), u = await point(utility);
      await drag({ x: u.x, y: u.y + 18 }, { x: u.x + 20, y: u.y + 18 });
      assert.equal(await page.locator('.sp2d-utility.selected').count(), 1);
      assert.ok(Math.abs((await point(utility)).x - u.x - 20) < 1.5);
      // A tap inside the swing, away from the leaf and arc, chooses the door.
      const hinge = await point(page.locator('.sp2d-door-hinge')), leaf = await point(page.locator('.sp2d-door-leaf'));
      const doorGrab = { x: leaf.x, y: hinge.y + 10 };
      await page.touchscreen.tap(doorGrab.x, doorGrab.y);
      assert.equal(await page.locator('.sp2d-door.selected').count(), 1);
      await drag(doorGrab, { x: doorGrab.x, y: doorGrab.y + 20 });
      assert.ok(Math.abs((await point(page.locator('.sp2d-door-hinge'))).y - hinge.y - 20) < 1.5);
      const texts = page.locator('.sp2d-dimension-label .sp2d-dim-text');
      assert.ok(await texts.evaluateAll(es => es.every(e => getComputedStyle(e).stroke === 'none'
        && e.previousElementSibling?.classList.contains('sp2d-text-halo') && e.previousElementSibling.textContent === e.textContent)));
      await scaleClear(); await shot('door-numbers');
      const fixture = page.locator('.sp2d-fixture rect'), f = await point(fixture), beforeCancel = await undo();
      const fixtureGrab = { x: f.x + f.width / 2 + 18, y: f.y };
      await drag(fixtureGrab, { x: fixtureGrab.x - 20, y: fixtureGrab.y });
      assert.equal(await page.locator('.sp2d-fixture.selected').count(), 1);
      assert.ok(Math.abs((await point(fixture)).x - f.x + 20) < 1.5);
      assert.equal(await undo(), beforeCancel + 1);
      const start = await point(fixture), cancelCount = await undo();
      await drag(start, { x: start.x - 20, y: start.y }, true);
      assert.ok(Math.abs((await point(fixture)).x - start.x) < 1, 'cancelling restores fixture pose');
      assert.equal(await undo(), cancelCount);
      await shot('fixture-drag');
      for (const height of [667, 500, 812]) {
        await page.setViewportSize({ width: 375, height }); await page.waitForTimeout(150); await scaleClear();
      }
      await page.mouse.move(187, 400);
      for (let i = 0; i < 4; i++) {
        if (engine === 'webkit') await page.locator('.sp2d-svg').dispatchEvent('wheel', { deltaY: -100, clientX: 187, clientY: 400, bubbles: true, cancelable: true });
        else await page.mouse.wheel(0, -100);
        await page.waitForTimeout(50); await scaleClear();
      }
      await shot('zoomed');
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine}: separate halo/fill, toolbar-safe scale, window/door/utility/fixture targeting and dragging, undo/cancel`);
      await page.close();
    } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
