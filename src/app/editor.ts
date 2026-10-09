import { createProjectService } from '../application/projects/project-service';
import { projectToScene } from '../application/projects/editor-mapper';
import { IndexedDbProjectRepository } from '../infrastructure/persistence/indexeddb/indexeddb-project-repository';
import { mountEditor } from '../presentation/editor/mount-editor';

const root=document.querySelector<HTMLElement>('#editor-root');
if(!root) throw new Error('Editor mount point is missing.');
async function main(): Promise<void> {
 if(!globalThis.indexedDB) throw new Error('This browser does not provide local project storage.');
 const repository=new IndexedDbProjectRepository(globalThis.indexedDB);
 const projects=createProjectService(repository,()=>crypto.randomUUID());
 const id=new URL(location.href).searchParams.get('project');
 const project=id?await projects.open(id):null;
 if(id&&!project) throw new Error('This project no longer exists. Return to Your projects to open another design.');
 const editor=mountEditor({root:root!,initialScene:project?projectToScene(project.document)??undefined:undefined,projects,initialProject:project,onProjectCreated:created=>{const url=new URL(location.href);url.searchParams.set('project',created.document.id);history.replaceState(null,'',url);}});
 const dispose=()=>{editor.dispose();void repository.close();};
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});
 import.meta.hot?.dispose(dispose);
}
void main().catch(error=>{
 const errorRoot=root.shadowRoot??root;
 errorRoot.replaceChildren();
 const message=document.createElement('p');message.role='alert';message.textContent=error instanceof Error?error.message:'Could not start the editor.';
 const back=document.createElement('a');back.href='./index.html';back.textContent='Return to Your projects';errorRoot.append(message,back);
 console.error(error);
});
