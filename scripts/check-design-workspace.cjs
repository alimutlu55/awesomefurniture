const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdirSync}=require('node:fs');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
const output='docs/verification/design-workspace';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];
 await context.route('https://*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',body:'{}'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 const back=()=>page.getByRole('button',{name:'Back to your designs',exact:true});
 const library=()=>page.locator('#design-library');
 const row=name=>library().getByRole('button',{name:'Open '+name,exact:true});
 const choose=name=>library().getByRole('button',{name:'Select '+name,exact:true});
 const input=()=>library().getByRole('textbox',{name:'Design name',exact:true});
 const dialog=()=>library().getByRole('dialog');
 const snapshot=()=>page.evaluate(()=>window.wardrobeForge.describe());
 const create=async name=>{await library().getByRole('button',{name:'New design',exact:true}).first().click();await input().fill(name);await dialog().getByRole('button',{name:'Create design',exact:true}).click();await back().waitFor();};
 try{
  const spec={specVersion:1,room:{template:'bedroom'},wardrobes:[{against:1,width:240,for:{short:20,shoes:10}}]};
  await page.goto(base+'/#spec='+encodeURIComponent(JSON.stringify(spec)));await back().waitFor();
  assert.equal((await snapshot()).wardrobes.length,1);
  const originalId=new URL(page.url()).searchParams.get('session');assert.ok(originalId);
  await back().click();await library().getByRole('heading',{name:'Your designs',exact:true}).waitFor();
  await library().getByRole('button',{name:'Select',exact:true}).click();await choose('Untitled design').click();
  await library().getByRole('button',{name:'Rename',exact:true}).click();await input().fill('  ');
  assert.ok(await dialog().getByRole('button',{name:'Save name',exact:true}).isDisabled());
  await input().fill('Bedroom · Oak');await dialog().getByRole('button',{name:'Save name',exact:true}).click();
  await choose('Bedroom · Oak').waitFor();
  await library().getByRole('button',{name:'Duplicate',exact:true}).click();await choose('Bedroom · Oak · Copy').waitFor();
  await library().getByRole('button',{name:'Done',exact:true}).click();
  await create('Hallway storage');assert.equal((await snapshot()).wardrobes.length,0);
  await page.keyboard.press('ControlOrMeta+z');assert.equal((await snapshot()).wardrobes.length,0,'Undo cannot restore another design');
  await page.locator('[data-editor-id="add-furniture-btn"]').click();await page.getByRole('button',{name:'Regular',exact:true}).click();
  await page.waitForTimeout(350);assert.equal((await snapshot()).wardrobes.length,1);
  await back().click();await row('Hallway storage').waitFor();
  await row('Bedroom · Oak').click();await back().waitFor();assert.equal((await snapshot()).wardrobes.length,1);
  await page.keyboard.press('ControlOrMeta+z');assert.equal((await snapshot()).wardrobes.length,1,'Opened design has fresh history');
  await page.goBack();await row('Bedroom · Oak').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('view'),'designs');
  await page.reload();await row('Bedroom · Oak').waitFor();
  assert.equal(await library().locator('.design').count(),3,'reload does not create a fourth record');
  mkdirSync(output,{recursive:true});
  await page.screenshot({path:output+'/mobile-library.png'});
  await library().getByRole('button',{name:'Select',exact:true}).click();await choose('Bedroom · Oak').click();
  await page.screenshot({path:output+'/mobile-manage.png'});
  await library().getByRole('button',{name:'Rename',exact:true}).click();await page.screenshot({path:output+'/mobile-rename.png'});
  await dialog().getByRole('button',{name:'Cancel',exact:true}).click();await library().getByRole('button',{name:'Done',exact:true}).click();
  await row('Bedroom · Oak').click();await back().waitFor();await page.waitForTimeout(300);
  await page.screenshot({path:output+'/mobile-editor.png'});
  // Storage warnings must not widen the trailing group into the Back/mode group.
  for(const width of [320,360,375,390,430]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(60);
   const a=await page.locator('[data-editor-id="view-modes"]').boundingBox();
   const z=await page.locator('[data-editor-id="topright"]').boundingBox();
   assert.ok(a.x+a.width+4<=z.x,'Warning badge does not overlap navigation at '+width);
  }
  await page.setViewportSize({width:390,height:844});
  // A second tab edits the same cached design; deletion must stop it instead of resurrecting the draft.
  const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(base+'/?session='+originalId);
  await second.getByRole('button',{name:'Back to your designs',exact:true}).waitFor();
  // Recovery failure keeps the working editor available.
  await page.evaluate(()=>{window.designTestSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('wardrobe:draft:'))throw new Error('Browser storage is full');return window.designTestSetItem.call(this,k,v);};});
  await back().click();await page.getByText('Browser storage is full',{exact:true}).waitFor();assert.ok(await back().isVisible());
  await page.evaluate(()=>{Storage.prototype.setItem=window.designTestSetItem;});
  await back().click();await row('Bedroom · Oak').waitFor();await library().getByRole('button',{name:'Select',exact:true}).click();await choose('Bedroom · Oak').click();
  await library().getByRole('button',{name:'Delete',exact:true}).click();await dialog().getByRole('button',{name:'Cancel',exact:true}).click();assert.ok(await choose('Bedroom · Oak').isVisible());
  await library().getByRole('button',{name:'Delete',exact:true}).click();await dialog().getByRole('button',{name:'Delete',exact:true}).click();
  await second.getByRole('heading',{name:'Your designs',exact:true}).waitFor();assert.equal(await second.getByRole('button',{name:'Open Bedroom · Oak',exact:true}).count(),0);await second.close();
  assert.equal(await library().locator('.design').count(),2);
  for(const width of [320,360,390,768,1440]){
   await page.setViewportSize({width,height:900});await row('Hallway storage').click();await back().waitFor();
   const left=await page.locator('[data-editor-id="view-modes"]').boundingBox(),right=await page.locator('[data-editor-id="topright"]').boundingBox();
   assert.ok(left.x+left.width<=right.x+1,'Top controls do not overlap at '+width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===1440)await page.screenshot({path:output+'/desktop-editor.png'});
   await back().click();await row('Hallway storage').waitFor();
   if(width===1440)await page.screenshot({path:output+'/desktop-library.png'});
  }
  for(const name of ['Hallway storage','Bedroom · Oak · Copy']){
   await library().getByRole('button',{name:'Select',exact:true}).click();await choose(name).click();
   await library().getByRole('button',{name:'Delete',exact:true}).click();await dialog().getByRole('button',{name:'Delete',exact:true}).click();
  }
  await library().getByRole('heading',{name:'A place for your ideas.',exact:true}).waitFor();await page.reload();
  await library().getByRole('heading',{name:'A place for your ideas.',exact:true}).waitFor();assert.equal(await library().locator('.design').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS design workspace: create/name/open/rename/duplicate/delete, recovery, reload, history, isolated Undo, cross-tab deletion, 320–1440 px and runtime errors');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
