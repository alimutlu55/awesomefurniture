// Run with node --import tsx scripts/check-architectural-envelope.mjs (Vite on port 5177).
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { chromium } from 'playwright';
import { rectangleStudio } from '../src/domain/studio/studio-templates.ts';
import { createKitchenDesign } from '../src/domain/kitchen/kitchen-design.ts';
import { technicalDrawings } from '../src/domain/drawings/technical-drawings.ts';
import { drawingsPdf } from '../src/presentation/drawings/drawings-viewer.ts';

const output = 'docs/verification/architectural-envelope';
await mkdir(output, { recursive: true });
const studio = { ...rectangleStudio(400, 300), openings: [
  { id: 'window', wall: 'w1', kind: 'window', offset: 306, width: 100, height: 120, sill: 100 },
  { id: 'door', wall: 'w2', kind: 'door', offset: 235, width: 80, height: 205, sill: 0 },
  { id: 'radiator', wall: 'w4', kind: 'radiator', offset: 120, width: 80, height: 60, sill: 15 },
] };
const cabinet = (id, unit, preset, x, z, angle = 0, y = 0) => ({ id, name: preset, x, y, z, angle,
  state: { ...createKitchenDesign(unit, preset), sel: 0, item: -1, divider: -1, space: null, open: false } });
const wardrobes = [cabinet(1, 'tall', 'fridge', -150, 29), cabinet(2, 'base', 'drawers', -90, 29),
  cabinet(3, 'base', 'dishwasher', -30, 29), cabinet(4, 'upper', undefined, -90, 17.5, 0, 142),
  cabinet(5, 'base', 'drawers', -90, 271, 180)];
const scene = { studio, wardrobes, activeWardrobe: 2, nextWardrobeId: 6 };
const sheets = technicalDrawings({ studio, pieces: wardrobes.map(p => ({ ...p, design: p.state })) });
await writeFile(output + '/envelope.pdf', drawingsPdf(sheets, { project: 'Architectural envelope', date: '20.10.2026', total: sheets.length }));
const fixture = '.architectural-envelope-review.html';
await writeFile(fixture, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0"><main id="fixture" style="height:100dvh;width:100%"></main><script type="module">
import { mountEditor } from '/src/presentation/editor/mount-editor.ts';
window.fixtureEditor = mountEditor({ root: document.querySelector('#fixture'), initialScene: ${JSON.stringify(scene)} });
</script></body></html>`);
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5177/' + fixture);
  await page.getByRole('menuitem', { name: 'Technical drawings', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
  // The menu item is only visible after opening the editor's overflow menu.
  const menu = page.locator('[data-editor-id="menu-btn"]');
  await menu.click();
  await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('img[alt*="Elevation"]').count(), 4);
  await dialog.locator('img').first().evaluate(img => img.decode());
  await page.screenshot({ path: output + '/desktop-plan.png' });
  await dialog.locator('img[alt="2 Elevation A"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: output + '/desktop-elevation.png' });
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Save as PDF' }).click();
  const download = await downloaded;
  await download.saveAs(output + '/viewer-export.pdf');
  for (const size of [{ width: 375, height: 812 }]) {
    await page.setViewportSize(size);
    await dialog.locator('img').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: output + '/mobile-plan.png' });
    await dialog.getByRole('button', { name: 'Zoom in' }).click();
    await page.screenshot({ path: output + '/mobile-zoom.png' });
    await dialog.getByRole('button', { name: 'Close technical drawings' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  assert.deepEqual(errors, []);
  console.log('Desktop and 375px viewer, four wall elevations, zoom, PDF download and close passed.');
} finally {
  await browser?.close();
  await unlink(fixture);
}
