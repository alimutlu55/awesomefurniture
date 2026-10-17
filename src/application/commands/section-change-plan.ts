import type { EditorState } from '../projects/editor-scene';
import type { EditorDivider,EditorItem } from '../../domain/wardrobe/editor-design';
import type { PlannerConfig,PlannerProposal,PlannerSection } from '../../domain/planner/wardrobe-planner';
import { WardrobePlanner } from '../../domain/planner/wardrobe-planner.js';
import { PANEL } from '../../domain/wardrobe/catalog.js';
import { scoreLayout } from '../../domain/planner/layout-score';
import { selectStorageLayouts,rankStoragePlans } from '../../domain/planner/selection-planner';
import { partitionOptions } from '../../domain/planner/selection-spaces';
import { sectionWidths } from '../../domain/wardrobe/shape/wardrobe-shape';
import { shareMillimetres, toMm } from '../../domain/geometry/millimetres';

export interface SectionChangePlan {
 sourceKey:string;count:number;selected:number;widths:number[];affected:number;moved:number;resized:number;
 proposal:PlannerProposal|null;redesigned:boolean;
}
export function sectionChangeKey(state:EditorState) {
 return JSON.stringify([state.w,state.h,state.d,state.n,state.wt,state.secs,state.dividers,state.profile,state.fin,state.doors,state.sel]);
}
function proposalFor(sections:PlannerSection[],dividers:EditorDivider[],cfg:PlannerConfig):PlannerProposal|null {
 const evaluation=scoreLayout(sections,cfg,dividers);
 if(!evaluation.metrics.valid)return null;
 return {...evaluation,id:'section-change',title:'Section layout',summary:'',sections,dividers,cost:evaluation.metrics.cost,
  coverage:evaluation.metrics.coverage,reasons:[],warnings:evaluation.metrics.warnings};
}
/** Detached split/merge proposal. No checkpoints, discarded fittings or live writes. */
export function planSectionChange(state:EditorState,delta:number,cfg:PlannerConfig):SectionChangePlan|null {
 if(delta!==1&&delta!==-1)return null;
 const count=state.n+delta;
 if(count<1||count>6)return null;
 // Bays are whole millimetres (sectionWidths); a split or merge keeps them whole.
 const widths=sectionWidths(state),selected=Math.max(0,Math.min(state.sel,state.n-1));
 const sections:PlannerSection[]=widths.map((width,i)=>({width,items:state.secs[i]!.map((it,j)=>{
  const p=WardrobePlanner.layoutSection(state.secs[i]!,width)[j]!;
  return {...structuredClone(it),x:p.x0,y:p.y0,w:p.w};
 })}));
 let boards=structuredClone(state.dividers),affected=0,moved=0,resized=0,blocked=false;
 let target=selected;
 if(delta>0){
  const original=sections[selected]!,inner=toMm(original.width-PANEL),left=Math.floor(inner/2)/10,right=(inner-Math.floor(inner/2))/10;
  if(left<25-.01||right<25-.01){
   const equal=shareMillimetres(toMm(state.w-(count+1)*PANEL),Array(count).fill(1)).map(mm=>mm/10);
   if(Math.min(...equal)<25-.01)return null;
   return {sourceKey:sectionChangeKey(state),count,selected,widths:equal,affected:original.items.length,moved:0,resized:0,proposal:null,redesigned:false};
  }
  const halves:PlannerSection[]=[{width:left,items:[]},{width:right,items:[]}];
  affected=original.items.length;
  for(const item of original.items){
   const half=(item.x??0)>=left+PANEL-.01?1:0,start=half?left+PANEL:0;
   const x=Math.max(0,(item.x??0)-start),w=Math.min(item.w!,halves[half]!.width-x);
   if(w<=0){blocked=true;continue;}
   if(Math.abs(w-item.w!)>.01)resized++;
   if(half)moved++;
   halves[half]!.items.push({...item,x,w});
  }
  const transformed:EditorDivider[]=[];
  for(const board of boards){
   if(board.i!==selected){transformed.push({...board,i:board.i>selected?board.i+1:board.i});continue;}
   // Custom cuts need an explicit redesign rather than dropping or guessing their intent.
   blocked=true;
  }
  boards=transformed;sections.splice(selected,1,...halves);
 }else{
  target=selected<state.n-1?selected:selected-1;
  const a=sections[target]!,b=sections[target+1]!,width=toMm(a.width+b.width+PANEL)/10;
  affected=a.items.length+b.items.length;
  const items:EditorItem[]=[];let y=0;
  for(const section of [a,b])for(const item of [...section.items].sort((x,z)=>(x.y??0)-(z.y??0))){
   const w=Math.abs(item.w!-section.width)<.03?width:item.w!;
   if(Math.abs(w-item.w!)>.01)resized++;
   if(Math.abs(y-item.y!)>.01||section===b)moved++;
   items.push({...item,x:0,y,w});y+=item.h;
  }
  blocked=boards.some(d=>d.i===target||d.i===target+1);
  boards=boards.filter(d=>d.i!==target&&d.i!==target+1).map(d=>({...d,i:d.i>target+1?d.i-1:d.i}));
  sections.splice(target,2,{width,items});
 }
 const config={...cfg,fixedSections:undefined,fixedDividers:undefined};
 return {sourceKey:sectionChangeKey(state),count,selected:target,widths:sections.map(s=>s.width),affected,moved,resized,
  proposal:blocked?null:proposalFor(sections,boards,config),redesigned:false};
}
/** Replan only after the user chooses Redesign, at the requested exact bay count. */
export function redesignSectionChange(plan:SectionChangePlan,cfg:PlannerConfig):SectionChangePlan {
 const config={...cfg,fixedSections:undefined,fixedDividers:undefined,bayWidths:undefined};
 const widths=[plan.widths,...partitionOptions(config).filter(ws=>ws.length===plan.count)];
 const pool:PlannerProposal[]=[];const seen=new Set<string>();
 for(const bays of widths){
  const key=JSON.stringify(bays);if(seen.has(key))continue;seen.add(key);
  pool.push(...selectStorageLayouts({...config,bayWidths:bays}));
  // Bound interactive work; the requested split/merge plus two manufacturing patterns.
  if(seen.size>=3)break;
 }
 const proposal=rankStoragePlans(pool.filter(p=>p.sections.length===plan.count).map(p=>({...p,complete:p.complete??false,partCount:p.partCount??0,positionSum:p.positionSum??0})))[0]??null;
 return {...plan,proposal,redesigned:true};
}
