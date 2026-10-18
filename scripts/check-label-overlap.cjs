// No measurement sits on a control or on another measurement, with kitchen units added and selected, on a phone and a desktop.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
/** Run in the page: pairs of visible measurements and controls (or two measurements) whose boxes overlap. */
const audit=()=>{const h=[...document.querySelectorAll('*')].find(x=>x.shadowRoot).shadowRoot;
 const vis=e=>e.offsetParent!==null&&getComputedStyle(e).display!=='none'&&!e.hidden,box=e=>e.getBoundingClientRect();
 const meas=[...h.querySelectorAll('.lbl.dim')].filter(vis);
 const ctl=[...h.querySelectorAll('.item-resize-handle:not([hidden]), .lbl.add, .lbl.array-grip, .lbl.shape-handle, .ground-rotate, [data-editor-id="toolbar"], [data-editor-id="view-modes"], [data-editor-id="topright"], [data-editor-id="topleft"]')].filter(vis);
 const hit=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom,out=[];
 for(const m of meas){const a=box(m);if(!a.width)continue;
  for(const c of ctl){const b=box(c);if(b.width&&hit(a,b))out.push(m.textContent.trim()+' on '+String(c.className.baseVal??c.className)+' '+(c.dataset.editorId||''));}
  for(const n of meas){if(n!==m&&m.compareDocumentPosition(n)&4){const b=box(n);if(b.width&&hit(a,b))out.push(m.textContent.trim()+' on '+n.textContent.trim());}}}
 return out;};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:width<500,isMobile:width<500,reducedMotion:'reduce'});
  page.setDefaultTimeout(8000);
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  await page.goto(base+'/');
  const el=id=>page.locator(`[data-editor-id="${id}"]`);await el('view').waitFor();await page.waitForTimeout(1200);
  const problems=[];
  for(const kind of ['base','upper','oven-tower','sink','upper']){
   await page.locator('[data-editor-id="add-furniture-btn"]:visible, [data-editor-id="toolbar"] [data-action="new"]:visible').first().click();await page.waitForTimeout(400);
   await page.getByRole('button',{name:/Cabinets/}).first().click().catch(()=>{});await page.waitForTimeout(250);
   await page.locator(`[data-add-kitchen="${kind}"]:visible`).first().click();await page.waitForTimeout(900);
   problems.push(...(await page.evaluate(audit)).map(p=>kind+': '+p));
  }
  const v=await el('view').boundingBox();
  for(const [x,y] of [[.5,.5],[.5,.62],[.45,.4]]){await page.mouse.click(v.x+v.width*x,v.y+v.height*y);await page.waitForTimeout(450);problems.push(...(await page.evaluate(audit)).map(p=>'tap: '+p));}
  assert.deepEqual(problems,[],`${width}px: measurements overlap controls`);console.log(`PASS ${width}px: no measurement overlaps a control or another measurement`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
