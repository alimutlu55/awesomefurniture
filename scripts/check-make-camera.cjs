// The camera in Make's Assembly Studio is the editor's own: in Explore the same drag turns it exactly as far as in the
// editor and the same wheel zooms it as much, with the same lens; in the guided film it holds the directed shots.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MOBILE_TEST_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});try{
 for(const [width,height] of [[1280,800],[375,812]]){
  const phone=width<900,page=await browser.newPage({viewport:{width,height},isMobile:phone,hasTouch:phone,reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route(base+'/make-camera-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>'}));
  await page.goto(base+'/make-camera-fixture');
  await page.evaluate(async()=>{
   const {mountEditor}=await import('/src/presentation/editor/mount-editor.ts');const {createEditorState}=await import('/src/application/projects/editor-state.ts');
   const THREE=await import(performance.getEntriesByType('resource').find(e=>/\/three\.js\?/.test(e.name)).name);
   const original=THREE.PerspectiveCamera.prototype.updateMatrixWorld;window.cameras=new Set();window.THREE=THREE;
   THREE.PerspectiveCamera.prototype.updateMatrixWorld=function(...a){window.cameras.add(this);return original.apply(this,a);};
   mountEditor({root:document.querySelector('#editor'),initialScene:{wardrobes:[{id:1,name:'W',x:0,y:0,z:0,angle:0,state:{...createEditorState(),w:120,h:220,d:60}}],activeWardrobe:1,nextWardrobeId:2}});
  });
  await page.waitForTimeout(1500);
  const el=id=>page.locator(`[data-editor-id="${id}"]`),bar=el('toolbar'),view=await el('view').boundingBox();
  // The editor's view camera (35°); where it looks, and how far it is from the piece.
  const pose=()=>page.evaluate(()=>{const c=[...window.cameras].find(c=>c.fov===35),d=c.getWorldDirection(new window.THREE.Vector3());
   return {az:Math.atan2(d.x,d.z),dist:c.position.length(),fov:c.fov,far:c.far};});
  const x=view.x+view.width*.12,y=view.y+view.height*.22;
  const drag=async()=>{
   if(phone){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let n=1;n<=12;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+120*n/12,y,id:1}]});await page.waitForTimeout(16);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+120,y,{steps:12});await page.mouse.up();}
   await page.waitForTimeout(700);};
  const wheel=async()=>{await page.mouse.move(view.x+view.width*.5,view.y+view.height*.45);await page.mouse.wheel(0,-300);await page.waitForTimeout(900);};
  const gestures=async()=>{const a=await pose();await drag();const b=await pose();await wheel();const c=await pose();
   let turn=(b.az-a.az)*180/Math.PI;turn=((turn+540)%360)-180;return {turn:Math.abs(turn),zoom:c.dist/b.dist,fov:a.fov,far:a.far};};
  for(const at of [.5,.4,.6]){if(await bar.getAttribute('data-context')==='wardrobe')break;await page.mouse.click(view.x+view.width/2,view.y+view.height*at);await page.waitForTimeout(400);}
  const editor=await gestures();
  assert.ok(editor.turn>5 && editor.zoom<.95,'the editor turns and zooms: '+JSON.stringify(editor));
  const make=bar.locator('[data-action="make"]');
  if(!await make.isVisible()){await bar.locator('[data-action="more"]').click();await page.locator('[data-action="make"]:visible').first().click();}else await make.click();
  await page.waitForTimeout(400);await bar.locator('[data-action="make-assembly"]').click();await page.waitForTimeout(1500);
  const guided=await gestures();
  assert.ok(guided.turn<.01 && Math.abs(guided.zoom-1)<.01,'the guided film holds its directed shots: '+JSON.stringify(guided));
  await page.locator('[data-studio="mode"]').click();await page.waitForTimeout(900);
  const explore=await gestures();
  assert.ok(Math.abs(explore.turn-editor.turn)<.1,`Explore turns as the editor does: ${explore.turn} against ${editor.turn}`);
  assert.ok(Math.abs(explore.zoom-editor.zoom)<.03,`Explore zooms as the editor does: ${explore.zoom} against ${editor.zoom}`);
  assert.deepEqual([explore.fov,explore.far],[editor.fov,editor.far],'the same lens');
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}px: Assembly Studio's Explore turns ${explore.turn.toFixed(2)}° (editor ${editor.turn.toFixed(2)}°) and zooms ×${explore.zoom.toFixed(3)} (editor ×${editor.zoom.toFixed(3)}) with the editor's lens; the guided film holds its shots`);
  await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
