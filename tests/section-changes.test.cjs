const {test}=require('node:test');const assert=require('node:assert/strict');
const {createEditorState}=require('../src/application/projects/editor-state.ts');
const {createDesignCommands}=require('../src/application/commands/design-commands.ts');
const {scoreLayout}=require('../src/domain/planner/layout-score.ts');
const {createWardrobeGeometry}=require('../src/domain/geometry/wardrobe-geometry.js');
const {planSectionChange}=require('../src/application/commands/section-change-plan.ts');
const need={short:0,long:0,pants:0,folded:12,shoes:0,small:0};
function setup(state){const history=[],reports=[];let changes=0;
 const commands=createDesignCommands(()=>state,{checkpoint:()=>history.push(structuredClone(state)),changed:()=>changes++,report:(message,action)=>reports.push({message,action}),requestUndo:()=>Object.assign(state,history.pop())});
 return {commands,history,reports,getChanges:()=>changes};
}
test('adding splits the selected designed section immediately and one Undo restores it',()=>{
 const state=createEditorState();state.w=163.6;state.n=2;state.sel=1;state.profile={...state.profile,needs:need,growth:0,upper:'none'};
 state.secs[0]=[{id:'left',k:'folded',purpose:'folded',h:22.8}];state.secs[1]=[{id:'right',k:'folded',purpose:'folded',h:22.8}];
 const before=structuredClone(state),{commands,history,reports,getChanges}=setup(state);
 commands.changeSections(1);
 assert.equal(state.n,3);assert.equal(history.length,1);assert.equal(getChanges(),1);
 assert.deepEqual(state.secs.flat().map(it=>it.id).sort(),['left','right']);
 assert.ok(Math.abs(state.secs[0][0].w-79.1)<.01,'unselected bay keeps its width');
 assert.match(reports.at(-1).message,/Fittings preserved/);assert.equal(reports.at(-1).action.label,'Undo');
 reports.at(-1).action.fn();assert.deepEqual(state,before);
});
test('removing merges the selected bay and preserves fitting identities',()=>{
 const state=createEditorState();state.w=83.6;state.n=2;state.sel=0;state.profile={...state.profile,needs:need,growth:0,upper:'none'};
 state.secs[0]=[{id:'a',k:'folded',purpose:'folded',h:22.8}];state.secs[1]=[{id:'b',k:'folded',purpose:'folded',h:22.8}];
 const {commands,history}=setup(state);commands.changeSections(-1);
 assert.equal(state.n,1);assert.equal(history.length,1);assert.deepEqual(state.secs[0].map(it=>it.id),['a','b']);
 const g=createWardrobeGeometry(()=>state);assert.ok(scoreLayout(g.currentLayout().sections,g.plannerConfig(),state.dividers).metrics.valid);
});
test('a populated wardrobe is replanned to the requested count when preserving would fail',()=>{
 const state=createEditorState();state.n=3;state.sel=1;
 state.secs[1]=[{id:'existing',k:'long',purpose:'long',h:175,x:0,y:0,w:(200-7.2)/3}];
 const before=structuredClone(state),{commands,history,reports}=setup(state);
 commands.changeSections(1);
 assert.equal(state.n,4);assert.equal(history.length,1);assert.match(reports.at(-1).message,/Redesigned/);
 const g=createWardrobeGeometry(()=>state);assert.ok(scoreLayout(g.currentLayout().sections,g.plannerConfig(),state.dividers).metrics.valid);
 assert.deepEqual(state.profile.needs,before.profile.needs);assert.equal(state.profile.reach,before.profile.reach);
 reports.at(-1).action.fn();assert.deepEqual(state,before);
});
test('failed or out-of-range changes leave layout and undo history untouched',()=>{
 const state=createEditorState();state.w=53.6;state.n=1;state.secs[0]=[{k:'long',purpose:'long',h:175}];
 const before=structuredClone(state),{commands,history}=setup(state);
 commands.changeSections(1);assert.deepEqual(state,before);assert.equal(history.length,0);
 commands.changeSections(-1);assert.deepEqual(state,before);assert.equal(history.length,0);
});
test('empty wardrobes change immediately without engaging Auto design',()=>{
 const state=createEditorState(),{commands,history}=setup(state);
 commands.changeSections(1);assert.equal(state.n,2);assert.equal(history.length,1);
 assert.equal(state.proposal,null);assert.equal(state.profile.engaged,false);assert.equal(state.secs.flat().length,0);
});
test('section planning never writes live geometry or silently drops custom dividers',()=>{
 const state=createEditorState();state.dividers=[{i:0,orientation:'horizontal',y:80,x0:0,x1:196.4}];
 const before=structuredClone(state),g=createWardrobeGeometry(()=>state);
 const plan=planSectionChange(state,1,g.plannerConfig());assert.ok(plan);assert.equal(plan.proposal,null);assert.deepEqual(state,before);
});
