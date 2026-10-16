const assert=require('node:assert/strict');
const {deflateRawSync}=require('node:zlib');
const {chromium}=require('playwright');
const {createEditorState}=require('../src/application/projects/editor-state.ts');
const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
const {sceneToProject}=require('../src/application/projects/editor-mapper.ts');
const {createProject}=require('../src/domain/project/project.ts');
const {serializeProject}=require('../src/infrastructure/serialization/project-codec.ts');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:812},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const state={...createEditorState(),w:315.6,h:167,d:80};createDesignCommands(()=>state).addSpaceDivider();state.divider=-1;state.space=null;
  const scene={wardrobes:[{id:1,name:'Wardrobe',x:0,y:0,z:0,angle:0,state}],activeWardrobe:1,nextWardrobeId:2};
  const project=sceneToProject(createProject('canvas-add','Canvas Add'),scene);
  const packed=deflateRawSync(serializeProject(project)).toString('base64url');
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173')+'/#design='+packed);
  const el=id=>page.locator(`[data-editor-id="${id}"]`),bar=el('toolbar'),add=()=>page.locator('.lbl.add:visible');
  await page.locator('.scrub-h:visible').waitFor();await page.waitForTimeout(450);
  const v=await el('view').boundingBox(),h=await page.locator('.scrub-h:visible').boundingBox();
  await page.mouse.click(v.x+v.width*.7,h.y+h.height/2);await page.waitForTimeout(400);
  assert.equal(await bar.getAttribute('data-context'),'wardrobe');await add().waitFor();
  const before=await add().boundingBox();
  await page.mouse.move(v.x+20,v.y+v.height*.3);
  if(width===375){
   const cdp=await page.context().newCDPSession(page),cx=v.x+v.width/2,cy=v.y+v.height*.2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-72,y:cy,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-72,y:cy,id:1},{x:cx+72,y:cy,id:2}]});
   for(let n=1;n<=10;n++){
    const half=72-(72-12.5)*n/10;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-half,y:cy,id:1},{x:cx+half,y:cy,id:2}]});await page.waitForTimeout(50);
   }
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else for(let n=0;n<5;n++){await page.mouse.wheel(0,240);await page.waitForTimeout(150);}
  await page.waitForTimeout(500);const after=await add().boundingBox();
  assert.ok(after.width<before.width*.8,'Zooming out shrinks the whole pill: '+JSON.stringify({width,before,after}));
  assert.ok(after.height<before.height*.8);assert.ok(after.width>0);
  await page.screenshot({path:`/tmp/wardrobe-canvas-add-zoom-${width}.png`});
  for(let n=0;n<5;n++){await page.mouse.wheel(0,-240);await page.waitForTimeout(150);}await page.waitForTimeout(450);
  if(width===375)await add().tap();else await add().click();
  await el('pop2').waitFor({state:'visible'});await el('px').click();await page.waitForTimeout(300);await add().waitFor();
  await bar.locator('[data-action="resize"]').click();await page.waitForTimeout(300);
  await el('h').fill('145.7');await el('h').press('Tab');
  await el('h').evaluate(e=>e.getRootNode().activeElement?.blur());await page.keyboard.press('Escape');await page.waitForTimeout(450);
  await add().waitFor();assert.equal(await bar.getAttribute('data-context'),'wardrobe');
  await page.screenshot({path:`/tmp/wardrobe-canvas-add-${width}.png`});assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: selected wardrobe offers Add, zoom scales its bounds, catalogue and resize restore it`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
