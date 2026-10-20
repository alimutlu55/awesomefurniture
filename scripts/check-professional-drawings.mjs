// Vite on port 5177. Fixtures are local and never load saved user projects.
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { chromium } from 'playwright';
import { drawingFixture } from './professional-drawing-fixtures.mjs';
const output = process.env.DRAWING_OUTPUT ?? 'docs/verification/simple-drawing-viewer'; await mkdir(output, { recursive: true });
const fixture = '.professional-drawings-review.html';
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
window.fixtureEditor=mountEditor({root:document.querySelector('#fixture'),initialScene:${JSON.stringify(drawingFixture(process.env.DRAWING_FIXTURE ?? 'l'))}});
</script></body></html>`);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const open = async p => {
    await p.goto('http://127.0.0.1:5177/' + fixture);
    await p.getByRole('button', { name: 'Menu', exact: true }).click();
    await p.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    return p.getByRole('dialog', { name: 'Technical drawings', exact: true });
  };
  const dialog = await open(page), list = dialog.locator('.drawings-sheets');
  await dialog.locator('img').first().evaluate(img => img.decode());
  assert.equal(await dialog.getByRole('button').count(), 4, 'only zoom out/in, PDF and close');
  assert.equal(await dialog.locator('input,select,aside,nav').count(), 0, 'no stacked controls or inspectors');
  const count = await dialog.locator('img').count(); assert.ok(count > 20, 'all cabinet and room sheets remain available');
  for (const title of ['Plan', 'Upper furniture plan', 'Clearances plan', 'Elevation A', 'Furniture schedule', 'Review issues'])
    assert.ok(await dialog.locator('img').evaluateAll((images, title) => images.some(img => img.alt.endsWith(' ' + title)), title), title);
  await page.screenshot({ path: output + '/desktop.png' });
  if (process.env.DRAWING_FIXTURE === 'shelf') {
    const upper = dialog.locator('img[alt$=" Upper furniture plan"]');
    assert.match(decodeURIComponent(await upper.getAttribute('src')), /Wall shelf/);
    await upper.scrollIntoViewIfNeeded(); await page.screenshot({ path: output + '/desktop-shelf.png' });
    const schedule = dialog.locator('img[alt$=" Furniture schedule"]');
    const content = decodeURIComponent(await schedule.getAttribute('src'));
    assert.match(content, /K32/); assert.match(content, /Wall shelf/);
    assert.match(content, /2930/); assert.ok(!content.includes('Cabinet schedule'));
    await list.evaluate(el => { el.scrollTop = 0; });
  }
  await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const zoomed = await dialog.locator('img').first().boundingBox(); assert.ok(zoomed.width > 1440);
  await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Save as PDF', exact: true }).click();
  await (await download).saveAs(output + '/drawings.pdf');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: output + '/mobile.png' });
  const stage = await list.boundingBox(), panel = await dialog.boundingBox(), first = await dialog.locator('img').first().boundingBox();
  assert.ok(stage.height > panel.height * .75, 'drawing area gets at least 75% of mobile height');
  assert.ok(first.width > 340 && first.width <= 375, 'drawing opens at full available width');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await list.evaluate(el => { el.scrollTop = 900; }); assert.ok(await list.evaluate(el => el.scrollTop) > 800, 'scroll through sheets');
  await dialog.getByRole('button', { name: 'Close technical drawings', exact: true }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
  assert.equal(await list.evaluate(el => el.scrollTop), 0, 'reopen starts at the plan');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  const touchPage = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  touchPage.on('pageerror', e => errors.push(e.message)); const touchDialog = await open(touchPage);
  const before = await touchDialog.locator('img').first().boundingBox(), frame = await touchDialog.locator('.drawings-sheets').boundingBox();
  const client = await touchPage.context().newCDPSession(touchPage), cy = frame.y + 120;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: cy, id: 1 }, { x: 230, y: cy, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: cy, id: 1 }, { x: 280, y: cy, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await touchDialog.locator('img').first().boundingBox()).width > before.width * 1.8, 'two-finger pinch zooms sheets');
  await touchPage.screenshot({ path: output + '/mobile-zoom.png' });
  assert.deepEqual(errors, []);
  console.log('Simple viewer passed: four controls, all sheets, full-width mobile drawing, scroll, pinch, direct PDF download, reopen and close.');
} finally { await browser?.close(); await unlink(fixture); }
