import type { createEditorDom } from './editor-dom.js';
import { sceneDesignKey } from '../../application/projects/editor-mapper';
import type { ProjectService } from '../../application/projects/project-service';
import type { StoredProject } from '../../application/ports/project-repository';
import { createEditorProjectSession } from '../../application/projects/editor-project-session';
import type { EditorScene } from '../../application/projects/editor-scene';

export function mountProjectControls(projects: ProjectService, initial: StoredProject | null, snapshot: () => string, dom: ReturnType<typeof createEditorDom>, onProjectCreated?: ((project: StoredProject)=>void) | undefined): () => void {
 const document=dom.document;
 const window=dom.window;
 const menu=document.querySelector('#menu');
 if(!menu) throw new Error('Editor menu is missing.');
 const controls=document.createElement('div');
 controls.className='project-controls';
 const back=document.createElement('a');back.href='./index.html';back.textContent='Your projects';
 const save=document.createElement('button');save.type='button';save.textContent='Save project';
 const status=document.createElement('p');status.role='status';status.setAttribute('aria-live','polite');
 status.textContent=initial?`Project: ${initial.document.name}`:'Unsaved design';
 controls.append(back,save,status);menu.append(controls);
 let session=initial?createEditorProjectSession(projects,initial):null;
 let busy=false;
 const key=(raw: string)=>sceneDesignKey(JSON.parse(raw) as EditorScene);
 let lastSaved=key(snapshot());
 const unsaved=()=>lastSaved!==key(snapshot());
 const beforeUnload=(event: BeforeUnloadEvent): void=>{
  if(unsaved()){event.preventDefault();event.returnValue='';}
 };
 window.addEventListener('beforeunload',beforeUnload);
 save.onclick=()=>{void (async()=>{
  if(busy)return;busy=true;save.disabled=true;status.textContent='Saving…';
  const captured=snapshot();
  try {
   if(!session){
    const project=await projects.create('Wardrobe design');
    session=createEditorProjectSession(projects,project);
    onProjectCreated?.(project);
   }
   const saved=await session.save(JSON.parse(captured) as EditorScene);
   lastSaved=key(captured);
   status.textContent=`Saved locally: ${saved.document.name}${unsaved()?' · New changes remain unsaved':''}`;
  }catch(error){status.textContent=error instanceof Error?error.message:'Could not save. Your design is still open.';}
  finally{busy=false;save.disabled=false;}
 })();};
 return ()=>{window.removeEventListener('beforeunload',beforeUnload);save.onclick=null;controls.remove();};
}
