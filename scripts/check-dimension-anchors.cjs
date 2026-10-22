const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [375, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: width < 500, isMobile: width < 500 });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route(base + '/dimension-anchor-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/dimension-anchor-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { createWardrobeGeometry } = await import('/src/domain/geometry/wardrobe-geometry.js');
    const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
    const url = performance.getEntriesByType('resource').find(e => /\/three\.js\?/.test(e.name)).name;
    const THREE = await import(url), projection = THREE.PerspectiveCamera.prototype.updateProjectionMatrix;
    window.dimensionFixture = { THREE, createWardrobeGeometry, createKitchenDesign, createEditorState, mountEditor, pose: null };
    THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () {
     if (this.fov !== 35) return projection.call(this);
     const f = window.dimensionFixture;
     if (f.pose) { this.zoom = 1; this.view = null; }
     projection.call(this); f.cam = this;
    };
    const lookAt = THREE.Object3D.prototype.lookAt;
    THREE.PerspectiveCamera.prototype.lookAt = function (...args) {
     if (this.fov !== 35) return lookAt.apply(this, args);
     const f = window.dimensionFixture; f.cam = this;
     if (f.pose) {
      this.zoom = 1; this.view = null; projection.call(this);
      const { dist, az, el, pan = 0 } = f.pose;
      this.position.set(pan + dist * Math.cos(el) * Math.sin(az), 115 + dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
      return lookAt.call(this, pan, 115, 0);
     }
     return lookAt.apply(this, args);
    };
   });
   for (const kind of ['wardrobe', 'kitchen', 'item', 'divider', 'space', 'slope', 'fixture']) {
    await page.evaluate(kind => {
     const f = window.dimensionFixture;
     f.editor?.dispose(); f.pose = null;
     const state = { ...f.createEditorState(), w: 160, n: 1, secs: [[{ k: 'shelf', h: 35, x: 0, y: 0, w: 90 }]] };
     if (kind === 'kitchen' || kind === 'fixture') Object.assign(state, f.createKitchenDesign(kind === 'fixture' ? 'shelf' : 'base', kind === 'fixture' ? 'shelf' : 'drawers'));
     state.dividers = [{ i: 0, orientation: 'horizontal', x0: 0, x1: state.w - 3.6, y: 100 }];
     if (kind === 'slope') state.shape = { template: 'custom', top: [{ x: 0, y: 230 }, { x: 160, y: 170 }] };
     f.kind = kind;
     f.editor = f.mountEditor({ root: document.querySelector('#editor'), initialScene: { wardrobes: [{ id: 1, name: kind,
      x: 25, y: kind === 'kitchen' || kind === 'fixture' ? 45 : 0, z: -20, angle: kind === 'kitchen' ? 35 : 0, state }], activeWardrobe: 1, nextWardrobeId: 2 } });
    }, kind);
    await page.waitForTimeout(500);
    assert.deepEqual(errors, [], 'Mounted fixture has no browser errors');
    const frame = await page.evaluate(() => {
     const f = window.dimensionFixture, c = f.editor.scene().wardrobes[0], s = c.state;
     const r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
     const p = new f.THREE.Vector3(f.kind === 'fixture' ? 0 : s.w / 2 - .9, s.h / 2, s.d / 2)
      .applyAxisAngle(new f.THREE.Vector3(0, 1, 0), c.angle * Math.PI / 180).add(new f.THREE.Vector3(c.x, c.y, c.z)).project(f.cam);
     return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
    });
    await page.mouse.click(frame.x, frame.y); await page.waitForTimeout(150);
    if (['item', 'divider', 'space'].includes(kind)) {
     const point = await page.evaluate(kind => {
      const f = window.dimensionFixture, c = f.editor.scene().wardrobes[0], r = document.querySelector('#editor').shadowRoot.querySelector('canvas').getBoundingClientRect();
      const p = new f.THREE.Vector3(kind === 'item' ? -25 : 30, kind === 'item' ? 25 : kind === 'divider' ? 109.8 : 155, 30);
      p.applyAxisAngle(new f.THREE.Vector3(0, 1, 0), c.angle * Math.PI / 180).add(new f.THREE.Vector3(c.x, c.y, c.z)).project(f.cam);
      return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
     }, kind);
     await page.mouse.click(point.x, point.y); await page.waitForTimeout(100);
    }
    const selected = await page.evaluate(() => {
     const f = window.dimensionFixture, s = f.editor.scene().wardrobes[0].state;
     return { item: s.item, divider: s.divider, space: !!s.space };
    });
    if (kind === 'item') assert.equal(selected.item, 0);
    if (kind === 'divider') assert.equal(selected.divider, 0);
    if (kind === 'space') assert.equal(selected.space, true);
    const initialSizes = new Map();
    for (const [dist, az, el, pan] of [[650, .5, .25, 0], [1100, .5, .25, 0], [450, .5, .25, 0], [650, -.8, .4, 0], [650, 1.2, .15, 0], [650, .3, 1.1, 0], [650, .5, .25, 90], [650, .5, .25, 0]]) {
     await page.evaluate(pose => { window.dimensionFixture.pose = pose; }, { dist, az, el, pan });
     await page.waitForTimeout(100);
     const audit = await page.evaluate(async () => {
      const f = window.dimensionFixture, root = document.querySelector('#editor').shadowRoot, c = f.editor.scene().wardrobes[0], s = c.state;
      const r = root.querySelector('canvas').getBoundingClientRect();
      const project = xyz => {
       const p = new f.THREE.Vector3(...xyz).applyAxisAngle(new f.THREE.Vector3(0, 1, 0), c.angle * Math.PI / 180)
        .add(new f.THREE.Vector3(c.x, c.y, c.z)).project(f.cam);
       return { x: (p.x + 1) * r.width / 2, y: (1 - p.y) * r.height / 2 };
      };
      let ends;
      if (f.kind === 'item') {
       const g = f.createWardrobeGeometry(() => s).itemMeasurements(0, 0);
       ends = [[g.x0 - s.w / 2, g.y0, g.z1 - s.d / 2], [g.x1 - s.w / 2, g.y0, g.z1 - s.d / 2]];
      } else if (f.kind === 'divider') {
       const g = f.createWardrobeGeometry(() => s), vr = g.visibleRect(s.dividers[0]);
       ends = [[-s.w / 2 + 1.8 + vr.x0, g.interiorFloor() + vr.y0, s.d / 2 - 1.4],
        [-s.w / 2 + 1.8 + vr.x1, g.interiorFloor() + vr.y0, s.d / 2 - 1.4]];
      } else if (f.kind === 'space') {
       const g = f.createWardrobeGeometry(() => s), space = g.sectionSpaceMeasurements(0);
       ends = [[-s.w / 2 + 1.8 + space.x0, space.y0, s.d / 2], [-s.w / 2 + 1.8 + space.x1, space.y0, s.d / 2]];
      } else ends = [[-s.w / 2, 0, s.d / 2], [s.w / 2, 0, s.d / 2]];
      const [a, b] = ends.map(project);
      const lines = [...root.querySelectorAll('.measurement-line path')].map(p => ({ path: p, n: (p.getAttribute('d') || '').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g)?.map(Number) || [] }));
      const target = lines.find(p => p.n.length >= 8 && Math.hypot(p.n[0] - a.x, p.n[1] - a.y, p.n[4] - b.x, p.n[5] - b.y) < .01);
      const labels = [...root.querySelectorAll('.lbl.dim')].filter(el => el.offsetParent && getComputedStyle(el).display !== 'none');
      const stable = labels.map(el => ({ el, before: el.getBoundingClientRect() }));
      for (let i = 0; i < 12; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      return { hasLine: !!target, paths: lines.map(p => p.n.slice(0, 8)), ends: [a, b],
       offset: target ? Math.hypot(target.n[2] - target.n[0], target.n[3] - target.n[1]) : null,
       drift: Math.max(0, ...stable.filter(x => x.el.offsetParent).map(({ el, before }) => {
        const after = el.getBoundingClientRect(); return Math.hypot(after.x - before.x, after.y - before.y);
       })),
       labels: labels.map(el => ({ text: el.textContent, w: el.offsetWidth, h: el.offsetHeight,
        translations: (el.style.transform.match(/translate\(/g) || []).length })) };
     });
     assert.ok(audit.hasLine, `${width}px ${kind}: ruler endpoints match physical geometry at distance ${dist}, azimuth ${az}: ${JSON.stringify(audit)}`);
     assert.ok(Math.abs(audit.offset - 8) < .01, 'Ruler offset remains exactly 8 CSS pixels');
     assert.ok(audit.drift < .05, `${width}px ${kind}: no label drift while camera rests (${audit.drift})`);
     for (const label of audit.labels) {
      assert.ok(label.translations <= 3, 'Overlap correction never accumulates across frames');
      const before = initialSizes.get(label.text);
      if (before) assert.deepEqual([label.w, label.h], before, 'Text stays the same size through zoom, orbit and pan');
      else initialSizes.set(label.text, [label.w, label.h]);
     }
    }
    if (kind === 'wardrobe' || kind === 'item') await page.screenshot({ path: `/tmp/wardrobe-dimension-${width}-${kind}.png` });
    console.log(`PASS ${width}px ${kind}: accurate corner anchors, constant pixel spacing/text size, no accumulation across zoom/orbit/pan`);
   }
   assert.deepEqual(errors, []); await page.evaluate(() => window.dimensionFixture.editor.dispose()); await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
