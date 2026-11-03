// All wall attachments measure their neighbours; utility symbols remain visible in front of a wardrobe.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const { buildFromSpec } = require('../src/application/spec/build-from-spec.ts');
const { projectToScene, sceneToProject } = require('../src/application/projects/editor-mapper.ts');
const { serializeProject } = require('../src/infrastructure/serialization/project-codec.ts');
const { addOpening, moveOpening } = require('../src/domain/studio/studio-edit.ts');
const { addFixture } = require('../src/domain/studio/fixtures/fixture-edit.ts');
const { WALL_UTILITIES } = require('../src/domain/studio/wall-utilities.ts');
const { FIXTURES } = require('../src/domain/studio/fixtures/fixture-kinds.ts');
const built = buildFromSpec({ specVersion: 1, room: { width: 600, depth: 400 },
  wardrobes: [{ against: 1, from: 114, width: 100, depth: 60, height: 180, autoDesign: false }] }, 'wall-items');
assert.ok(built.ok);
const scene = projectToScene(built.project);
for (const offset of [300, 170]) {
  scene.studio = addOpening(scene.studio, 'w1', WALL_UTILITIES[0].kind);
  scene.studio = moveOpening(scene.studio, scene.studio.openings.at(-1).id, offset);
}
scene.studio = addFixture(scene.studio, 'w1', FIXTURES[0].key, 400);
const gap = 400 - scene.studio.fixtures[0].width / 2 - (300 + scene.studio.openings[0].width / 2);
const packed = deflateRawSync(serializeProject(sceneToProject(built.project, scene))).toString('base64url');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const shots = path.join(__dirname, '../docs/verification/studio-wall-items');
(async () => {
  fs.mkdirSync(shots, { recursive: true });
  for (const [engine, type, widths] of [['chromium', chromium, [375, 1440]], ['webkit', webkit, [375]]]) {
    const browser = await type.launch({ headless: true });
    try { for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, isMobile: width === 375, hasTouch: width === 375 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('https://*.supabase.co/**', r => r.fulfill({ status: 400, body: '{}' }));
      await page.addInitScript(() => localStorage.setItem('wardrobeForge.lengthUnit', 'mm'));
      await page.goto(base + '/editor.html#design=' + packed);
      await page.locator('button[data-view-mode="studio"]').click();
      await page.locator('[data-studio-format="2d"]').click();
      const utility = page.locator('.sp2d-utility-marker').first(), hiddenUtility = page.locator('.sp2d-utility-marker').nth(1);
      const body = page.locator('.sp2d-furn-body');
      const tap = async locator => {
        const p = await locator.boundingBox(), x = p.x + p.width / 2, y = p.y + p.height / 2;
        if (width === 375) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      };
      const number = cm => page.locator('.sp2d-dimension-label .sp2d-dim-text').filter({ hasText: new RegExp(`^${Math.round(cm * 10)} mm$`) });
      const shot = async name => {
        await page.locator('.mobile-feedback').waitFor({ state: 'hidden', timeout: 15000 });
        await page.screenshot({ path: path.join(shots, `${engine}-${width}-${name}.png`) });
      };
      const marker = await hiddenUtility.locator('rect').boundingBox(), cabinet = await body.boundingBox();
      assert.ok(marker.width >= 19.9 && marker.width <= 22 && marker.height >= 19.9 && marker.height <= 22, 'readable marker: ' + JSON.stringify(marker));
      assert.ok(marker.y + marker.height < cabinet.y, 'utility behind wardrobe is drawn outside, not under the furniture');
      await tap(hiddenUtility.locator('rect'));
      assert.equal(await hiddenUtility.getAttribute('class').then(c => c.includes('selected')), true);
      await shot('utility-behind-wardrobe');
      await tap(utility.locator('rect'));
      await number(68).waitFor(); await number(gap).waitFor();
      await shot('utility-neighbours');
      await tap(body); await number(68).waitFor();
      await shot('wardrobe-neighbour');
      await tap(page.locator('.sp2d-fixture rect')); await number(gap).waitFor();
      await shot('fixture-neighbour');
      assert.deepEqual(errors, []);
      console.log('PASS', engine, width, 'utility/wardrobe/fixture neighbour gaps and visible utility behind furniture');
      await page.close();
    } } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
