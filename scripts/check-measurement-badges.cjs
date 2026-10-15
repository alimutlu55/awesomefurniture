const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
  const el=id=>page.locator(`[data-editor-id="${id}"]`),report=()=>page.evaluate(()=>window.wardrobeForge.describe());
  const load=async spec=>{await page.goto('about:blank');await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));await el('view').waitFor();await page.waitForTimeout(700);};
  const exact=async(badge,value,cancel=false)=>{
   const id=await badge.getAttribute('data-measurement-badge');
   if(width===375)await badge.tap();else await badge.click();const input=el('labels').locator(`[data-measurement-badge="${id}"] input`);await input.waitFor();await page.waitForTimeout(300);
   await input.fill(String(value));await input.press(cancel?'Escape':'Enter');await page.waitForTimeout(250);
   assert.equal(await input.count(),0,'Exact entry closes cleanly');
   assert.equal(await el('app').getAttribute('data-scrubbing'),null);
  };
  const keyboard=async(badge,key)=>{await badge.focus();await page.keyboard.press(key);await page.waitForTimeout(200);};
  const drag=async(badge,dx,dy=0,cancel=false)=>{
   const b=await badge.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.waitForTimeout(120);
   assert.ok(await el('app').getAttribute('data-scrubbing'),'Badge owns the gesture');
   if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(250);
  };
  await load({specVersion:1,wardrobes:[{width:200,height:230,depth:60}]});
  const w=page.locator('.scrub-w:visible');await exact(w,211.5);assert.equal((await report()).wardrobes[0].width,211.5);
  await exact(w,220,true);assert.equal((await report()).wardrobes[0].width,211.5);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(200);assert.equal((await report()).wardrobes[0].width,200);
  // Add and select a real fitting through the existing UI and scene hit testing.
  await page.locator('.lbl.add:visible').first().click();await page.waitForTimeout(300);
  await el('pop2').locator('[data-m="short"]').first().click();await page.waitForTimeout(350);
  select:for(const y of [.6,.55,.65,.5,.75,.8,.4,.3])for(const x of [.5,.35,.45,.6,.65]){
   const b=await el('view').boundingBox();await page.mouse.click(b.x+b.width*x,b.y+b.height*y);
   if(await el('toolbar').getAttribute('data-context')==='item')break select;
  }
  await page.waitForTimeout(400);
  const item=page.getByRole('slider',{name:'Item height',exact:true});await item.waitFor();
  const old=Number(await item.getAttribute('aria-valuenow'));
  await drag(item,0,12);assert.equal(Number(await item.getAttribute('aria-valuenow')),old-4);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.equal(Number(await item.getAttribute('aria-valuenow')),old);
  await exact(item,old-5);assert.equal(Number(await item.getAttribute('aria-valuenow')),old-5);
  const gap=page.getByRole('slider',{name:'Distance below item',exact:true});const gapBefore=Number(await gap.getAttribute('aria-valuenow'));
  await keyboard(gap,'ArrowUp');assert.equal(Number(await gap.getAttribute('aria-valuenow')),gapBefore+1);
  await drag(gap,0,-20,true);assert.equal(Number(await gap.getAttribute('aria-valuenow')),gapBefore+1);
  await gap.blur();await page.screenshot({path:'/tmp/wardrobe-shared-badges-'+width+'.png'});console.log(`PASS ${width}px: cabinet, item and gap controls`);
  // Select a Studio wall via real hit testing, then exercise the same component.
  await load({specVersion:1,room:{width:300,depth:250,height:270},wardrobes:[]});
  await page.locator('[data-view-mode="studio"]').click();await page.waitForTimeout(350);
  const wall=page.getByRole('slider',{name:'Wall length',exact:true});
  selectWall:for(const y of [.4,.3,.5,.6,.25])for(const x of [.5,.35,.65,.25,.75]){
   const b=await el('view').boundingBox();await page.mouse.click(b.x+b.width*x,b.y+b.height*y);
   if(await wall.count())break selectWall;
  }
  await wall.waitFor();await page.waitForTimeout(400);const length=Number(await wall.getAttribute('aria-valuenow'));
  await exact(wall,length+10);assert.equal(Number(await wall.getAttribute('aria-valuenow')),length+10);
  await keyboard(wall,'ArrowLeft');assert.equal(Number(await wall.getAttribute('aria-valuenow')),length+9);
  await drag(wall,40);assert.equal(Number(await wall.getAttribute('aria-valuenow')),length+23);
  await page.keyboard.press('ControlOrMeta+z');await page.waitForTimeout(250);assert.equal(Number(await wall.getAttribute('aria-valuenow')),length+9);
  await drag(wall,40,0,true);assert.equal(Number(await wall.getAttribute('aria-valuenow')),length+9);
  await page.screenshot({path:'/tmp/wardrobe-shared-studio-'+width+'.png'});
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: shared cabinet, item, clearance and Studio badges; drag, keyboard, exact entry, cancel and undo`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
