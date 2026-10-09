import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../../src/domain/project/project';
import { createEditorSession } from '../../src/presentation/editor/editor-session';
import { createThreeViewport } from '../../src/presentation/viewport/three-viewport';

test('viewport forwards the document/session, resizes and disposes its mount once',()=>{
 const calls: unknown[]=[];
 const viewport=createThreeViewport({renderModel:(...args)=>calls.push(args),resizeSurface:(...args)=>calls.push(args),disposeResources:()=>calls.push('disposed')});
 const project=createProject('p','Wardrobe'),session=createEditorSession();
 viewport.render(project,session);viewport.resize(390,844);viewport.dispose();viewport.dispose();
 assert.deepEqual(calls,[[project,session],[390,844],'disposed']);
 assert.throws(()=>viewport.render(project,session),/disposed/);
});

test('canonical selection restores transient viewport context without altering the design',async()=>{
 const {applyViewportSession}=await import('../../src/presentation/viewport/project-view');
 const {createEditorState}=await import('../../src/application/projects/editor-state');
 const {sceneToProject,sceneDesignKey}=await import('../../src/application/projects/editor-mapper');
 const state=createEditorState();state.secs[0]=[{id:'item-1',k:'drawer',h:22}];
 const scene={wardrobes:[{id:2,name:'Bedroom',x:0,y:0,z:0,angle:0,state}],activeWardrobe:2,nextWardrobeId:3};
 const project=sceneToProject(createProject('p','Project'),scene),wardrobe=project.wardrobes[0]!,section=wardrobe.sections[0]!;
 const before=sceneDesignKey(scene);
 const flags=applyViewportSession(project,scene,{...createEditorSession(),selection:{wardrobeId:wardrobe.id,sectionId:section.id,itemId:'item-1',dividerId:null}});
 assert.equal(state.item,0);assert.equal(flags.deep,true);assert.equal(flags.focusOn,true);
 assert.equal(sceneDesignKey(scene),before);
});
