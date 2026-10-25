// Fixtures (toilets, basins) in the real editor, on a desktop with a mouse and a phone with touch: add a toilet from a
// selected wall's Add, see it fitted wall-hung in a half-height boxing, change how it is fitted (the boxing goes, the
// projection ruler follows), undo, slide it with the keys, type its seat height, change its finish, remove it with
// Delete and undo, then add a basin from Studio › Fixtures. Needs the dev server at 127.0.0.1:5173 (or MOBILE_TEST_URL).
// Screenshots go to docs/verification/studio-fixtures/ (or FIXTURE_SHOTS).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const shots=process.env.FIXTURE_SHOTS||path.join(__dirname,'..','docs','verification','studio-fixtures');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:5173';
// The middle of the back wall once the empty Bedroom is framed (fraction of the view).
const VIEWS=[{name:'desktop',width:1440,height:900,wall:[.5,.44]},{name:'phone',width:375,height:812,wall:[.5,.47]}];
fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const view of VIEWS) {
  const phone=view.width<=900;
  const page=await browser.newPage({viewport:{width:view.width,height:view.height},isMobile:phone,hasTouch:phone,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/editor.html');
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar');
  const tap=async locator=>{ if(phone) await locator.tap(); else await locator.click(); await page.waitForTimeout(350); };
  const shot=async name=>{ await page.waitForTimeout(400); await page.screenshot({path:path.join(shots,`${name}-${view.name}.jpg`),type:"jpeg",quality:80}); };
  const context=()=>toolbar.getAttribute('data-context');
  const actions=()=>toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action));
  const rulers=()=>page.locator('.room-label:visible').allTextContents();
  const steps=async()=>Number(await el('undo2').locator('small').textContent()||0);
  // A panel closes with its × on a desktop; on a phone its sheet is pulled down by the handle, as a finger does.
  const close=async()=>{
   if(await el('left-close').isVisible()) { await tap(el('left-close')); return; }
   const handle=el('left').locator('.mobile-sheet-handle');
   if(!(await handle.isVisible())) return;
   const h=await handle.boundingBox();
   await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
   for(let i=1;i<=10;i++){ await page.mouse.move(h.x+h.width/2,h.y+h.height/2+i*40); await page.waitForTimeout(16); }
   await page.mouse.up();await page.waitForTimeout(500);
  };
  await el('add-furniture-btn').waitFor();
  await page.waitForTimeout(600);

  // A room, then its back wall: Add › Fixtures › Toilet puts a toilet on that wall.
  await tap(page.getByRole('button',{name:'Studio'}).first());
  await tap(toolbar.locator('[data-action="new"]:visible').first());
  await tap(page.locator('[data-studio="bedroom"]:visible').first());
  await page.waitForTimeout(1200);
  const box=await el('view').boundingBox(), at={x:box.x+box.width*view.wall[0],y:box.y+box.height*view.wall[1]};
  if(phone) await page.touchscreen.tap(at.x,at.y); else await page.mouse.click(at.x,at.y);
  await page.waitForTimeout(500);
  assert.equal(await context(),'wall','the back wall is selected');
  await tap(toolbar.locator('[data-action="new"]'));
  await tap(page.locator('.mobile-add-categories [data-category="fixtures"]'));
  assert.equal(await page.locator('[data-add-fixture]:visible').count(),2,'a toilet and a basin to choose from');
  await shot('wall-add');
  const before=await steps();
  await tap(page.locator('[data-add-fixture="toilet"]:visible'));
  await page.waitForTimeout(900);
  assert.equal(await context(),'room-fixture','the new toilet is selected');
  assert.deepEqual(await actions(),['fixture-type','fixture-size','fixture-finish','more']);
  assert.equal(await steps(),before+1,'toilet and its boxing are one undo step');
  assert.ok((await rulers()).includes('73 cm'),'it stands 73 cm out: a 20 cm boxing and a 53 cm bowl: '+await rulers());
  await shot('toilet');

  // How it is fitted: five pictures, the boxing one chosen; in the wall, the boxing goes and it stands 53 cm out.
  await tap(toolbar.locator('[data-action="fixture-type"]'));
  assert.equal(await page.locator('[data-fixture-setup]:visible').count(),5);
  assert.equal(await page.locator('[data-fixture-setup][aria-pressed="true"]').getAttribute('data-fixture-setup'),'wall-hung');
  await shot('type');
  await tap(page.locator('[data-fixture-setup="wall-hung-in-wall"]'));
  assert.equal(await page.locator('[data-fixture-setup][aria-pressed="true"]').getAttribute('data-fixture-setup'),'wall-hung-in-wall');
  await close();
  assert.ok((await rulers()).includes('53 cm'),'without a boxing it stands 53 cm out: '+await rulers());
  await tap(el('undo2'));
  assert.ok((await rulers()).includes('73 cm'),'undo brings the boxing back');

  // Keys slide it along its wall, its boxing with it; each press is a step.
  const gaps=async()=>(await rulers()).filter(t=>t!=='73 cm');
  const was=await gaps(), step=await steps();
  await page.keyboard.press('Shift+ArrowRight');await page.waitForTimeout(250);
  assert.equal(await steps(),step+1);
  assert.notDeepEqual(await gaps(),was,'the gaps to the wall ends change');

  // Size: the seat height is typed; Finish: matt black ceramic.
  await tap(toolbar.locator('[data-action="fixture-size"]'));
  const seat=page.locator('[data-room-field="height"]');
  assert.equal(await seat.inputValue(),'42');
  await seat.fill('46');await seat.press('Enter');await page.waitForTimeout(300);
  assert.equal(await seat.inputValue(),'46');
  await shot('size');
  await close();
  await tap(toolbar.locator('[data-action="fixture-finish"]'));
  await tap(page.locator('[data-fixture-finish="ceramic:matt-black"]'));
  assert.equal(await page.locator('[data-fixture-finish="ceramic:matt-black"]').getAttribute('aria-pressed'),'true');
  await shot('finish');
  await close();

  // Delete removes it, undo brings it back.
  if(!phone) {
   await page.keyboard.press('Delete');await page.waitForTimeout(300);
   assert.notEqual(await context(),'room-fixture','removed');
   await tap(el('undo2'));
  }

  // Studio › Fixtures › Basin: on the wall in view, selected, beside the toilet.
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  await tap(toolbar.locator('[data-action="new"]:visible').first());
  await tap(page.locator('.mobile-add-categories [data-category="fixtures"]:visible'));
  await tap(page.locator('[data-add-fixture="basin"]:visible'));
  await page.waitForTimeout(900);
  assert.equal(await context(),'room-fixture','the basin is selected');
  await tap(toolbar.locator('[data-action="fixture-type"]'));
  await tap(page.locator('[data-fixture-type="vanity"]'));
  assert.equal(await page.locator('[data-fixture-type="vanity"]').getAttribute('aria-pressed'),'true');
  await close();
  await shot('basin');
  assert.deepEqual(errors,[],'no page errors');
  await page.close();
 } } finally { await browser.close(); }
 console.log('Studio fixtures: desktop and phone checks passed. Screenshots in',shots);
})().catch(e=>{ console.error(e); process.exit(1); });
