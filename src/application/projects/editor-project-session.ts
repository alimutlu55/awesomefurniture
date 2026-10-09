import type { StoredProject } from '../ports/project-repository';
import type { ProjectService } from './project-service';
import type { EditorScene } from './editor-scene';
import { sceneToProject } from './editor-mapper';

/** Storage revision stays outside scene undo/redo history. Explicit saves capture
 * one immutable scene; concurrent edits remain available for the next save. */
export function createEditorProjectSession(projects: ProjectService, initial: StoredProject) {
 let current=initial;
 let saving=false;
 return {
  get current() { return current; },
  async save(scene: EditorScene): Promise<StoredProject> {
   if(saving) throw new Error('A save is already in progress.');
   saving=true;
   try {
    const document=sceneToProject(current.document,scene);
    const saved=await projects.save(document,current.revision);
    current=saved;
    return saved;
   } finally { saving=false; }
  },
 };
}
