// The drawings fail closed in the real viewer: a design with a clash says NOT FOR MANUFACTURE above the sheets, on the
// button and in the saved PDF, and ends with the Manufacturing check; a sound design is released for manufacture.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
// Text in the PDF is written as hex glyph codes (helvetica-metrics.ts): ASCII here.
const hex = text => '<' + [...text].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('') + '>';

(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
 try {
  for (const width of [1440, 375]) for (const clash of [true, false]) {
   const page = await browser.newPage({ viewport: { width, height: 812 }, hasTouch: true, isMobile: width === 375, acceptDownloads: true, reducedMotion: 'reduce' });
   page.setDefaultTimeout(15000);
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route(base + '/release-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id="editor"></div></body></html>' }));
   await page.goto(base + '/release-fixture');
   await page.evaluate(async clash => {
    const { mountEditor } = await import('/src/presentation/editor/mount-editor.ts');
    const { createEditorState } = await import('/src/application/projects/editor-state.ts');
    window.releaseEditor = mountEditor({ root: document.querySelector('#editor'), initialScene: { activeWardrobe: 1, nextWardrobeId: 3, wardrobes: [
     { id: 1, name: 'W1', x: 0, y: 0, z: 0, angle: 0, state: createEditorState() },
     { id: 2, name: 'W2', x: clash ? 80 : 260, y: 0, z: 0, angle: 0, state: createEditorState() }] } });
   }, clash);
   await page.getByRole('button', { name: 'Menu', exact: true }).click();
   await page.getByRole('menuitem', { name: 'Technical drawings', exact: true }).click();
   const dialog = page.getByRole('dialog', { name: 'Technical drawings', exact: true }), banner = dialog.locator('.drawings-release'), save = dialog.locator('.drawings-pdf');
   await dialog.locator('img').first().waitFor();
   const titles = await dialog.locator('img').evaluateAll(images => images.map(img => img.alt));
   assert.match(titles.at(-1), /Manufacturing check$/, 'the set ends with the Manufacturing check');
   if (clash) {
    assert.equal(await banner.isVisible(), true, 'the banner says it may not be used');
    assert.match(await banner.textContent(), /Not for manufacture: 1 blocking finding\. W1 and W2 are in the same place/);
    assert.equal(await save.textContent(), 'Save review PDF');
   } else {
    assert.equal(await banner.isVisible(), false);
    assert.equal(await save.textContent(), 'Save as PDF');
   }
   if (width === 1440) {
    const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
    const pdf = require('node:fs').readFileSync(await download.path(), 'latin1');
    assert.equal(pdf.includes(hex('NOT FOR MANUFACTURE')), clash, clash ? 'the saved file is stamped' : 'a sound set is not stamped');
    // The quiet stamp runs on ("For manufacture · revision …"): look for its start, without the closing bracket.
    assert.equal(pdf.includes(hex('For manufacture ').slice(0, -1)), !clash, 'a sound set says For manufacture');
   }
   await page.screenshot({ path: `/tmp/wardrobe-drawing-release-${width}-${clash ? 'blocked' : 'ready'}.png` });
   assert.deepEqual(errors, []);
   console.log(`PASS ${width}px ${clash ? 'clash: NOT FOR MANUFACTURE banner, button, last sheet' + (width === 1440 ? ' and saved PDF' : '') : 'sound design: released for manufacture'}`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
