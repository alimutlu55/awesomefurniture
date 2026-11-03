const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = path.join(__dirname, '..', 'docs/verification/studio-2d');
(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of (process.env.STUDIO_WIDTHS || '1440,375').split(',').map(Number)) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 375 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const spec = { specVersion: 1, room: { width: 600, depth: 500 }, wardrobes: [{ width: 140, height: 180, autoDesign: false, against: 1 }] };
      await page.goto(base + '/editor.html#spec=' + encodeURIComponent(JSON.stringify(spec)));
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      await page.waitForTimeout(500);
      const shot = name => page.screenshot({ path: path.join(shots, `${name}-${width}.png`) });
      const tap = async locator => {
        const p = await locator.evaluate(el => {
          if (!el.points) { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
          const points = [...el.points], m = el.getScreenCTM();
          const x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length;
          return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
        });
        await page.mouse.click(p.x, p.y); await page.waitForTimeout(300);
      };
      await tap(page.locator('.sp2d-furn-body').first());
      console.log(width, 'furniture', await page.locator('.sp2d-furniture-item').first().getAttribute('class'), 'errors', errors);
      await shot('wardrobe-clearances');
      assert.equal(await page.locator('.sp2d-furniture-item.active').count(), 1);
      assert.ok(await page.locator('[data-label-id^="clearance-"]').count() >= 2);
      const undo = () => page.locator('[data-editor-id="undo2"] small').textContent().then(t => Number(t || 0));
      const before = await undo();
      await page.keyboard.press('r'); await page.waitForTimeout(300);
      await shot('wardrobe-90');
      assert.equal(await undo(), before + 1);
      const angle = () => page.locator('.sp2d-furn-front').first().evaluate(el => {
        const dx = +el.getAttribute('x2') - +el.getAttribute('x1'), dz = +el.getAttribute('y2') - +el.getAttribute('y1');
        return (Math.atan2(-dz, dx) * 180 / Math.PI + 360) % 360;
      });
      assert.equal(Math.round(await angle()), 90);
      const rotate = async (delta, cancel = false) => {
        const h = await page.locator('.sp2d-rotate-disc').boundingBox();
        const centre = await page.locator('.sp2d-furn-body').evaluate(el => {
          const points = [...el.points], m = el.getScreenCTM();
          return { x: m.e + m.a * points.reduce((s, p) => s + p.x, 0) / points.length,
            y: m.f + m.d * points.reduce((s, p) => s + p.y, 0) / points.length };
        });
        const x = h.x + h.width / 2, y = h.y + h.height / 2, dx = x - centre.x, dy = y - centre.y, a = delta * Math.PI / 180;
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(centre.x + dx * Math.cos(a) + dy * Math.sin(a), centre.y - dx * Math.sin(a) + dy * Math.cos(a), { steps: 10 });
        if (cancel) await page.keyboard.press('Escape');
        await page.mouse.up(); await page.waitForTimeout(300);
      };
      await rotate(-45);
      assert.equal(Math.round(await angle()), 45);
      assert.equal(await undo(), before + 2);
      await shot('wardrobe-45');
      await rotate(35, true);
      assert.equal(Math.round(await angle()), 45);
      assert.equal(await undo(), before + 2);
      await tap(page.locator('.sp2d-wall-poly[data-wall-id="w3"]'));
      await shot('wall-chain');
      // Add the L-shaped room through the same room picker used on both layouts.
      await page.keyboard.press('Escape');
      await page.locator('.contextual-actions [data-action="new"]:visible').click();
      await page.locator('[data-studio="l-shaped"]:visible').click();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.sp2d-room-fill').count(), 2);
      await shot('two-rooms');
      if (width === 375) {
        const room = await page.locator('.sp2d-room-fill').nth(1).boundingBox();
        await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2);
        for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(50); }
        const zoomed = await page.locator('.sp2d-room-fill').nth(1).boundingBox();
        await page.mouse.move(190, 700); await page.mouse.down();
        await page.mouse.move(190 + width / 2 - zoomed.x - zoomed.width / 2, 700, { steps: 10 });
        await page.mouse.up(); await page.waitForTimeout(100);
      }
      const wall = page.locator('.sp2d-wall-poly').nth(5);
      await tap(wall);
      await shot('wall-chain');
      assert.ok(await page.locator('[data-label-id^="chain-"]').count());
      const door = page.locator('.sp2d-door-leaf').first();
      await tap(door);
      await shot('door-clearances');
      assert.ok(await page.locator('[data-label-id^="chain-"]').count());
      await page.keyboard.press('Escape');
      await page.locator('.contextual-actions [data-action="new"]:visible').click();
      await page.locator('.mobile-add-categories [data-category="fixtures"]').click();
      await page.locator('[data-add-fixture]:visible').first().click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('.sp2d-fixture').count());
      await tap(page.locator('.sp2d-fixture').first());
      assert.ok(await page.locator('.sp2d-fixture.selected').count());
      assert.ok(await page.locator('[data-label-id^="clearance-"]').count());
      await shot('fixture-clearances');
      assert.deepEqual(errors, []);
      console.log('PASS', width, 'rooms, clearances, rotation, undo, cancel');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
