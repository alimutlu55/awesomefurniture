import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditorState as createInitialDesign } from '../../src/application/projects/editor-state';
import { createProject } from '../../src/domain/project/project';
import { sceneToProject, projectToScene } from '../../src/application/projects/editor-mapper';
import { serializeProject, deserializeProject } from '../../src/infrastructure/serialization/project-codec';
import { MemoryProjectRepository } from '../../src/infrastructure/persistence/memory/memory-project-repository';
import type { EditorScene } from '../../src/application/projects/editor-scene';

function scene(): EditorScene {
 const state=createInitialDesign();
 state.n=2; state.wt=[70,130,100,100,100,100];
 state.secs[0]=[{k:'drawer',h:22,w:35,ax:'r'},{k:'short',h:106,x:0,y:30,w:55,front:true}];
 state.secs[1]=[{k:'seasonal',h:40,boxes:2,purpose:'seasonal'}];
 state.dividers=[{i:1,orientation:'horizontal',x0:0,x1:60,y:100,area:{x0:0,x1:60,y0:60,y1:200}}];
 state.reachLine=true;state.proposal={title:'My layout',summary:'Custom storage'};
 return {wardrobes:[{id:1,name:'Bedroom',x:40,y:25,z:-70,angle:90,state},{id:3,name:'Hall',x:350,y:0,z:0,angle:270,state:structuredClone(state)}],activeWardrobe:3,nextWardrobeId:4};
}

test('complete designs survive validated persistence with layout intent intact',async()=>{
 const initial=scene(); const project=sceneToProject(createProject('project-1','Bedroom'),initial);
 const repository=new MemoryProjectRepository();
 await repository.save(deserializeProject(serializeProject(project)),null);
 const saved=await repository.load(project.id); assert.ok(saved);
 const restored=projectToScene(saved.document); assert.ok(restored);
 assert.equal(restored.wardrobes.length,2);
 const cabinet=restored.wardrobes[0]!;
 assert.equal(cabinet.angle,90);assert.equal(cabinet.y,25);
 assert.deepEqual(cabinet.state.secs[0],initial.wardrobes[0]!.state.secs[0]);
 assert.deepEqual(cabinet.state.dividers,initial.wardrobes[0]!.state.dividers);
 assert.deepEqual(cabinet.state.wt,initial.wardrobes[0]!.state.wt);
 assert.deepEqual(cabinet.state.profile,initial.wardrobes[0]!.state.profile);
 assert.deepEqual(cabinet.state.proposal,initial.wardrobes[0]!.state.proposal);
 assert.equal(cabinet.state.reachLine,true);
 assert.equal(cabinet.state.sel,0);assert.equal(cabinet.state.item,-1);
 assert.deepEqual(initial,scene(),'mapping must not mutate the editor scene');
});

test('fresh editors start with one wall and no wardrobe, so the user picks furniture to add',async()=>{
 const fresh=projectToScene(createProject('empty','Empty'));
 assert.equal(fresh?.wardrobes.length,0);
 assert.equal(fresh?.studio?.walls.length,1);
 const {createEditorModel}=await import('../../src/application/projects/editor-model');
 const model=createEditorModel();
 assert.equal(model.scene.wardrobes.length,1);
 const design=model.activeCabinet().state;
 assert.equal(design.n,1);
 assert.ok(design.secs.every(section=>section.length===0));
 assert.deepEqual(design.dividers,[]);
 assert.equal(design.proposal,null);
 assert.equal(design.profile.engaged,false);
});

test('hinged doors map to the canonical solid-door model and reopen as hinged',()=>{
 const initial=scene();initial.wardrobes[0]!.state.doors='hinged';
 const mapped=sceneToProject(createProject('p','Doors'),initial);
 assert.equal(mapped.wardrobes[0]!.doors,'solid');
 assert.equal(projectToScene(deserializeProject(serializeProject(mapped)))!.wardrobes[0]!.state.doors,'hinged');
});

test('per-item finish overrides survive persistence',()=>{
 const initial=scene();
 Object.assign(initial.wardrobes[0]!.state.secs[0]![0]!,{f:'Walnut'});
 const saved=deserializeProject(serializeProject(sceneToProject(createProject('finishes','Finishes'),initial)));
 assert.equal((projectToScene(saved)!.wardrobes[0]!.state.secs[0]![0] as unknown as {f:string}).f,'Walnut');
});

test('transient selection and open doors do not mark a design dirty', async()=>{
 const {sceneDesignKey}=await import('../../src/application/projects/editor-mapper');
 const initial=scene(), before=sceneDesignKey(initial);
 initial.activeWardrobe=1;initial.nextWardrobeId=20;
 initial.wardrobes[0]!.state.sel=1;initial.wardrobes[0]!.state.item=0;initial.wardrobes[0]!.state.open=true;
 assert.equal(sceneDesignKey(initial),before);
 initial.wardrobes[0]!.state.w=220;
 assert.notEqual(sceneDesignKey(initial),before);
});

