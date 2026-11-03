import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.MOBILE_TEST_URL??'http://127.0.0.1:5174';
const output='artifacts/cargo-assembly';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try {for(const width of (process.env.CARGO_WIDTH ? [Number(process.env.CARGO_WIDTH)] : process.env.CARGO_MOBILE_ONLY ? [375] : [1280,375])) {
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',isMobile:width===375,hasTouch:width===375});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(base+'/cargo-assembly',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="editor"></div>'}));
 await page.goto(base+'/cargo-assembly');
 const timing=await page.evaluate(async()=>{
  const {mountEditor}=await import('/src/presentation/editor/mount-editor.ts');
  const {createEditorState}=await import('/src/application/projects/editor-state.ts');
  const {createKitchenDesign}=await import('/src/domain/kitchen/kitchen-design.ts');
  const {makePiece}=await import('/src/domain/make/make-parts.ts');
  const {assemblyTimeline}=await import('/src/domain/make/make-timeline.ts');
  const design=createKitchenDesign('base','cargo');
  const piece=makePiece({pieces:[{id:1,name:'Cargo',x:0,y:0,z:0,angle:0,design}]},1),tl=assemblyTimeline(piece);
  window.cargoEditor=mountEditor({root:document.querySelector('#editor'),initialScene:{wardrobes:[{id:1,name:'Cargo',x:0,y:0,z:0,angle:0,state:{...createEditorState(),...design}}],activeWardrobe:1,nextWardrobeId:2}});
  return {duration:tl.duration,shots:[{name:'initial',t:0},...['drawer-runners','cargo-frame','cargo-baskets','drawers','fronts','drawer-test'].flatMap(stage=>{const i=piece.steps.findIndex(s=>s.stage===stage),s=tl.steps[i];return [...(s.place[0]>s.drill[1]?[{name:stage+'-before',t:s.drill[1]+(s.place[0]-s.drill[1])*.25}]:[]),{name:stage+'-start',t:s.place[0]},{name:stage+'-mid',t:s.place[1]>s.place[0]?(s.place[0]+s.place[1])/2:(s.fix[0]+s.fix[1])/2},...(s.fix[1]>s.fix[0]?[{name:stage+'-fix',t:(s.fix[0]+s.fix[1])/2}]:[]),...(s.adjust[1]>s.adjust[0]?[{name:stage+'-adjust',t:(s.adjust[0]+s.adjust[1])/2}]:[]),{name:stage+'-end',t:s.end-.1}];})]};
 });
 const el=id=>page.locator(`[data-editor-id="${id}"]`);await el('add-furniture-btn').waitFor();await page.waitForTimeout(1000);
 const view=await el('view').boundingBox();if(width===375) await page.touchscreen.tap(view.x+view.width/2,view.y+view.height*.5); else await page.mouse.click(view.x+view.width/2,view.y+view.height*.4);
 await page.waitForTimeout(300);
 await el('toolbar').locator('[data-action="make"]').click();await el('toolbar').locator('[data-action="make-assembly"]').click();
 const studio=page.locator('.assembly-studio');await studio.waitFor({state:'visible'});
 for(const shot of timing.shots.filter(s=>!process.env.CARGO_SHOT || s.name===process.env.CARGO_SHOT)){await studio.locator('.as-scrub').fill(String(Math.round(shot.t/timing.duration*1000)));await page.waitForTimeout(180);
  if(process.env.CARGO_SIDE){await studio.locator('[data-studio="mode"]').click();await page.mouse.move(width*.65,300);await page.mouse.down();await page.mouse.move(width*.57,300,{steps:20});await page.mouse.up();await page.waitForTimeout(300);}
  await page.screenshot({path:`${output}/${shot.name}${process.env.CARGO_SIDE?'-side':''}-${width}.png`});}
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 console.log(`${width}px: cargo initial, frame, door and baskets rendered without errors or overflow`);await page.close();
}}finally{await browser.close();}
