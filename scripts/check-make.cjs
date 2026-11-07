// Make on a phone and a desktop: it opens in the editor's own toolbar and panel, the camera still turns, every tab
// works and fits, the joint choice is one undo step, and Done gives the editor back.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const BASE=process.env.MOBILE_TEST_URL || 'http://127.0.0.1:5173';
// A hand-made design the drilling check finds fault with (a drawer's runner screwed to a short divider, 0.5 mm off its
// top edge), sent to the editor as a share link built by the app's own code.
const findingLink=()=>execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`
 import { buildFromSpec } from './src/application/spec/build-from-spec.ts';
 import { projectToScene } from './src/application/projects/editor-mapper.ts';
 import { designLink } from './src/app/design-link.ts';
 const built = buildFromSpec({ specVersion: 1, wardrobes: [{ width: 154, height: 230, depth: 56, autoDesign: false }] }, 'drilling');
 const scene = projectToScene(built.project), w = scene.wardrobes[0];
 Object.assign(w.state, { n: 2, wt: [1, 1, 1, 1, 1, 1], doors: 'none', construction: { joints: 'dowel', back: 'grooved' },
  // The divider stops where the shelves over the basket are dowelled into it: their holes run out at its top edge.
  dividers: [{ i: 0, orientation: 'vertical', x: 59, y0: 0, y1: 55 }], secs: [
  [{ k: 'shoe', h: 14 }, { k: 'basket', h: 42 }, { k: 'drawer', h: 12 }], [{ k: 'folded', h: 30 }, { k: 'shelf', h: 40 }, { k: 'long', h: 13 }], [], [], [], []] });
 process.stdout.write(await designLink(scene, ${JSON.stringify(BASE+'/editor.html')}));`],{encoding:'utf8'});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try { for(const [width,height] of [[375,812],[1280,800]]) {
  const phone=width<=900, page=await browser.newPage({viewport:{width,height},isMobile:phone,hasTouch:phone,reducedMotion:'reduce'});
  page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/#spec='+encodeURIComponent(JSON.stringify({specVersion:1,wardrobes:[{width:200,height:230,depth:60,for:{long:6,short:10,shoes:8}}]})));
  const el=id=>page.locator(`[data-editor-id="${id}"]`), toolbar=el('toolbar');
  await el('add-furniture-btn').waitFor();
  await page.waitForTimeout(800);
  const view=await el('view').boundingBox();
  await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);
  await page.waitForTimeout(350);
  if(await toolbar.getAttribute('data-context')!=='wardrobe') await page.screenshot({path:`/tmp/make-select-${width}.png`});
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
  await toolbar.locator('[data-action="make"]').click();
  await page.waitForTimeout(400);
  if(await toolbar.getAttribute('data-context')!=='make') await page.screenshot({path:`/tmp/make-open-${width}.png`});
  assert.equal(await toolbar.getAttribute('data-context'),'make');
  assert.deepEqual(await toolbar.locator('.contextual-actions [data-action]').evaluateAll(es=>es.map(e=>e.dataset.action)),
   ['make-done','make-assembly','make-fronts','make-measures','make-view','make-parts']);
  const fits=async what=>{
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,what+': no sideways scroll');
   for(const b of await toolbar.locator('button.tb:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right];})))
    assert.ok(b[0]>=0 && b[1]<=width,what+': toolbar inside the screen');
  };
  await fits('Make');
  assert.ok(await page.locator('.make-overlay .make-measure').count()>3,'Every measurement is on show');
  // The camera is the editor's: a drag on the view turns it, and nothing in the design moves.
  const before=await page.locator('.make-overlay').innerHTML();
  await page.mouse.move(view.x+view.width*.6,view.y+view.height*.4);await page.mouse.down();
  await page.mouse.move(view.x+view.width*.4,view.y+view.height*.35,{steps:6});await page.mouse.up();
  await page.waitForTimeout(250);
  assert.notEqual(await page.locator('.make-overlay').innerHTML(),before,'Dragging turns the view');
  assert.equal(await toolbar.getAttribute('data-context'),'make');
  // Parts, then each tab.
  await toolbar.locator('[data-action="make-parts"]').click();
  const panel=page.locator('.make-panel');
  await panel.waitFor({state:'visible'});
  for(const tab of ['parts','hardware','cutting']) {
   await panel.locator(`[data-tab="${tab}"]`).click();
   assert.equal(await panel.locator(`[data-tab="${tab}"]`).getAttribute('aria-pressed'),'true');
   const box=await panel.locator('.make-tabs').boundingBox();
   assert.ok(box.x>=0 && box.x+box.width<=width,tab+': tabs inside the screen');
   await fits(tab);
  }
  // The old embedded player is a shortcut into the dedicated, shared-canvas Studio.
  await panel.locator('[data-assembly]').click();
  await page.locator('.assembly-studio').waitFor({state:'visible'});
  await page.locator('[data-studio="exit"]').click();
  await panel.waitFor({state:'visible'});
  await panel.locator('[data-tab="cutting"]').click();
  assert.ok(await panel.locator('.make-stock').count()>=1,'The parts are laid out on stock sheets');
  await panel.locator('[data-tab="hardware"]').click();
  await panel.locator('[data-joints="cam"]').click();
  assert.equal(await panel.locator('[data-joints="cam"]').getAttribute('aria-pressed'),'true');
  await panel.locator('[data-tab="parts"]').click();
  await panel.locator('.make-row').nth(1).click();
  assert.ok(await panel.locator('.mk-ps-hole').count()>0,'A part shows its holes');
  await page.screenshot({path:`/tmp/make-${width}.png`});
  // Done gives the editor back, and the joint choice undoes in one step.
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
  await el('undo2').click();
  await toolbar.locator('[data-action="make"]').click();
  await toolbar.locator('[data-action="make-parts"]').click();
  await panel.locator('[data-tab="hardware"]').click();
  assert.equal(await panel.locator('[data-joints="confirmat"]').getAttribute('aria-pressed'),'true','Undo puts the joints back');
  // The panel's × closes it (on a phone its sheet covers the toolbar), then Done.
  await panel.locator('.make-close').click();
  await page.waitForTimeout(350);
  await toolbar.locator('[data-action="make-done"]').click();
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe');
  // A drilling finding names its part and the problem; tapping it picks that part.
  await page.goto(findingLink());
  await el('add-furniture-btn').waitFor();
  await page.waitForTimeout(1200);
  const linkView=await el('view').boundingBox();
  for(const [fx,fy] of [[.5,.45],[.5,.55],[.4,.5],[.5,.35]]) {
   if(await toolbar.getAttribute('data-context')==='wardrobe') break;
   // A fitting picked through the doors goes back up to its wardrobe.
   if(await toolbar.getAttribute('data-context')==='item') { await page.keyboard.press('Escape'); await page.waitForTimeout(250); continue; }
   await page.mouse.click(linkView.x+linkView.width*fx,linkView.y+linkView.height*fy); await page.waitForTimeout(350);
  }
  if(await toolbar.getAttribute('data-context')!=='wardrobe') await page.screenshot({path:`/tmp/make-finding-select-${width}.png`});
  assert.equal(await toolbar.getAttribute('data-context'),'wardrobe','The shared wardrobe is selected');
  await toolbar.locator('[data-action="make"]').click();
  await toolbar.locator('[data-action="make-parts"]').click();
  await panel.locator('[data-tab="hardware"]').click();
  const finding=panel.locator('.make-check.bad').first();
  await finding.waitFor();
  const n=await finding.getAttribute('data-n'), row=(await finding.innerText()).replace(/\s+/g,' ').trim();
  assert.match(row,new RegExp('^!? ?'+n+' [A-Z][a-z]+( [a-z]+)* [A-Z][a-z]+( [a-z]+)* · \\d+(\\.\\d)? mm$'),'The row names the part and the problem: '+row);
  assert.doesNotMatch(row,/−|-\d/,'No minus sign: '+row);
  await finding.click();
  await page.waitForTimeout(700);
  assert.match(await panel.locator('.make-title').innerText(),new RegExp('^'+n+' · '),'Tapping the finding picks its part');
  await page.screenshot({path:`${process.env.SHOTS||'/tmp'}/make-finding-${width}.png`});
  assert.deepEqual(errors,[]);
  await page.close();
 } } finally { await browser.close(); }
 console.log('Make checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
