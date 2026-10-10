import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditorState} from '../../src/application/projects/editor-state';
import {createDesignCommands} from '../../src/application/commands/design-commands';
import {createWardrobeGeometry} from '../../src/domain/geometry/wardrobe-geometry.js';
import {createPlannerService} from '../../src/application/projects/planner-service';
import {scoreLayout} from '../../src/domain/planner/layout-score';
import {createProject} from '../../src/domain/project/project';
import {sceneToProject,projectToScene} from '../../src/application/projects/editor-mapper';
import {serializeProject,deserializeProject} from '../../src/infrastructure/serialization/project-codec';

test('selection preview applies existing items and divider cuts and persists with equal manual score',()=>{
 const state=createEditorState(),geometry=createWardrobeGeometry(()=>state),before=structuredClone(state);
 const p=createPlannerService().generate(geometry.plannerConfig())[0]!;
 assert.ok(p&&p.breakdown);assert.deepEqual(state,before);
 createDesignCommands(()=>state).applyProposal(p);
 assert.deepEqual(state.dividers,p.dividers);assert.deepEqual(state.secs.slice(0,state.n),p.sections.map(s=>s.items));
 for(let i=0;i<state.n;i++)assert.equal(geometry.sectionLayoutValid(i),true);
 const rating=scoreLayout(geometry.currentLayout().sections,geometry.plannerConfig(),state.dividers);
 assert.equal(rating.metrics.valid,true);assert.equal(rating.score,p.score);
 const scene={wardrobes:[{id:1,name:'Selection',x:0,y:0,z:0,angle:0,state}],activeWardrobe:1,nextWardrobeId:2};
 const restored=projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('selection','Selection'),scene))))!;
 assert.deepEqual(restored.wardrobes[0]!.state.dividers,state.dividers);
 assert.deepEqual(restored.wardrobes[0]!.state.secs,state.secs);
});
test('bay autofill selects around existing fixed items and boards without replacing them',()=>{
 const state=createEditorState();state.w=63.6;
 const pinned={id:'pinned',k:'drawer' as const,purpose:'folded' as const,h:26,x:0,y:64,w:60};
 const divider={i:0,orientation:'horizontal' as const,x0:0,x1:60,y:120};
 state.secs[0]=[pinned];state.dividers=[divider];
 state.profile.needs={short:0,long:0,pants:0,folded:12,shoes:2,small:6};
 createDesignCommands(()=>state).autofill(0);
 assert.deepEqual(state.secs[0]!.find(it=>it.id==='pinned'),pinned);
 assert.ok(state.dividers.some(d=>JSON.stringify(d)===JSON.stringify(divider)));
 const geometry=createWardrobeGeometry(()=>state);assert.equal(geometry.sectionLayoutValid(0),true);
});

test('whole-wardrobe Auto design ignores occupied fittings, dividers and current bay widths',()=>{
 const state=createEditorState();state.w=63.6;state.n=1;state.proposal=null;
 state.profile.needs={short:0,long:0,pants:0,folded:12,shoes:0,small:0};
 state.profile.growth=0;state.profile.upper='none';state.secs=Array.from({length:6},()=>[]);
 const geometry=createWardrobeGeometry(()=>state),service=createPlannerService();
 const emptyConfig=geometry.plannerConfig(),emptyPlans=service.generate(emptyConfig);
 assert.ok(emptyPlans.length&&emptyPlans[0]!.complete);
 // Fully occupied, manually positioned storage contains no counted clothing.
 state.secs[0]=Array.from({length:7},(_,i)=>({k:'shelf',purpose:'reserve',x:0,y:i*31.2,w:60,h:31.2}));
 const occupied=structuredClone(state);
 assert.deepEqual(geometry.plannerConfig(),emptyConfig);
 assert.equal(service.has(geometry.plannerConfig()),true);
 assert.deepEqual(createPlannerService().generate(geometry.plannerConfig()),emptyPlans);
 assert.deepEqual(state,occupied,'generating alternatives must not change the current wardrobe');
 state.dividers=[{i:0,orientation:'horizontal',x0:0,x1:60,y:100}];
 state.n=2;state.wt=[3,1,100,100,100,100];
 assert.deepEqual(geometry.plannerConfig(),emptyConfig);
 state.w=100;state.h=250;state.d=70;
 const resized=geometry.plannerConfig();
 assert.equal(resized.w,100);assert.equal(resized.h,250);assert.equal(resized.d,70);
 assert.equal(service.has(resized),false,'dimension changes must invalidate cached ideas');
});
