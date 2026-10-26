const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {deflateRawSync}=require('node:zlib');
const root=require('node:path').resolve(__dirname,'..');
const {createEditorState}=require(root+'/src/application/projects/editor-state.ts');
const {rectangleStudio}=require(root+'/src/domain/studio/studio-templates.ts');
const {sceneToProject}=require(root+'/src/application/projects/editor-mapper.ts');
const {createProject}=require(root+'/src/domain/project/project.ts');
const {serializeProject}=require(root+'/src/infrastructure/serialization/project-codec.ts');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [375,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},hasTouch:true,isMobile:width===375,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('wardrobeForge.lengthUnit','mm'));
  await page.route('https://*.supabase.co/**',r=>r.fulfill({status:400,body:'{}'}));
  const state={...createEditorState(),w:217.4,h:230,d:60,n:1};
  const scene={studio:rectangleStudio(218.2,300,300),wardrobes:[{id:1,name:'Precision test',x:-0.3,y:0,z:30,angle:0,state}],activeWardrobe:1,nextWardrobeId:2};
  const project=sceneToProject(createProject('width-gap-test','Width gap test'),scene);
  const packed=deflateRawSync(serializeProject(project)).toString('base64url');
  await page.goto((process.env.MOBILE_TEST_URL||'http://127.0.0.1:4180')+'/#design='+packed);
  const el=id=>page.locator(`[data-editor-id="${id}"]`);
  await el('add-furniture-btn').waitFor();
  const before=await page.evaluate(()=>window.furnidraw.describe());
  assert.equal(before.wardrobes[0].width,217.4);
  assert.ok(Math.abs(before.wardrobes[0].gaps.left+before.wardrobes[0].gaps.right-.8)<.001);
  const view=await el('view').boundingBox();await page.mouse.click(view.x+view.width/2,view.y+view.height*.45);
  await el('toolbar').locator('[data-action="resize"]').click();
  assert.equal(await el('w').inputValue(),'2174');
  const range=el('w-range');
  const geometry=await range.evaluate(e=>({min:Number(e.min),max:Number(e.max),value:Number(e.value)})),box=await range.boundingBox();
  const x=box.x+8+(box.width-16)*(geometry.value-geometry.min)/(geometry.max-geometry.min),y=box.y+box.height/2,end=box.x+box.width*.7;
  if(width===375){
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(end-x)*i/5,y,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(end,y,{steps:5});await page.mouse.up();
  }
  const after=await page.evaluate(()=>window.furnidraw.describe());
  assert.equal(after.wardrobes[0].width,218.2);
  assert.equal(after.wardrobes[0].gaps.left,0);assert.equal(after.wardrobes[0].gaps.right,0);
  await page.screenshot({path:`/tmp/wardrobe-slider-boundary-${width}.png`});
  await el('c').focus();await page.keyboard.press('ControlOrMeta+z');
  assert.deepEqual(await page.evaluate(()=>window.furnidraw.describe()),before);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: real slider drag fills the last 8 mm, both gaps close, Undo restores width and pose.`);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
