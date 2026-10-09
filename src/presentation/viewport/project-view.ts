import type { ProjectDocument } from '../../domain/project/project';
import type { EditorScene } from '../../application/projects/editor-scene';
import type { EditorSession } from '../editor/editor-session';

/** Resolve canonical IDs into the working scene's transient selection only. */
export function applyViewportSession(project: ProjectDocument, scene: EditorScene, session: EditorSession): {focusOn: boolean; deep: boolean; pillOn: boolean} {
 const selection=session.selection;
 const index=selection?project.wardrobes.findIndex(w=>w.id===selection.wardrobeId):-1;
 const cabinet=scene.wardrobes[index],wardrobe=project.wardrobes[index];
 if(!cabinet||!wardrobe||!selection)return {focusOn:false,deep:false,pillOn:false};
 scene.activeWardrobe=cabinet.id;
 const sectionIndex=wardrobe.sections.findIndex(s=>s.id===selection.sectionId);
 const state=cabinet.state;state.sel=Math.max(0,sectionIndex);state.item=-1;state.divider=-1;state.space=null;
 const section=wardrobe.sections[sectionIndex];
 if(section){
  state.item=section.items.findIndex(it=>it.id===selection.itemId);
  const divider=section.dividers.findIndex(d=>d.id===selection.dividerId);
  if(divider>=0)state.divider=state.dividers.map((d,i)=>({d,i})).filter(({d})=>d.i===sectionIndex)[divider]?.i??-1;
 }
 return {focusOn:true,deep:sectionIndex>=0,pillOn:sectionIndex>=0&&state.item<0&&state.divider<0};
}
