// Vite on port 5177. WALL_PROJECT_FILE optionally replays a local saved-design copy without cloud writes.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createEditorState } from '../src/application/projects/editor-state.ts';
import { createKitchenDesign } from '../src/domain/kitchen/kitchen-design.ts';
import { projectToScene, sceneToProject } from '../src/application/projects/editor-mapper.ts';

const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5177';
const studio = { template: 'custom', corners: [{ id: 'c1', x: -176, z: 260 }, { id: 'c2', x: -176, z: -74 }, { id: 'c3', x: 241, z: -74 }],
  walls: [{ id: 'w1', a: 'c1', b: 'c2', height: 270, thickness: 12 }, { id: 'w2', a: 'c2', b: 'c3', height: 270, thickness: 12 }], openings: [] };
const fixture = { studio, wardrobes: [{ id: 1, name: 'Base cabinet', x: -94.5, y: 0, z: -39, angle: 0,
  state: { ...createEditorState(), ...createKitchenDesign('base') } }], activeWardrobe: 1, nextWardrobeId: 2 };
const project = process.env.WALL_PROJECT_FILE ? JSON.parse(await readFile(process.env.WALL_PROJECT_FILE, 'utf8'))
  : sceneToProject({ schemaVersion: 1, id: 'wall-qa', name: 'Wall resize QA', units: 'mm', wardrobes: [] }, fixture);
const scene = projectToScene(project);
await mkdir('output/smart-wall-size', { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width < 500, isMobile: width < 500, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(base + '/smart-wall-fixture', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
    await page.goto(base + '/smart-wall-fixture');
    await page.evaluate(async scene => {
      const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
      const { setLengthUnit } = await import('/src/presentation/editor/length-unit-state.ts');
      const { wallFace } = await import('/src/domain/studio/studio.ts');
      setLengthUnit('mm');
      const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
      const THREE = await import(url), lookAt = THREE.Object3D.prototype.lookAt;
      THREE.PerspectiveCamera.prototype.lookAt = function (...args) {
        if (this.fov === 35) window.wallTestCamera = this;
        return lookAt.apply(this, args);
      };
      window.wallTest = { editor: mountEditor({ root: document.querySelector('#editor'), initialScene: scene }), THREE, wallFace };
      window.wallTest.editor.snapshot();
    }, scene);
    const el = id => page.locator(`[data-editor-id="${id}"]`);
    await page.locator('[data-view-mode="studio"]').click();
    await page.waitForTimeout(600);
    const target = await page.evaluate(() => {
      const f = window.wallTest, room = f.editor.scene().studio, face = f.wallFace(room, room.walls.find(w => w.id === 'w1'));
      const point = new f.THREE.Vector3((face.from.x + face.to.x) / 2, 215, (face.from.z + face.to.z) / 2).project(window.wallTestCamera);
      const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
      return { x: r.x + (point.x + 1) * r.width / 2, y: r.y + (1 - point.y) * r.height / 2 };
    });
    await page.mouse.click(target.x, target.y);
    assert.equal(await el('toolbar').getAttribute('data-context'), 'wall');
    await page.locator('.contextual-actions [data-action="wall-size"]').click();
    const input = page.locator('[data-room-field="length"]');
    assert.equal(await input.count(), 1, 'one existing Length input');
    assert.equal(await page.locator('.room-fields input[type="number"]').count(), 3, 'no extra size fields');
    assert.equal(await input.inputValue(), '3280');
    const before = await page.evaluate(() => structuredClone(window.wallTest.editor.scene()));
    await input.fill('3270'); await input.press('Enter');
    const after = await page.evaluate(() => structuredClone(window.wallTest.editor.scene()));
    assert.equal(await input.inputValue(), '3270', 'requested millimetres stay accepted');
    assert.equal(after.studio.corners.find(c => c.id === 'c1').z, 259);
    assert.deepEqual(after.studio.corners.filter(c => c.id !== 'c1'), before.studio.corners.filter(c => c.id !== 'c1'));
    assert.deepEqual(after.wardrobes, before.wardrobes, 'furniture stays in place');
    await page.screenshot({ path: `output/smart-wall-size/accepted-${width}.png` });
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await input.inputValue(), '3280', 'one undo restores the original length');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    assert.equal(await input.inputValue(), '3270', 'redo restores the accepted length');
    assert.deepEqual(errors, []);
    console.log(`${width}px: existing Length input accepts 3270 mm from the outer end; inner corner, furniture, undo and redo verified.`);
    await page.close();
  }
} finally { await browser.close(); }
