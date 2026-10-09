import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { WardrobePlanner } from './wardrobe-planner.js';
import { number,selectionContext,SELECTION_RULES as R } from './selection-config';
import { boardRect } from './selection-spaces';
export interface PlanBoard {source:'frame'|'divider'|'fitting';position:{x:number;y:number;z:number};size:{w:number;h:number;d:number};reason:string}
/** A preview board schedule in existing centimetres; no new editor item kinds. */
export function boardSchedule(sections:readonly PlannerSection[],cfg:PlannerConfig,dividers:readonly EditorDivider[]):PlanBoard[] {
 const c=selectionContext(cfg),w=number(cfg.w,200),h=number(cfg.h,230),d=c.depth/10,t=R.panel/10,boards:PlanBoard[]=[];
 const add=(source:PlanBoard['source'],x:number,y:number,width:number,height:number,reason:string)=>boards.push({source,position:{x,y,z:0},size:{w:width,h:height,d},reason});
 add('frame',t/2,h/2,t,h,'Left cabinet side');add('frame',w-t/2,h/2,t,h,'Right cabinet side');
 add('frame',w/2,h-t/2,w,t,'Cabinet ceiling');add('frame',w/2,R.base/10-t/2,w-2*t,t,'Cabinet floor');
 let offset=t;
 sections.forEach((s,bay)=>{
  const positions=WardrobePlanner.layoutSection(s.items,s.width);
  s.items.forEach((it,i)=>{
   const p=positions[i]!;
   if(['drawer','sdrawer'].includes(it.k)||p.y1+R.base/10>=h-t-.05)return;
   add('fitting',offset+(p.x0+p.x1)/2,p.y1+R.base/10-t/2,p.w,t,'Top board spans this fitting’s clear space');
  });
  for(const divider of dividers.filter(q=>q.i===bay)){const r=boardRect(divider);add('divider',offset+(r.x+r.w/2)/10,R.base/10+(r.y+r.h/2)/10,r.w/10,r.h/10,'Board divides an open space without crossing fixed fittings');}
  offset+=s.width;
  if(bay<sections.length-1){add('divider',offset+t/2,R.base/10+c.height/20,t,c.height/10,'Full-height section divider supports the adjacent bays');offset+=t;}
 });
 return boards;
}
