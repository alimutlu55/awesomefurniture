// Read-only viewer check. Optional project JSON is copied into an isolated editor, never saved remotely.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installationDrawingFixture } from './installation-drawing-fixture.mjs';
import { projectToScene } from '../src/application/projects/editor-mapper.ts';

const [source, output = 'output/corner-representation'] = process.argv.slice(2);
const scene = source ? projectToScene(JSON.parse(await readFile(source, 'utf8'))) : installationDrawingFixture();
if (!source) {
  scene.wardrobes = scene.wardrobes.filter(p => p.id !== 6);
  for (const id of [7, 8, 9]) scene.wardrobes.find(p => p.id === id).x -= 1.8;
}
const base = process.env.MOBILE_TEST_URL ?? 'http://127.0.0.1:5177';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/corner-representation', route => route.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/corner-representation');
    await page.evaluate(async scene => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      window.representationEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
    }, scene);
    const poses = () => page.evaluate(() => window.representationEditor.scene().wardrobes.map(p => [p.id, p.x, p.y, p.z, p.angle]));
    const before = await poses();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
    const plan = dialog.locator('img[alt="1 Plan"]'); await plan.evaluate(img => img.decode());
    const svg = decodeURIComponent(await plan.getAttribute('src'));
    assert.match(svg, />40<\/text>/); assert.match(svg, />20<\/text>/);
    assert.doesNotMatch(svg, /40 required/);
    assert.match(svg, /NOT FOR MANUFACTURE/);
    assert.ok(await dialog.locator('img[alt*=" Corner K"]').count());
    await page.screenshot({ path: output + '/plan-' + width + '.png' });
    if (width === 1440) {
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Save review PDF', exact: true }).click();
      await (await download).saveAs(output + '/drawings.pdf');
    }
    assert.deepEqual(await poses(), before, 'viewing/exporting must preserve saved cabinet positions');
    assert.deepEqual(errors, []); await page.close();
    console.log(width + 'px: plain 40, separate 20, blocking stamp, unchanged poses and PDF export verified.');
  }
} finally { await browser.close(); }
