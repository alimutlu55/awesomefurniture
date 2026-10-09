import type { ProjectDocument } from '../../domain/project/project';
import type { EditorScene, EditorState } from './editor-scene';
import type { EditorItem, EditorDivider } from '../../domain/wardrobe/editor-design';
import type { StoragePurpose } from '../../domain/wardrobe/wardrobe';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';

const purposes: Record<EditorItem['k'], StoragePurpose> = {
 drawer:'folded',sdrawer:'small',void:'free',shelf:'accessories',folded:'folded',seasonal:'seasonal',short:'short',long:'long',pants:'pants',shoe:'shoes',basket:'laundry',lift:'short',
};
const PANEL=1.8;

export function sceneToProject(project: ProjectDocument, scene: EditorScene): ProjectDocument {
 return {...project, wardrobes: scene.wardrobes.map(cabinet=>{
  const s=cabinet.state, weights=s.wt.slice(0,s.n), total=weights.reduce((a,b)=>a+b,0);
  const widths=weights.map(w=>(s.w-(s.n+1)*PANEL)*w/total);
  const prefix=`${project.id}/cabinet/${cabinet.id}`;
  const {reachStd,engaged,...preferences}=s.profile;
  return {
   id:prefix,name:cabinet.name,dimensions:{width:s.w,height:s.h,depth:s.d},
   position:{x:cabinet.x,y:cabinet.y||0,z:cabinet.z},rotation:cabinet.angle,finish:s.fin,
   doors:s.doors==='hinged'?'solid' as const:s.doors,
   preferences:{...preferences,budget:900},
   editorLayout:{cabinetId:cabinet.id,weights:structuredClone(s.wt),...(reachStd===undefined?{}:{reachStd}),...(engaged===undefined?{}:{engaged}),...(s.reachLine===undefined?{}:{reachLine:s.reachLine}),proposal:structuredClone(s.proposal)},
   sections:widths.map((width,i)=>{
    const positions=WardrobePlanner.layoutSection(s.secs[i]!,width);
    return {id:`${prefix}/section/${i}`,width,
     items:s.secs[i]!.map((it,j)=>({id:it.id??`${prefix}/section/${i}/item/${j}`,kind:it.k,purpose:it.purpose??purposes[it.k],width:positions[j]!.w,height:it.h,x:positions[j]!.x0,y:positions[j]!.y0,frontFacing:it.front??false,boxes:it.boxes??null,editorItem:structuredClone(it)})),
     dividers:s.dividers.filter(d=>d.i===i).map((d,j)=>({
      id:d.id??`${prefix}/section/${i}/divider/${j}`,orientation:d.orientation,
      x:d.orientation==='horizontal'?d.x0!:d.x!-PANEL/2,
      y:d.orientation==='horizontal'?d.y!-PANEL/2:d.y0!,
      length:d.orientation==='horizontal'?d.x1!-d.x0!:d.y1!-d.y0!,thickness:PANEL,
      editorDivider:structuredClone(d),
     })),
    };
   }),
  };
 })};
}

export function projectToScene(project: ProjectDocument): EditorScene | undefined {
 if (!project.wardrobes.length) return undefined;
 const wardrobes=project.wardrobes.map((w,index)=>{
  const layout=w.editorLayout;
  const {budget: _budget,...profile}=w.preferences;
  const secs=w.sections.map(s=>s.items.map(it=>it.editorItem?structuredClone(it.editorItem):({k:it.kind,h:it.height,w:it.width,x:it.x,y:it.y,purpose:it.purpose,front:it.frontFacing,...(it.boxes===null?{}:{boxes:it.boxes})})));
  while(secs.length<6)secs.push([]);
  const dividers:EditorDivider[]=w.sections.flatMap((s,i)=>s.dividers.map(d=>d.editorDivider?structuredClone(d.editorDivider):d.orientation==='horizontal'?{i,orientation:d.orientation,x0:d.x,x1:d.x+d.length,y:d.y+d.thickness/2}:{i,orientation:d.orientation,x:d.x+d.thickness/2,y0:d.y,y1:d.y+d.length}));
  const state:EditorState={
   w:w.dimensions.width,h:w.dimensions.height,d:w.dimensions.depth,n:w.sections.length,
   wt:layout?structuredClone(layout.weights):w.sections.map(s=>s.width).concat(Array(6).fill(100)).slice(0,6),
   secs,dividers,fin:w.finish,doors:w.doors==='solid'?'hinged':w.doors,
   profile:{...profile,...(layout?.reachStd===undefined?{}:{reachStd:layout.reachStd}),...(layout?.engaged===undefined?{}:{engaged:layout.engaged})},
   proposal:layout?structuredClone(layout.proposal):null,...(layout?.reachLine===undefined?{}:{reachLine:layout.reachLine}),
   sel:0,item:-1,divider:-1,space:null,open:false,
  };
  return {id:layout?.cabinetId??index+1,name:w.name,x:w.position.x,y:w.position.y,z:w.position.z,angle:w.rotation,state};
 });
 return {wardrobes,activeWardrobe:wardrobes[0]!.id,nextWardrobeId:Math.max(...wardrobes.map(w=>w.id))+1};
}

/** Selection, open doors, and the next ID counter are transient UI state. */
export function sceneDesignKey(scene: EditorScene): string {
 return JSON.stringify(sceneToProject({schemaVersion:1,id:'comparison',name:'Comparison',units:'cm',wardrobes:[]},scene));
}