test('metadata cannot override the validated canonical design on reopen',()=>{
 const mapped=sceneToProject(createProject('p','Invalid hints'),scene());
 mapped.wardrobes[0]!.sections[0]!.items[0]!.editorItem!.h=999;
 assert.throws(()=>serializeProject(mapped));
});

test('duplicate editor cabinet IDs are rejected before opening',()=>{
 const mapped=sceneToProject(createProject('p','IDs'),scene());
 mapped.wardrobes[1]!.editorLayout!.cabinetId=mapped.wardrobes[0]!.editorLayout!.cabinetId;
 assert.throws(()=>serializeProject(mapped));
});

test('item and divider identities survive reordering and duplication',async()=>{
 const {ensureEditorIdentities}=await import('../../src/application/projects/editor-identities');
 const initial=scene();let counter=0;
 ensureEditorIdentities(initial.wardrobes,()=>`entity-${++counter}`);
 const project=createProject('identities','Identity');
 const before=sceneToProject(project,initial);
 const first=before.wardrobes[0]!.sections[0]!.items[0]!.id;
 initial.wardrobes[0]!.state.secs[0]!.reverse();
 initial.wardrobes[0]!.state.secs[0]!.push(structuredClone(initial.wardrobes[0]!.state.secs[0]![1]!));
 ensureEditorIdentities(initial.wardrobes,()=>`entity-${++counter}`);
 const after=sceneToProject(project,initial);
 assert.equal(after.wardrobes[0]!.sections[0]!.items[1]!.id,first);
 assert.notEqual(after.wardrobes[0]!.sections[0]!.items[2]!.id,first);
 assert.doesNotThrow(()=>serializeProject(after));
});

test('save after undo uses the latest storage revision; stale saves preserve local design',async()=>{
 const {createProjectService}=await import('../../src/application/projects/project-service');
 const {createEditorProjectSession}=await import('../../src/application/projects/editor-project-session');
 const repository=new MemoryProjectRepository();
 const projects=createProjectService(repository,()=> 'session');
 const initial=await projects.create('Session');
 const session=createEditorProjectSession(projects,initial);
 const first=scene();
 await session.save(first);
 const changed=structuredClone(first);changed.wardrobes[0]!.state.w=250;
 await session.save(changed);
 const undo=await session.save(first);
 assert.equal(undo.revision,4);
 assert.equal(undo.document.wardrobes[0]!.dimensions.width,200);
 const stale=createEditorProjectSession(projects,initial);
 const before=structuredClone(changed);
 await assert.rejects(()=>stale.save(changed),/changed elsewhere/);
 assert.equal(stale.current.revision,1);
 assert.deepEqual(changed,before);
 assert.equal((await projects.open('session'))!.revision,4);
});

test('failed save can be retried and does not advance the session revision',async()=>{
 const {createProjectService}=await import('../../src/application/projects/project-service');
 const {createEditorProjectSession}=await import('../../src/application/projects/editor-project-session');
 const repository=new MemoryProjectRepository();
 const projects=createProjectService(repository,()=> 'retry');
 const initial=await projects.create('Retry');
 let fail=true;
 const session=createEditorProjectSession({...projects,save:async(document,revision)=>{
  if(fail)throw new Error('Storage unavailable');
  return projects.save(document,revision);
 }},initial);
 await assert.rejects(()=>session.save(scene()),/Storage unavailable/);
 assert.equal(session.current.revision,1);fail=false;
 assert.equal((await session.save(scene())).revision,2);
});

test('IndexedDB saves complete editor metadata across closed connections',async()=>{
 const {IDBFactory}=await import('fake-indexeddb');
 const {IndexedDbProjectRepository}=await import('../../src/infrastructure/persistence/indexeddb/indexeddb-project-repository');
 const factory=new IDBFactory();
 const first=new IndexedDbProjectRepository(factory);
 const project=sceneToProject(createProject('indexed-design','Indexed design'),scene());
 await first.save(project,null);
 await first.close();
 const second=new IndexedDbProjectRepository(factory);
 const record=await second.load(project.id);assert.ok(record);
 assert.deepEqual(projectToScene(record.document),projectToScene(project));
 await second.close();
});

test('box dimensions and composition preference survive save and reopen',()=>{
 const initial=scene();
 Object.assign(initial.wardrobes[0]!.state.profile,{boxWidth:42,boxHeight:36,boxDepth:28,composition:'storage'});
 const project=sceneToProject(createProject('box-design','Measured boxes'),initial);
 const restored=projectToScene(deserializeProject(serializeProject(project)))!;
 assert.equal(restored.wardrobes[0]!.state.profile.boxWidth,42);
 assert.equal(restored.wardrobes[0]!.state.profile.boxHeight,36);
 assert.equal(restored.wardrobes[0]!.state.profile.boxDepth,28);
 assert.equal(restored.wardrobes[0]!.state.profile.composition,'storage');
 const invalid=JSON.parse(serializeProject(project));
 invalid.wardrobes[0].preferences.boxHeight=-1;
 assert.throws(()=>deserializeProject(JSON.stringify(invalid)));
});
