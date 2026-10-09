const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const inventory={short:24,long:6,pants:12,folded:30,shoes:8,small:30};
async function fixture(){
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const profile={needs:{...inventory},reach:122,reachStd:185,accessible:true,density:'spacious',growth:20,longDrop:180,upper:'more',drawers:'more',allowLift:true,composition:'storage',boxWidth:40,boxHeight:28,boxDepth:35,engaged:false,jackets:6,coats:2};
 const elements=Object.fromEntries(Object.keys(inventory).map(k=>['#need-'+k,{value:String(inventory[k])}]));
 Object.assign(elements,{'#jackets':{value:'6'},'#coats':{value:'2'},'#reach':{value:'185'},'#reach-value':{},'#wizard':{hidden:false},'#ideas-count':{},'#ideas':{setAttribute(){},querySelectorAll(){return[]}}});
 let delay;
 const presenter=createPlannerPresenter({dom:{$:key=>{assert.ok(elements[key],`Removed control queried: ${key}`);return elements[key]}},model:{activeCabinet:()=>({state:{profile}})},plannerState:{ideasTimer:null},lifetime:{cancelTimeout(){},timeout(callback,ms){delay=ms;return 1}}});
 return {presenter,profile,elements,getDelay:()=>delay};
}
test('Auto design contains inventory controls with Max reach but without other advanced settings or explanatory sections',()=>{
 const html=readFileSync(new URL('../src/presentation/editor/editor.html',`file://${__filename}`),'utf8');
 assert.doesNotMatch(html,/Advanced settings|id="(?:long-drop|density|density-note|growth|accessible|composition-pref|box-width|box-height|box-depth|upper-pref|drawer-pref|allow-lift)"/);
 assert.doesNotMatch(html,/id="generate-ideas"|Find storage ideas/);
 assert.match(html,/id="reach"/);
 assert.doesNotMatch(html,/Your current cabinet size stays fixed|Where these ideas come from|Dashed line =|id="preferences-note"/);
});
test('inventory edits preserve saved planning preferences without querying removed controls',async()=>{
 const {presenter,profile,elements}=await fixture();
 presenter.syncPreferences();
 elements['#need-short'].value='3';elements['#need-long'].value='1';
 const updated=presenter.readPreferences();
 assert.deepEqual(updated,{...profile,needs:{...inventory,short:3,long:1},jackets:3,coats:1,engaged:true});
 assert.equal(profile.needs.short,24);
});
test('inventory changes still schedule new proposals without advanced controls',async()=>{
 const {presenter,getDelay,elements}=await fixture();
 presenter.markIdeasDirty();
 assert.equal(getDelay(),350);
 assert.match(elements['#ideas-count'].textContent,/updating/);
});

test('Max reach edits are bounded and update planning reach while retaining other preferences',async()=>{
 const {presenter,profile,elements}=await fixture();
 profile.accessible=false;profile.reach=185;
 presenter.syncPreferences();
 elements['#reach'].value='195';
 assert.deepEqual(presenter.readPreferences(),{...profile,reach:195,reachStd:195,engaged:true});
 elements['#reach'].value='999';assert.equal(presenter.readPreferences().reach,210);
 elements['#reach'].value='';assert.equal(presenter.readPreferences().reach,185);
 presenter.markIdeasDirty();assert.equal(elements['#reach-value'].textContent,'185 cm');
});

test('wizard input and change events refresh ideas automatically without a generate button',async()=>{
 const {bindWizard}=await import('../src/presentation/editor/inspector-bindings.js');
 const inputs=[{},{}],listeners=[];let updates=0;
 bindWizard({dom:{$:selector=>{assert.equal(selector,'#wizard');return{querySelectorAll:()=>inputs}}},planner:{markIdeasDirty(){updates++}},lifetime:{listen(target,event,handler){listeners.push({target,event,handler})}}});
 assert.equal(listeners.length,4);
 for(const input of inputs){assert.deepEqual(listeners.filter(l=>l.target===input).map(l=>l.event),['input','change']);}
 listeners.forEach(l=>l.handler());assert.equal(updates,4);
});
