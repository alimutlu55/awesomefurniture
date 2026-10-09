import type { EditorDivider } from '../wardrobe/editor-design';
import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import { WardrobePlanner } from './wardrobe-planner.js';
import { number,selectionContext,SELECTION_RULES as R } from './selection-config';
export interface OpenSpace {bay:number;x:number;y:number;w:number;h:number;depth:number}
export interface Rect {x:number;y:number;w:number;h:number}
export function boardRect(board:EditorDivider):Rect {
 return board.orientation==='horizontal'?{x:number(board.x0,0)*10,y:number(board.y,0)*10-R.panel/2,w:(number(board.x1,0)-number(board.x0,0))*10,h:R.panel}
 :{x:number(board.x,0)*10-R.panel/2,y:number(board.y0,0)*10,w:R.panel,h:(number(board.y1,0)-number(board.y0,0))*10};
}
export function overlaps(a:Rect,b:Rect) {return a.x<b.x+b.w-.1&&b.x<a.x+a.w-.1&&a.y<b.y+b.h-.1&&b.y<a.y+a.h-.1;}
/** Disjoint rectangle subtraction; no overlap or double-counted remainder. */
export function subtract(space:OpenSpace,obstacle:Rect):OpenSpace[] {
 if(!overlaps(space,obstacle))return[space];
 const x0=Math.max(space.x,obstacle.x),x1=Math.min(space.x+space.w,obstacle.x+obstacle.w),y0=Math.max(space.y,obstacle.y),y1=Math.min(space.y+space.h,obstacle.y+obstacle.h);
 return [ {...space,h:y0-space.y}, {...space,y:y1,h:space.y+space.h-y1},
 {...space,x:space.x,y:y0,w:x0-space.x,h:y1-y0}, {...space,x:x1,y:y0,w:space.x+space.w-x1,h:y1-y0} ].filter(s=>s.w>.1&&s.h>.1);
}
export function createSpaceModel(cfg:PlannerConfig) {
 const c=selectionContext(cfg),fixed=cfg.fixedSections as PlannerSection[]|undefined;
 const widths=(fixed?.map(s=>s.width)??cfg.bayWidths as number[]|undefined)??[number(cfg.w,200)-R.panel/5];
 const sections:PlannerSection[]=widths.map((width,i)=>({width,items:structuredClone(fixed?.[i]?.items??[]),role:'Available space'}));
 const dividers=structuredClone((cfg.fixedDividers??[]) as EditorDivider[]);
 let spaces:OpenSpace[]=sections.map((s,bay)=>({bay,x:0,y:0,w:s.width*10,h:c.height,depth:c.depth}));
 sections.forEach((s,bay)=>{
  const obstacles:Rect[]=WardrobePlanner.layoutSection(s.items,s.width).map(p=>({x:p.x0*10,y:p.y0*10,w:p.w*10,h:p.h*10}));
  obstacles.push(...dividers.filter(d=>d.i===bay).map(boardRect));
  for(const obstacle of obstacles)spaces=spaces.flatMap(sp=>sp.bay===bay?subtract(sp,obstacle):[sp]);
 });
 return {sections,dividers,spaces};
}
/** Full-height natural divider choices are represented by existing section widths. */
export function partitionOptions(cfg:PlannerConfig):number[][] {
 if(cfg.fixedSections||cfg.bayWidths)return[createSpaceModel(cfg).sections.map(s=>s.width)];
 const outer=number(cfg.w,200)*10,max=Math.min(R.maxSections,Math.floor((outer-R.panel)/(R.minBay+R.panel))),out:number[][]=[];
 const add=(ws:number[])=>{if(ws.every(w=>w>=R.minBay-.1)&&!out.some(o=>JSON.stringify(o)===JSON.stringify(ws.map(w=>w/10))))out.push(ws.map(w=>Math.round(w*100)/1000));};
 for(let n=1;n<=max;n++){
  const total=outer-(n+1)*R.panel;
  add(Array.from({length:n},()=>total/n));
  if(n>=3){const side=total/(n-.2);add(Array.from({length:n},(_,i)=>i===Math.floor(n/2)?side*.8:side));}
  for(const standard of R.widths){const remainder=total-standard*(n-1);if(remainder>=R.minBay){add([...Array.from({length:n-1},()=>standard),remainder]);if(n>1)add([remainder,...Array.from({length:n-1},()=>standard)]);}}
 }
 return out;
}

/** Rectangle subtraction can split one clear column at unrelated item heights.
 * Join touching remainders before deciding what can fit; never cross a board. */
export function mergeAdjacentSpaces(input:readonly OpenSpace[]):OpenSpace[] {
 const spaces=input.map(s=>({...s}));
 const near=(a:number,b:number)=>Math.abs(a-b)<.1;
 let changed=true;
 while(changed){
  changed=false;
  outer:for(let i=0;i<spaces.length;i++)for(let j=i+1;j<spaces.length;j++){
   const a=spaces[i]!,b=spaces[j]!;
   if(a.bay!==b.bay||!near(a.depth,b.depth))continue;
   if(near(a.x,b.x)&&near(a.w,b.w)&&(near(a.y+a.h,b.y)||near(b.y+b.h,a.y))){a.y=Math.min(a.y,b.y);a.h+=b.h;}
   else if(near(a.y,b.y)&&near(a.h,b.h)&&(near(a.x+a.w,b.x)||near(b.x+b.w,a.x))){a.x=Math.min(a.x,b.x);a.w+=b.w;}
   else continue;
   spaces.splice(j,1);changed=true;break outer;
  }
 }
 return spaces;
}
