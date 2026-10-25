const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const inventory={short:24,long:6,pants:12,folded:30,shoes:8,small:30};
async function fixture(){
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const profile={needs:{...inventory},reach:122,reachStd:185,accessible:true,density:'spacious',growth:20,longDrop:180,upper:'more',drawers:'more',allowLift:true,composition:'storage',boxWidth:40,boxHeight:28,boxDepth:35,engaged:false,jackets:6,coats:2};
 const elements=Object.fromEntries(Object.keys(inventory).map(k=>['#need-'+k,{value:String(inventory[k])}]));
 Object.assign(elements,{'#jackets':{value:'6'},'#coats':{value:'2'},'#reach':{value:'185'},'#reach-value':{},'#wizard':{hidden:false},'#ideas-count':{},'#ideas':require('./helpers/loading-surface.cjs').loadingSurface()});
 let delay;
 const presenter=createPlannerPresenter({dom:{$:key=>{assert.ok(elements[key],`Removed control queried: ${key}`);return elements[key]}},model:{activeCabinet:()=>({state:{profile}})},plannerState:{ideasTimer:null},lifetime:{cancelTimeout(){},timeout(callback,ms){delay=ms;return 1}}});
 return {presenter,profile,elements,getDelay:()=>delay};
}
test('Auto design contains inventory controls but without other advanced settings or explanatory sections',()=>{
 const html=readFileSync(new URL('../src/presentation/editor/editor.html',`file://${__filename}`),'utf8');
 assert.doesNotMatch(html,/Advanced settings|id="(?:long-drop|density|density-note|growth|accessible|composition-pref|box-width|box-height|box-depth|upper-pref|drawer-pref|allow-lift)"/);
 assert.doesNotMatch(html,/id="generate-ideas"|Find storage ideas/);
 assert.doesNotMatch(html,/id="reach"|wardrobe-reach/,'Max reach is a project setting in the menu');
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

test('Auto design plans for the project reach and keeps the seated reach',async()=>{
 const {presenter,profile}=await fixture();
 profile.accessible=false;profile.reach=195;profile.reachStd=195;
 assert.deepEqual(presenter.readPreferences(),{...profile,engaged:true});
 profile.accessible=true;
 assert.equal(presenter.readPreferences().reach,122);assert.equal(presenter.readPreferences().reachStd,195);
});

test('wizard input and change events refresh ideas automatically without a generate button',async()=>{
 const {bindWizardInputs}=await import('../src/presentation/editor/bindings/wizard.js');
 const inputs=[{},{}],listeners=[];let updates=0;
 bindWizardInputs({dom:{$:selector=>{assert.equal(selector,'#wizard');return{querySelectorAll:()=>inputs}}},planner:{markIdeasDirty(){updates++}},lifetime:{listen(target,event,handler){listeners.push({target,event,handler})}}});
 assert.equal(listeners.length,4);
 for(const input of inputs){assert.deepEqual(listeners.filter(l=>l.target===input).map(l=>l.event),['input','change']);}
 listeners.forEach(l=>l.handler());assert.equal(updates,4);
});

test('result cards show owned-item fit without internal scores or variant tags',async()=>{
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const elements=Object.fromEntries(['#ideas-note','#wizard-size','#ideas-count','#ideas'].map(k=>[k,{}]));
 const needs={short:0,long:0,pants:0,folded:10,shoes:0,small:0};
 const plan={title:'Best match',sections:[],score:85,inventory:{coverage:1,complete:true,missing:[]},complete:false,
  metrics:{capacities:{folded:10},coverage:{total:.8},ergo:.9,seasonal:{targetBoxes:0,allocatedBoxes:0}},familyVariant:true};
 const presenter=createPlannerPresenter({dom:{$:k=>elements[k]},model:{activeCabinet:()=>({state:{w:100,h:230,d:60,profile:{needs,growth:20,reach:185}}})},
  geometry:{plannerConfig:()=>({needs}),ih:()=>220},plannerState:{ideas:[plan]}});
 presenter.renderIdeas();
 const html=elements['#ideas'].innerHTML;
 assert.match(html,/#1 Best match/);assert.match(html,/100% of items fit/);assert.doesNotMatch(html,/growth fit|Quality|Access|Family variant|trade-offs/);
 assert.match(html,/10 \/ 10/);
 assert.doesNotMatch(html,/<p\b|<details\b|Why this plan|short<\/span>/);
 assert.match(html,/data-idea="0"/);
});

test('debounced refresh preserves an unfinished focused quantity and commits the replacement',async()=>{
 const {createPlannerPresenter}=await import('../src/presentation/editor/planner-presenter.js');
 const elements=Object.fromEntries(Object.entries(inventory).map(([k,v])=>['#need-'+k,{value:String(v)}]));
 Object.assign(elements,{'#jackets':{value:'6'},'#coats':{value:'2'},'#reach':{value:'185'},'#reach-value':{},'#wizard':{hidden:false},'#ideas-note':{},'#wizard-size':{},'#ideas-count':{},'#ideas':require('./helpers/loading-surface.cjs').loadingSurface()});
 const document={activeElement:elements['#need-shoes']};
 const state={w:200,h:230,d:60,profile:{needs:{...inventory},reach:185,reachStd:185,growth:15,jackets:6,coats:2}};
 let scheduled;
 const presenter=createPlannerPresenter({dom:{$:k=>elements[k],document},model:{activeCabinet:()=>({state})},
  geometry:{plannerConfig:()=>({...state.profile,w:state.w,h:state.h,d:state.d})},
  plannerState:{ideasTimer:null,ideas:[]},commands:{setPreferences:p=>{state.profile=p;}},plannerService:{generate:()=>[]},
  lifetime:{cancelTimeout(){},timeout:fn=>{scheduled=fn;return 1;}}});
 const shoes=elements['#need-shoes'];
 shoes.value='';presenter.markIdeasDirty();scheduled();
 assert.equal(shoes.value,'','a pause after deleting the old value must not restore it');
 assert.equal(state.profile.needs.shoes,8,'unfinished input keeps the last saved quantity');
 shoes.value='012';presenter.markIdeasDirty();scheduled();
 assert.equal(shoes.value,'012','refresh must preserve the focused text exactly');
 assert.equal(state.profile.needs.shoes,12);
 document.activeElement=null;presenter.markIdeasDirty();scheduled();
 assert.equal(shoes.value,'12','normalize once editing finishes');
});

