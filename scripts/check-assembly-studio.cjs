// Real browser regression: one canvas, seekable playback, gestures, navigation and editor restoration.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
// WCAG contrast of the studio's ink seen at `alpha` over its lightest surface (the panel colour): faded controls keep 3:1.
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const over = (fg, bg, alpha) => '#' + [1, 3, 5].map(i => Math.round(parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const INK = '#25231f', SURFACE = '#fbf8f2';
/** Where the piece is on screen: the box round the drawing's ink, with the editor's controls and Make's measurements
 * hidden for the shot (their labels move about; the piece is what must stay put). */
async function pieceBounds(page) {
  const hidden = page.locator('[data-editor-id="toolbar"], .fl, .make-overlay, .make-panel');
  await hidden.evaluateAll(es => es.forEach(e => { e.dataset.shot = e.style.visibility; e.style.visibility = 'hidden'; }));
  await page.waitForTimeout(100);
  const png = (await page.screenshot()).toString('base64');
  await hidden.evaluateAll(es => es.forEach(e => { e.style.visibility = e.dataset.shot; delete e.dataset.shot; }));
  return page.evaluate(async data => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data, r = devicePixelRatio || 1;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11 < 150) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    return [x0 / r, y0 / r, x1 / r, y1 / r];
  }, png);
}
(async () => {
 const engine = process.env.STUDIO_BROWSER === 'webkit' ? webkit : chromium;
 const browser = await engine.launch({ headless: true, ...(process.env.CHROME_PATH && engine === chromium ? { executablePath: process.env.CHROME_PATH } : {}) });
 try { for (const [width, height] of (process.env.STUDIO_LANDSCAPE ? [[844,390]] : [[390,844],[1280,900],[844,390]])) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, reducedMotion:'reduce' });
  page.setDefaultTimeout(15000);
  try {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = (process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173') + '/#spec=' + encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60,for:{long:6,short:10,shoes:8}}]}));
  await page.goto(url);
  const el = id => page.locator(`[data-editor-id="${id}"]`), toolbar = el('toolbar');
  await el('add-furniture-btn').waitFor(); await page.waitForTimeout(1000);
  const view = await el('view').boundingBox();
  await page.mouse.click(view.x + view.width / 2, view.y + view.height * .45);
  await page.waitForTimeout(350);
  const designBefore = await page.evaluate(()=>window.furnidraw.describe());
  await toolbar.locator('[data-action="make"]').click();
  await toolbar.locator('[data-action="make-assembly"]').click();
  const studio = page.locator('.assembly-studio'), action = name => studio.locator(`[data-studio="${name}"]`);
  await studio.waitFor({state:'visible'});
  assert.equal(await el('app').evaluate(e=>e.querySelectorAll('canvas').length),1, 'reuses one WebGL canvas');
  assert.equal(await toolbar.evaluate(e=>e.inert),true,'editing controls are inert');
  await studio.locator('.as-scrub').fill('800');
  assert.ok(Number(await studio.locator('.as-scrub').inputValue()) > 799);
  await studio.locator('.as-caption [data-studio="chapters"]').click();
  assert.ok(await studio.locator('.as-chapter').count()>3);
  await studio.locator('.as-chapter[data-value="1"]').click();
  assert.match(await studio.locator('.as-step-count').textContent(), /^2 \/ /);
  await action('next').click();
  assert.match(await studio.locator('.as-step-count').textContent(), /^3 \/ /);
  await action('guide').click();
  assert.ok(await studio.locator('.as-guide .as-required').count());
  await action('connection').click(); await page.waitForTimeout(300);
  await page.screenshot({path:`/tmp/assembly-connection-${width}.png`});
  await action('guide').click();
  const before = Number(await studio.locator('.as-scrub').inputValue());
  await action('mode').click();
  await studio.locator('[data-studio="mode"][aria-pressed="true"]').waitFor();
  await page.mouse.move(view.x+view.width*.6,view.y+view.height*.3);await page.mouse.down();
  await page.mouse.move(view.x+view.width*.4,view.y+view.height*.27,{steps:8});await page.mouse.up();
  if (width < 900 && engine === chromium) {
   const client = await page.context().newCDPSession(page);
   const touches = spread => [{x:width*.3-spread,y:height*.35,id:1},{x:width*.3+spread,y:height*.35,id:2}];
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(25)});
   for (const spread of [30,40,50,60]) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(spread)});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await client.detach();
  }
  await page.waitForTimeout(200);
  assert.equal(Number(await studio.locator('.as-scrub').inputValue()), before, 'orbit preserves the exact playhead');
  await action('mode').click();
  await action('reverse').click(); await page.waitForTimeout(800); await action('play').click();
  assert.ok(Number(await studio.locator('.as-scrub').inputValue()) < before,'reverse moves backwards');
  await studio.locator('.as-scrub').fill('1000'); await page.waitForTimeout(300);
  await studio.locator('.as-caption [data-studio="chapters"]').click();
  await page.screenshot({path:`/tmp/assembly-chapters-${width}.png`});
  await studio.locator('.as-chapters [data-studio="chapters"]').click(); await page.waitForTimeout(500);
  await page.screenshot({path:`/tmp/assembly-studio-${width}.png`});
  await action('mode').click();
  await page.mouse.click(width*(height<600 ? .27 : .5), height*.38);
  await studio.locator('.as-inspector:not([hidden])').waitFor();
  await action('deselect').click(); await action('mode').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'no sideways page scroll');
  for (const box of await studio.locator('.as-console button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(); return [r.left,r.right,r.height];}))) {
   assert.ok(box[0]>=0 && box[1]<=width,'controls stay on screen'); assert.ok(box[2]>=44,'touch targets are at least 44px');
  }
  if (width === 390) {
   await studio.locator('.as-scrub').fill('100');
   await action('reverse').click(); // back to forward
   await page.mouse.click(width*.5,height*.35); // removes button focus, reveals on canvas tap
   await page.waitForTimeout(4800);
   assert.equal(await studio.evaluate(e=>e.classList.contains('as-quiet')),true,'playback controls fade');
   await page.waitForTimeout(450);
   const faded = Number(await studio.locator('.as-bottom').evaluate(e=>getComputedStyle(e).opacity));
   assert.ok(contrast(over(INK, SURFACE, faded), SURFACE) >= 3, 'faded controls keep 3:1 contrast: opacity ' + faded);
   assert.equal(await studio.locator('.as-bottom').evaluate(e=>getComputedStyle(e).visibility),'visible','faded controls stay on screen');
   await action('play').click();
  }
  await page.goBack(); await studio.waitFor({state:'hidden'});
  assert.equal(await toolbar.getAttribute('data-context'),'make');
  await page.goForward(); await studio.waitFor({state:'visible'});
  await action('exit').click(); await studio.waitFor({state:'hidden'}); await page.waitForTimeout(200);
  await toolbar.locator('[data-action="make-parts"]').click();
  const panel = page.locator('.make-panel');
  assert.deepEqual(await panel.locator('[data-tab]').evaluateAll(es=>es.map(e=>e.dataset.tab)),['parts','hardware','cutting']);
  await panel.locator('[data-tab="hardware"]').click();
  await panel.locator('[data-hardware]').first().click(); await studio.waitFor({state:'visible'});
  await action('exit').click(); await panel.waitFor({state:'visible'});await page.waitForTimeout(200);
  await panel.locator('[data-tab="parts"]').click(); await panel.locator('[data-n]').first().click();
  await panel.locator('[data-assembly-part]').click();await studio.waitFor({state:'visible'});
  await action('guide').click(); await studio.locator('[data-studio="part"]').first().click();
  assert.equal(await studio.locator('.as-inspector').isVisible(),true);
  await page.screenshot({path:`/tmp/assembly-explore-${width}.png`});
  await action('exit').click();await panel.waitFor({state:'visible'});await page.waitForTimeout(200);
  assert.equal(await panel.locator('[data-assembly-part]').count(),1,'returns to the selected part');
  await panel.locator('.make-close').click();await page.waitForTimeout(350);
  // A button held down shows it is pressed before the click lands.
  const holdShowsPressed = async (button, what) => {
   await button.scrollIntoViewIfNeeded();
   const box = await button.boundingBox();
   await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await page.waitForTimeout(150);
   const rest = await button.evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.mouse.down(); await page.waitForTimeout(32);
   const held = await button.evaluate(e=>getComputedStyle(e).backgroundColor);
   await page.mouse.up(); await page.waitForTimeout(400);
   assert.notEqual(held, rest, what + ' looks pressed while held');
  };
  await holdShowsPressed(toolbar.locator('[data-action="make-parts"]'), 'a toolbar button');
  await panel.waitFor({state:'visible'});
  await holdShowsPressed(panel.locator('.make-back:visible, [data-tab="cutting"]').first(), 'a panel button');
  await panel.locator('.make-close').click(); await page.waitForTimeout(350);
  // Escape gives Make back framed as it was before Studio opened.
  await page.waitForTimeout(500);
  const framed = await pieceBounds(page);
  await toolbar.locator('[data-action="make-assembly"]').click(); await studio.waitFor({state:'visible'}); await page.waitForTimeout(800);
  // While the film plays and its camera glides between shots.
  if (await action('play').getAttribute('data-playing') !== 'true') await action('play').click();
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape'); await studio.waitFor({state:'hidden'}); await page.waitForTimeout(900);
  const back = await pieceBounds(page);
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(back[k] - framed[k]) <= (k % 2 ? height : width) * .02, 'the piece is framed as before Studio: ' + framed.map(Math.round) + ' → ' + back.map(Math.round));
  await toolbar.locator('[data-action="make-done"]').click();
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
  assert.deepEqual(await page.evaluate(()=>window.furnidraw.describe()), designBefore, 'Studio never changes the design');
  assert.deepEqual(errors,[]);
  console.log(`Assembly Studio ${process.env.STUDIO_BROWSER || 'chromium'} ${width}×${height} passed`);
  } catch (error) { await page.screenshot({path:`/tmp/assembly-failure-${process.env.STUDIO_BROWSER || 'chromium'}-${width}.png`}); throw error; }
  await page.close();
 } } finally { await browser.close(); }
})().catch(e=>{ console.error(e);process.exit(1); });
