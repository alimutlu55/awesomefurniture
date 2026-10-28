// Isolated browser fixture: never reads or writes a saved kitchen.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.MOBILE_TEST_URL ?? 'http://127.0.0.1:5177';
const output = process.argv[2] ?? 'output/corner-movement';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/corner-movement', route => route.fulfill({ contentType: 'text/html', body:
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/corner-movement');
    const result = await page.evaluate(async () => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { createSceneCommands } = await import('/src/application/commands/scene-commands.ts');
      const { createEditorState } = await import('/src/application/projects/editor-state.ts');
      const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
      const { createCabinetGeometry } = await import('/src/domain/geometry/cabinet-geometry.js');
      const { cornerReturnJoints } = await import('/src/domain/kitchen/corner-widths.ts');
      const { validateForManufacture } = await import('/src/domain/drawings/manufacturing-validation.ts');
      const scene = { wardrobes: [
        { id: 1, name: 'Blind', x: 0, y: 0, z: 0, angle: 0,
          state: { ...createEditorState(), ...createKitchenDesign('base', 'corner'), w: 102 } },
        { id: 2, name: 'Return', x: 22, y: 0, z: 100, angle: 270,
          state: { ...createEditorState(), ...createKitchenDesign('base', 'cargo') } },
      ], activeWardrobe: 2, nextWardrobeId: 3 };
      const commands = createSceneCommands(() => scene);
      const stops = [];
      for (const target of [46.2, -100, -1000]) {
        scene.wardrobes[1].z = 100;
        commands.previewTranslation(2, { x: 22, y: 0, z: target });
        stops.push(scene.wardrobes[1].z);
      }
      const moving = scene.wardrobes[1];
      const joint = cornerReturnJoints(moving, scene.wardrobes)[0];
      const clash = createCabinetGeometry(() => scene.wardrobes).cabinetCollides(moving);
      const problems = validateForManufacture({ pieces: scene.wardrobes.map(p => ({ ...p, design: p.state })) })
        .findings.filter(f => f.severity === 'critical');
      const settled = commands.settleCabinet(2);
      window.cornerEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: scene });
      return { stops, gap: joint.bodyGap, clash, settled, problems };
    });
    assert.ok(result.stops.every(z => Math.abs(z - 48) < .001), JSON.stringify(result));
    assert.ok(Math.abs(result.gap - 4) < .001);
    assert.equal(result.clash, false); assert.equal(result.settled, null); assert.deepEqual(result.problems, []);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true });
    const plan = dialog.locator('img[alt="1 Plan"]'); await plan.evaluate(img => img.decode());
    const svg = decodeURIComponent(await plan.getAttribute('src'));
    assert.doesNotMatch(svg, /NOT FOR MANUFACTURE/); assert.match(svg, />40<\/text>/);
    await page.screenshot({ path: output + '/corner-stop-' + width + '.png' });
    assert.deepEqual(errors, []);
    console.log(width + 'px: short/large drag previews stop at 40 mm; no collision or manufacturing blockers; plan verified.');
    await page.close();
  }
} finally { await browser.close(); }
