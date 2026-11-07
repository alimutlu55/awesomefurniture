// Screenshots of every drawer chapter of the assembly film (Make › Assembly), for review: a one-bay wardrobe with two
// drawers under shelves, on desktop and phone. Run with the dev server up (MOBILE_TEST_URL, default http://127.0.0.1:5173):
//   SHOTS=<dir> [ONLY=<chapter regex>] [DESKTOP_ONLY=1] node scripts/capture-drawer-assembly.cjs
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173', shots = process.env.SHOTS || '.';
const T = { timeout: 120000 };
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const [name, width, height] of (process.env.PHONE_ONLY ? [['phone', 375, 812]] : process.env.DESKTOP_ONLY ? [['desktop', 1440, 900]] : [['desktop', 1440, 900], ['phone', 375, 812]])) {
   const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, deviceScaleFactor: 2, reducedMotion: 'reduce' });
   page.setDefaultTimeout(120000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/drawer-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>' }));
   await page.goto(base + '/drawer-fixture');
   await page.evaluate(async () => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    const state = { ...createEditorState(), w: 80, h: 200, d: 60, n: 1, wt: [1, 100, 100, 100, 100, 100], dividers: [],
     secs: [[{ k: 'drawer', h: 22 }, { k: 'drawer', h: 22 }, { k: 'shelf', h: 35 }], [], [], [], [], []] };
    window.drawerEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: { wardrobes: [{ id: 1, name: 'Wardrobe', x: 0, y: 0, z: 30, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 } });
   });
   await page.waitForTimeout(1500);
   const el = id => page.locator(`[data-editor-id="${id}"]`), toolbar = el('toolbar'), view = await el('view').boundingBox();
   await page.mouse.click(view.x + view.width / 2, view.y + view.height * .45);
   await page.waitForTimeout(600);
   await toolbar.locator('[data-action="make"]').click(T);
   await toolbar.locator('[data-action="make-assembly"]').click(T);
   const studio = page.locator('.assembly-studio');
   await studio.waitFor({ state: 'visible', ...T });
   await studio.locator('.as-caption [data-studio="chapters"]').click(T);
   const chapters = await studio.locator('.as-chapter').evaluateAll(es => es.map(e => ({ value: e.dataset.value, text: e.textContent.trim() })));
   console.log(name, 'chapters:', chapters.map(c => c.text.replace(/\s+/g, ' ')).join(' | '));
   const go = async value => {
    const chapter = studio.locator(`.as-chapter[data-value="${value}"]`);
    if (!(await chapter.isVisible())) await studio.locator('.as-caption [data-studio="chapters"]').click(T);
    await chapter.click(T);
   };
   for (const c of chapters) {
    if (!new RegExp(process.env.ONLY || 'drawer|runner|lock|front', 'i').test(c.text)) continue;
    await go(c.value);
    // Most of the way through the chapter: the parts placed and fixed.
    const range = await studio.locator('.as-scrub').evaluate(e => ({ v: Number(e.value), max: Number(e.max) }));
    const next = chapters.find(x => Number(x.value) === Number(c.value) + 1);
    let end = range.max;
    if (next) { await go(next.value); end = Number(await studio.locator('.as-scrub').inputValue()); }
    for (const [k, at] of [[ 'a', .45 ], [ 'b', .9 ]]) {
     await studio.locator('.as-scrub').fill(String(Math.round(range.v + (end - range.v) * at)));
     await page.waitForTimeout(700);
     await page.screenshot({ path: `${shots}/${name}-${String(c.value).padStart(2, '0')}${k}.png` });
    }
   }
   console.log(name, 'errors:', errors.length ? errors : 'none');
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
