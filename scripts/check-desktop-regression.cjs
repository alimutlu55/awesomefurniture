// Desktop uses the same contextual controls and sheets as mobile. Start Vite separately.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseURL = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const el=id=>page.locator(`[data-editor-id="${id}"]`);
  const toolbar=el('toolbar');
  const action=key=>toolbar.locator(`.contextual-actions [data-action="${key}"]`);
  const menuItem=label=>page.locator('.contextual-popover [role="menuitem"]').filter({hasText:new RegExp(`^${label}$`)});
  const waitLayout=()=>page.waitForTimeout(450);
  const inBounds=async locator=>{
   const box=await locator.boundingBox(),size=page.viewportSize();
   assert.ok(box && box.x>=-1 && box.y>=-1 && box.x+box.width<=size.width+1 && box.y+box.height<=size.height+1,JSON.stringify({box,size}));
  };
  const closeSettings=async()=>{
   await el('left-close').click();
   await waitLayout();
   assert.equal(await el('left').isVisible(),false);
  };
  await page.goto(baseURL);await el('more-btn').waitFor();
  assert.equal(await el('props-btn').isVisible(),false);
  assert.equal(await el('left').isVisible(),false);
  const view=await el('view').boundingBox();
  await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);await waitLayout();
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
  assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),['move','resize','shape','sections','more']);
  await action('resize').click();await waitLayout();
  assert.equal(await toolbar.isVisible(),false,'Focused sizing hides the desktop toolbar');
  assert.equal(await el('view-modes').isVisible(),false);
  assert.equal(await el('topright').isVisible(),false);
  assert.equal(await el('left').isVisible(),true);
  const initialLeft=await el('left').boundingBox();
  assert.ok(initialLeft.x < 100, 'Desktop panel floats on the left side');
  assert.ok(initialLeft.width <= 360, 'Desktop panel has compact sidebar width');
  const original=await el('w').inputValue();
  await el('w').fill('210');await el('w').press('Tab');
  assert.equal(await el('w-range').inputValue(),'210');
  // Resizing an open panel must retain its values, ownership and selection.
  for(const width of [900,901,390,1440,1920]) {
   await page.setViewportSize({width,height:900});await waitLayout();
   assert.equal(await el('w').inputValue(),'210');
   assert.equal(await el('left').evaluate(e=>e.parentElement.dataset.editorId),'app');
   assert.equal(await el('left').getAttribute('data-context-section'),'resize');
   if(width<=900) {
    assert.equal(await toolbar.isVisible(),false);
    const canvas=await el('view').boundingBox(),sheet=await el('left').boundingBox();
    assert.ok(canvas.y+canvas.height<=sheet.y+1,'Mobile settings leave the canvas unobstructed');
   } else {
    assert.equal(await toolbar.isVisible(),false,'Focused sizing remains distraction free at desktop widths');
    const sheet=await el('left').boundingBox();
    assert.ok(sheet.x < 100, 'Desktop panel is on the left');
    assert.ok(sheet.width <= 360, 'Desktop panel is compact');
   }
   await inBounds(el('left'));
  }
  await closeSettings();
  assert.equal(await toolbar.isVisible(),true);
  assert.equal(await el('view-modes').isVisible(),true);
  assert.equal(await el('topright').isVisible(),true);
  await page.keyboard.press('ControlOrMeta+z');await waitLayout();
  await action('resize').click();await waitLayout();assert.equal(await el('w').inputValue(),original);await closeSettings();
  await action('sections').click();await waitLayout();
  await el('sec-plus').click();assert.equal((await el('section-count').textContent()).trim(),'2');await closeSettings();
  await action('shape').click();await waitLayout();
  assert.equal(await el('topright').isVisible(),false);
  await page.screenshot({path:'/tmp/focused-shape-desktop.png'});
  assert.equal(await page.locator('[data-wardrobe-controls="shape"]').isVisible(),true);await closeSettings();
  await action('more').click();await menuItem('Material').click();await waitLayout();assert.equal(await el('fins').isVisible(),true);await closeSettings();
  await action('more').click();await menuItem('Doors').click();await waitLayout();assert.equal(await page.locator('[data-wardrobe-controls="doors"]').isVisible(),true);await closeSettings();
  await action('more').click();await menuItem('Duplicate').click();await waitLayout();assert.equal(await el('wardrobe-select').locator('option').count(),2);
  await action('more').click();await menuItem('Remove').click();await waitLayout();assert.equal(await el('wardrobe-select').locator('option').count(),1);
  await el('undo2').click();assert.equal(await el('wardrobe-select').locator('option').count(),2);
  await el('redo2').click();assert.equal(await el('wardrobe-select').locator('option').count(),1);
  await el('more-btn').evaluate(e=>e.click());await waitLayout();
  assert.equal(await page.locator('.mobile-add-browser').isVisible(),true);
  await page.locator('.mobile-add-categories [data-category="hanging"]').click();
  assert.equal(await page.locator('.mobile-add-products [data-m="short"]').isVisible(),true);
  await el('px').click();await waitLayout();
  const zoom=await el('zoom-val').textContent(),canvas=await el('view').boundingBox();
  await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.2);await page.mouse.wheel(0,-200);await waitLayout();
  assert.notEqual(await el('zoom-val').textContent(),zoom,'Mouse wheel still zooms');
  // Studio keeps the same named tools and catalogue on a desktop.
  await page.locator('[data-view-mode="studio"]').click();await waitLayout();
  assert.equal(await toolbar.getAttribute('data-context'),'studio');
  await action('walls').click();await waitLayout();
  assert.equal(await page.locator('.mobile-add-products [data-studio="bedroom"]').isVisible(),true);
  await page.locator('.mobile-add-products [data-studio="bedroom"]').click();await waitLayout();
  assert.equal(await el('pop2').isVisible(),false);
  assert.equal(await toolbar.isVisible(),true);
  await page.locator('[data-view-mode="furniture"]').click();await waitLayout();
  await el('launch-wizard').click();
  const apply=page.locator('.idea button.apply').first();await apply.waitFor({timeout:30000});
  await apply.click();await waitLayout();assert.equal(await el('wizard').isVisible(),false);
  assert.equal(await el('undo2').isEnabled(),true);await el('undo2').click();await el('redo2').click();
  await page.screenshot({path:'/tmp/wardrobe-shared-desktop.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS desktop: shared sheets, 900/901 boundary, selection, sizes, keyboard undo, shape, materials, doors, duplicate/remove, history, catalogue, wheel zoom, Studio and applying Auto design');
  await page.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
