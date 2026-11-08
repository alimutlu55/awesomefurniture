// Contact sheets of the assembly film (Make › Assembly) for reviewing the camera: every chapter at its drilling, its
// placing, each joint being fixed, the doors' hanging and adjusting, and the breath at its end. A wardrobe with doors,
// drawers, shelves and a rail, and a kitchen drawer unit with applied fronts, on desktop and phone.
// Run with the dev server up (MOBILE_TEST_URL, default http://127.0.0.1:5173):
//   SHOTS=<dir> [FIXTURE=wardrobe|kitchen] [VIEWPORT=desktop|phone] [STAGE=<regex>] node scripts/capture-assembly-shots.cjs
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173', shots = process.env.SHOTS || '.';
const T = { timeout: 180000 };
const FIXTURES = {
 wardrobe: `{ ...createEditorState(), w: 100, h: 210, d: 60, n: 2, wt: [1, 1, 100, 100, 100, 100], doors: 'hinged', dividers: [],
   secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'shelf', h: 35 }, { k: 'shelf', h: 35 }], [{ k: 'short', h: 106 }, { k: 'shelf', h: 35 }], [], [], [], []] }`,
 kitchen: `{ ...createEditorState(), ...createKitchenDesign('base', 'drawers') }`,
 // Four drawers placed 3.2 cm apart under a shelf: built as one chest of drawers.
 chest: `{ ...createEditorState(), w: 100, h: 210, d: 60, n: 1, wt: [100, 100, 100, 100, 100, 100], doors: 'none', dividers: [],
   secs: [[0, 1, 2, 3].map(n => ({ k: 'drawer', h: 21, y: n * 24.2 })).concat([{ k: 'shelf', h: 40, y: 100 }]), [], [], [], [], []] }`,
 // A 2 m bay without doors: four drawers on the left, a trouser pull-out beside them, nothing between the two.
 column: `{ ...createEditorState(), w: 200, h: 210, d: 60, n: 1, wt: [200, 100, 100, 100, 100, 100], doors: 'none', dividers: [],
   secs: [[{ k: 'drawer', h: 21, w: 103, ax: 'l' }, { k: 'drawer', h: 21, w: 103, ax: 'l' }, { k: 'drawer', h: 21, w: 103, ax: 'l' },
     { k: 'drawer', h: 21, w: 103, ax: 'l' }, { k: 'pants', h: 70, w: 93, ax: 'r', y: 0 }], [], [], [], [], []] }`,
 // One wide bay without doors: two drawers and four drawers side by side either side of a divider, shelves under them.
 split: `{ ...createEditorState(), w: 160, h: 210, d: 60, n: 1, wt: [160, 100, 100, 100, 100, 100], doors: 'none',
   dividers: [{ i: 0, orientation: 'vertical', x: 79, y0: 60, y1: 112 }],
   secs: [[{ k: 'shelf', h: 25, y: 0 }, { k: 'shelf', h: 30, y: 26 },
     { k: 'drawer', h: 25, w: 78, x: 0, y: 60 }, { k: 'drawer', h: 25, w: 78, x: 0, y: 86 },
     { k: 'drawer', h: 12.5, w: 79, x: 80, y: 60 }, { k: 'drawer', h: 12.5, w: 79, x: 80, y: 73 },
     { k: 'drawer', h: 12.5, w: 79, x: 80, y: 86 }, { k: 'drawer', h: 12.5, w: 79, x: 80, y: 99 }, { k: 'shelf', h: 80, y: 113 }], [], [], [], [], []] }`,
};
const VIEWPORTS = { desktop: [960, 600], phone: [375, 812] };

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const fixture of Object.keys(FIXTURES).filter(f => !process.env.FIXTURE || f === process.env.FIXTURE))
  for (const [vp, [width, height]] of Object.entries(VIEWPORTS).filter(([v]) => !process.env.VIEWPORT || v === process.env.VIEWPORT)) {
   const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: 'reduce' });
   page.setDefaultTimeout(180000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/shots-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/shots-fixture');
   await page.evaluate(`(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const { createKitchenDesign } = await import('/src/domain/kitchen/kitchen-design.ts');
    const state = ${FIXTURES[fixture]};
    window.shotsEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: { wardrobes: [{ id: 1, name: 'Piece', x: 0, y: 0, z: 30, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 } });
   })()`);
   await page.waitForTimeout(1500);
   const el = id => page.locator(`[data-editor-id="${id}"]`), toolbar = el('toolbar'), view = await el('view').boundingBox();
   await page.mouse.click(view.x + view.width / 2, view.y + view.height * .45);
   await page.waitForTimeout(600);
   await toolbar.locator('[data-action="make"]').click(T);
   await toolbar.locator('[data-action="make-assembly"]').click(T);
   const studio = page.locator('.assembly-studio');
   await studio.waitFor({ state: 'visible', ...T });
   // The film's timeline, worked out in the page from the same scene and code as the studio's.
   const film = await page.evaluate(async () => {
    const { makePiece } = await import('/src/domain/make/make-parts.ts');
    const { drawingInputOf } = await import('/src/application/engine/scene-input.ts');
    const { assemblyTimeline } = await import('/src/domain/make/make-timeline.ts');
    const scene = window.shotsEditor.scene(), piece = makePiece(drawingInputOf(scene), scene.activeWardrobe), tl = assemblyTimeline(piece);
    return { duration: tl.duration, runners: piece.fittings.filter(f => f.runner).length, steps: tl.steps.map((s, k) => ({ stage: piece.steps[k].stage, start: s.start, drill: s.drill, place: s.place,
      fixes: s.fixes.map(f => f.at), hang: s.hang, adjust: s.adjust, end: s.end })) };
   });
   const moments = [];
   film.steps.forEach((s, k) => {
    if (process.env.STAGE && !new RegExp(process.env.STAGE).test(s.stage)) return;
    const add = (label, t) => moments.push({ k, stage: s.stage, label, t });
    if (s.drill[1] > s.drill[0]) { add('drill', s.drill[0] + (s.drill[1] - s.drill[0]) * .3); add('drill·2', s.drill[0] + (s.drill[1] - s.drill[0]) * .8); }
    // The travel test: each drawer at its widest open, in turn.
    const runners = s.stage === 'drawer-test' ? film.runners : 0;
    for (let j = 0; j < runners; j++) add('open ' + (j + 1), s.place[0] + (s.place[1] - s.place[0]) * (j + .45) / runners);
    if (s.place[1] > s.place[0] && !runners) { add('place', s.place[0] + (s.place[1] - s.place[0]) * .3); add('placed', s.place[0] + (s.place[1] - s.place[0]) * .9); }
    s.fixes.slice(0, 6).forEach((f, j) => add('fix' + (j + 1), (f[0] + f[1]) / 2));
    if (s.hang[1] > s.hang[0]) add('hang', (s.hang[0] + s.hang[1]) / 2);
    if (s.adjust[1] > s.adjust[0]) add('adjust', (s.adjust[0] + s.adjust[1]) / 2);
    add('end', s.end - .15);
   });
   const frames = [];
   for (const m of moments) {
    // The scrubber is the studio's own seek: set it and say so, as a drag does (it may be folded away on small screens).
    await studio.locator('.as-scrub').evaluate((e, v) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, m.t / film.duration * 1000);
    await page.waitForTimeout(450);
    const png = await page.screenshot();
    frames.push({ ...m, src: 'data:image/png;base64,' + png.toString('base64') });
   }
   // One sheet: the frames in a grid, each with its chapter and moment written on it.
   const sheet = await page.evaluate(async ({ frames, width, height }) => {
    const cols = width > height ? 4 : 6, scale = width > height ? .5 : .42, w = Math.round(width * scale), h = Math.round(height * scale);
    const c = document.createElement('canvas'); c.width = cols * w; c.height = Math.ceil(frames.length / cols) * h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    for (const [i, f] of frames.entries()) {
     const img = new Image(); img.src = f.src; await img.decode();
     const x = (i % cols) * w, y = Math.floor(i / cols) * h;
     g.drawImage(img, x, y, w, h);
     g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(x, y, w, 18); g.fillStyle = '#fff'; g.font = '12px sans-serif';
     g.fillText(`${f.k + 1} ${f.stage} · ${f.label}`, x + 5, y + 13);
     g.strokeStyle = '#888'; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
    }
    return c.toDataURL('image/png');
   }, { frames, width, height });
   const file = `${shots}/sheet-${fixture}-${vp}${process.env.STAGE ? '-' + process.env.STAGE.replace(/\W+/g, '_') : ''}.png`;
   writeFileSync(file, Buffer.from(sheet.split(',')[1], 'base64'));
   console.log(file, frames.length, 'frames', errors.length ? errors : 'no errors');
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
