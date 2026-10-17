import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { WardrobePlanner } from './wardrobe-planner.js';
import { number,selectionContext,SELECTION_RULES as R } from './selection-config';
import { boardRect } from './selection-spaces';
import { fittingPanels } from '../geometry/shared-board-spans';
export interface PlanBoard {source:'frame'|'divider'|'fitting';position:{x:number;y:number;z:number};size:{w:number;h:number;d:number};reason:string}
/** A preview board schedule in existing centimetres; no new editor item kinds. */
export function boardSchedule(sections:readonly PlannerSection[],cfg:PlannerConfig,dividers:readonly EditorDivider[]):PlanBoard[] {
 const c=selectionContext(cfg),w=number(cfg.w,200),h=number(cfg.h,230),d=c.depth/10,t=R.panel/10,boards:PlanBoard[]=[];
 const add=(source:PlanBoard['source'],x:number,y:number,width:number,height:number,reason:string)=>boards.push({source,position:{x,y,z:0},size:{w:width,h:height,d},reason});
 // The top board lies on the sides, so a side is one board shorter than the cabinet.
 add('frame',t/2,(h-t)/2,t,h-t,'Left cabinet side');add('frame',w-t/2,(h-t)/2,t,h-t,'Right cabinet side');
 add('frame',w/2,h-t/2,w,t,'Cabinet ceiling');add('frame',w/2,R.base/10-t/2,w-2*t,t,'Cabinet floor');
 let offset=t;
 sections.forEach((s,bay)=>{
  const positions=WardrobePlanner.layoutSection(s.items,s.width);
  const explicit=dividers.filter(q=>q.i===bay&&q.orientation==='horizontal').map(q=>{
   const r=boardRect(q);return {x0:r.x/10,x1:(r.x+r.w)/10,y0:r.y/10,y1:(r.y+r.h)/10};
  });
  fittingPanels(positions,0,c.height/10,explicit).forEach(panels=>{
   for(const edge of ['top','bottom'] as const)for(const span of panels[edge])add('fitting',offset+(span.x0+span.x1)/2,(span.y0+span.y1)/2+R.base/10,span.x1-span.x0,t,edge==='top'?'Top board spans this fitting’s clear space':'Bottom board supports this fitting’s contents');
  });
  for(const divider of dividers.filter(q=>q.i===bay)){const r=boardRect(divider);add('divider',offset+(r.x+r.w/2)/10,R.base/10+(r.y+r.h/2)/10,r.w/10,r.h/10,'Board divides an open space without crossing fixed fittings');}
  offset+=s.width;
  if(bay<sections.length-1){add('divider',offset+t/2,R.base/10+c.height/20,t,c.height/10,'Full-height section divider supports the adjacent bays');offset+=t;}
 });
 return boards;
}
