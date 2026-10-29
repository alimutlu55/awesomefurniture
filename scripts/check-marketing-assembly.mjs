import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.ASSEMBLY_URL ?? 'http://127.0.0.1:5173/';
const output = 'output/assembly-study';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.assemblyDraws = 0;
    for (const api of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const draw = api.prototype.drawElements;
      api.prototype.drawElements = function (...args) { window.assemblyDraws++; return draw.apply(this, args); };
    }
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#study-canvas')?.dataset.ready === 'true');
  const slider = page.locator('#study-assembly');
  assert.equal(await slider.inputValue(), '0');
  assert.equal(await page.locator('.assembly-percent').textContent(), '0%');
  await page.locator('.fitting-room').screenshot({ path: `${output}/initial-zero.png` });
  await slider.focus(); await page.keyboard.press('Home');
  assert.equal(await slider.inputValue(), '0');
  await page.locator('.assembly-stage').screenshot({ path: `${output}/01-pieces.png` });
  await slider.press('End'); assert.equal(await slider.inputValue(), '100');
  await page.locator('.assembly-stage').screenshot({ path: `${output}/03-assembled.png` });
  await slider.press('ArrowLeft'); assert.equal(await slider.inputValue(), '99');
  await slider.fill('50');
  await page.locator('.assembly-stage').screenshot({ path: `${output}/02-exploded.png` });
  checks.push('Compact slider supports scrubbing and keyboard endpoints');

  for (const shape of ['regular', 'alcove', 'under-stairs']) {
    await page.locator(`button[data-shape="${shape}"]`).click();
    for (const width of [140, 320]) {
      await page.locator('#study-width').fill(String(width));
      assert.equal(await page.locator('#width-output').textContent(), String(width));
      assert.equal(await page.locator('#width-output').getAttribute('aria-label'), `${width} cm`);
      const href = await page.locator('#study-start').getAttribute('href');
      const spec = JSON.parse(decodeURIComponent(href.split('#spec=')[1]));
      assert.equal(spec.wardrobes[0].width, width); assert.equal(spec.wardrobes[0].shape, shape);
      for (const value of ['0', '25', '50', '75', '100']) await slider.fill(value);
    }
  }
  await page.locator('#study-units').selectOption('in');
  assert.equal(await page.locator('#width-output').textContent(), '126');
  assert.equal(await page.locator('#width-output').getAttribute('aria-label'), '126 in');
  checks.push('All shapes and width extremes render; dimensions and shape carry into the editor');

  await page.locator('button[data-shape="regular"]').click();
  await page.locator('#study-width').fill('240');
  await page.locator('#study-units').selectOption('cm');
  const materials = [];
  for (const finish of ['oak', 'smoked', 'chalk']) {
    await page.locator(`button[data-finish="${finish}"]`).click();
    materials.push(await page.locator('.assembly-stage').screenshot());
  }
  assert.notDeepEqual(materials[0], materials[1]); assert.notDeepEqual(materials[1], materials[2]);
  await page.locator('button[data-view="drawing"]').click();
  assert.equal(await page.locator('#study-canvas').getAttribute('data-projection'), 'orthographic');
  await page.locator('.assembly-drawing').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.assembly-drawing text').first().textContent(), '240 cm');
  await page.locator('#study-width').fill('320');
  await page.waitForFunction(() => document.querySelector('.assembly-drawing text')?.textContent === '320 cm');
  await page.locator('#study-units').selectOption('in');
  await page.waitForFunction(() => document.querySelector('.assembly-drawing text')?.textContent === '126 in');
  await page.locator('#study-units').selectOption('cm');
  await page.locator('#study-width').fill('240');
  for (const shape of ['regular', 'alcove', 'under-stairs']) {
    await page.locator(`button[data-shape="${shape}"]`).click();
    await slider.fill('100');
    await page.locator('.assembly-stage').screenshot({ path: `${output}/drawing-${shape}.png` });
    assert.equal(await page.locator('.assembly-drawing text').count(), 2);
  }
  await page.locator('.assembly-stage').screenshot({ path: `${output}/04-drawing.png` });
  await page.locator('button[data-view="material"]').click();
  assert.equal(await page.locator('#study-canvas').getAttribute('data-projection'), 'perspective');
  await page.locator('.assembly-drawing').waitFor({ state: 'hidden' });
  await page.locator('button[data-finish="oak"]').click();
  checks.push('Drawing uses orthographic linework and live dimensions in cm/in for every shape; material rendering restores correctly');

  // Regression: reaching 100% used to schedule a different, blurry shadow pipeline after 220 ms.
  await page.locator('button[data-shape="under-stairs"]').click();
  for (const view of ['material', 'drawing']) {
    await page.locator(`button[data-view="${view}"]`).click();
    await slider.fill('100');
    const rendered = await page.evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.assemblyDraws)));
    }));
    const finished = await page.locator('.assembly-webgl').screenshot();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.assemblyDraws), rendered, `${view}: no deferred shading pass`);
    assert.deepEqual(await page.locator('.assembly-webgl').screenshot(), finished, `${view}: the finished frame stays crisp`);
    assert.equal(await page.locator('.fitting-room').getAttribute('data-view'), view);
    await page.locator('.assembly-stage').screenshot({ path: `${output}/finished-${view}.png` });
  }
  await page.locator('button[data-view="material"]').click();
  await page.locator('button[data-shape="regular"]').click();
  checks.push('The completed material and drawing views stay identical after settling; no delayed blurry shadows');

  await page.waitForTimeout(300);
  const still = await page.evaluate(() => window.assemblyDraws);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.assemblyDraws), still);
  await page.locator('.assembly-play').click();
  await page.waitForFunction(() => {
    const value = Number(document.querySelector('#study-assembly').value); return value > 0 && value < 100;
  });
  assert.ok(Number(await slider.inputValue()) > 0 && Number(await slider.inputValue()) < 100);
  await page.locator('.assembly-play').click();
  const paused = await slider.inputValue(); await page.waitForTimeout(150);
  assert.equal(await slider.inputValue(), paused);
  await page.locator('.assembly-play').click(); await page.waitForTimeout(200);
  await slider.fill('50'); await page.waitForTimeout(150);
  assert.equal(await slider.inputValue(), '50');
  await page.locator('.assembly-play').click();
  await page.waitForFunction(() => Number(document.querySelector('#study-assembly').value) > 50);
  await page.locator('.assembly-play').click();
  await slider.fill('50');
  checks.push('Playback replays from the floor, resumes from a scrubbed position and yields to scrubbing; idle rendering stops');

  await slider.fill('0');
  await page.locator('.assembly-play').click();
  await page.waitForFunction(() => Number(document.querySelector('#study-assembly').value) >= 55);
  assert.equal(await page.locator('.assembly-play').getAttribute('data-playing'), 'true');
  await page.waitForFunction(() => document.querySelector('#study-assembly').value === '100'
    && document.querySelector('.assembly-play').dataset.playing === 'false');
  assert.equal(await page.locator('.assembly-play').getAttribute('data-playing'), 'false');
  checks.push('Uninterrupted playback passes 55% and completes at 100%');
  await slider.fill('50');

  const canvas = page.locator('.assembly-webgl');
  const beforeRotation = await canvas.screenshot();
  await canvas.focus(); await canvas.press('ArrowRight');
  assert.notDeepEqual(await canvas.screenshot(), beforeRotation);
  await canvas.press('Home');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.notDeepEqual(await canvas.screenshot(), beforeRotation);
  await page.locator('.assembly-reset').click();
  assert.equal(await slider.inputValue(), '0');
  assert.equal(await page.locator('.has-explored').count(), 0);
  checks.push('Preview starts at 0%; pointer/keyboard rotation work and reset returns to the initial assembly and camera');

  await slider.fill('0');
  await page.screenshot({ path: `${output}/desktop.png` });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    await page.locator('.assembly-stage').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/mobile-${width}.png` });
    await page.locator('button[data-view="drawing"]').click();
    await slider.fill('100');
    await page.locator('.assembly-stage').screenshot({ path: `${output}/drawing-mobile-${width}.png` });
    await page.locator('button[data-view="material"]').click();
  }
  checks.push('No horizontal overflow at 320, 390 or 768 pixels');

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(url);
  await fallback.locator('[data-renderer="unavailable"]').waitFor();
  assert.equal(await fallback.locator('#study-assembly').isDisabled(), true);
  await fallback.locator('#study-width').fill('300');
  assert.equal(await fallback.locator('.study-fallback svg').getAttribute('aria-label'), '300 cm');
  assert.ok((await fallback.locator('#study-start').getAttribute('href')).includes('#spec='));
  checks.push('Without WebGL, the static preview, size controls and editor handoff still work');
  const noMotion = await browser.newPage({ reducedMotion: 'reduce' });
  await noMotion.goto(url, { waitUntil: 'networkidle' });
  await noMotion.waitForFunction(() => document.querySelector('#study-canvas')?.dataset.ready === 'true');
  const initial = await noMotion.locator('#study-assembly').inputValue();
  await noMotion.waitForTimeout(200);
  assert.equal(await noMotion.locator('#study-assembly').inputValue(), initial);
  checks.push('Reduced motion starts with a still scene; animation requires an explicit play action');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/checks.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(checks.join('\n'));
} finally { await browser.close(); }
