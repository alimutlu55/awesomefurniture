import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { createSpaceModel,boardRect,mergeAdjacentSpaces } from './selection-spaces';
import { CATEGORIES,buildDemand,selectionContext,bandFit,SELECTION_RULES as R } from './selection-config';
import { interactionHeight } from './selection-modules';
import { upperShelfHeight,upperShelfSpaces } from './upper-shelf';
import { scoreLayout } from './layout-score';
import { finishStorageCompartments } from './storage-compartments';

/** Complete the cabinet, not just its inventory. Reserve is real adjustable shelving,
 * explicitly separate from counted possessions. Never change manual geometry. */
export function completeStorageEnvelope(input:readonly PlannerSection[],boards:readonly EditorDivider[],cfg:PlannerConfig) {
 const sections=input.map(s=>({...s,items:s.items.map(it=>({...it}))}));
 let dividers=structuredClone([...boards]);
 if(cfg.fixedSections||!CATEGORIES.some(k=>buildDemand(cfg)[k]>0))return {sections,dividers};
 // Remove abandoned search cuts only when they support no fitting edge.
 dividers=dividers.filter(d=>{
  const r=boardRect(d);
  return sections[d.i]?.items.some(it=>{
   const x=(it.x??0)*10,y=(it.y??0)*10,w=(it.w??sections[d.i]!.width)*10,h=it.h*10;
   return d.orientation==='vertical'
    ? y<r.y+r.h-.1&&r.y<y+h-.1&&(Math.abs(x+w-r.x)<.1||Math.abs(x-r.x-r.w)<.1)
    : x<r.x+r.w-.1&&r.x<x+w-.1&&(Math.abs(y+h-r.y)<.1||Math.abs(y-r.y-r.h)<.1);
  });
 });
 const gaps=upperShelfSpaces(mergeAdjacentSpaces(createSpaceModel({...cfg,fixedSections:sections,fixedDividers:dividers}).spaces),cfg);
 for(const gap of gaps){
  if(gap.w<R.minBay-.1||gap.h<150-.1)continue;
  const columns=Math.ceil((gap.w+R.panel)/(R.shelfSpan+R.panel));
  const width=(gap.w-(columns-1)*R.panel)/columns;
  if(width<R.minBay-.1)continue;
  // Approximately 32 cm compartments, bounded to 15–40 cm, not tall empty shafts.
  const rows=Math.max(Math.ceil(gap.h/400),Math.round(gap.h/320),1),height=gap.h/rows;
  if(height<150-.1)continue;
  const count=sections.reduce((n,s)=>n+s.items.length,0)+dividers.length;
  // Search effort is not a construction limit. Finishing must not abandon a
  // wide wardrobe merely because its beam already spent 40 search actions.
  if(count+columns*rows+columns-1>128)continue;
  const items=sections[gap.bay]!.items,previous=items.length,boardCount=dividers.length;
  for(let col=0;col<columns;col++){
   const x=gap.x+col*(width+R.panel);
   if(col)dividers.push({i:gap.bay,orientation:'vertical',x:(x-R.panel/2)/10,y0:gap.y/10,y1:(gap.y+gap.h)/10});
   for(let row=0;row<rows;row++)items.push({k:'shelf',purpose:'reserve',x:x/10,y:(gap.y+row*height)/10,w:width/10,h:height/10});
  }
  if(!scoreLayout(sections,cfg,dividers).metrics.valid){items.splice(previous);dividers.splice(boardCount);}
 }
 // Reorder adjacent compartments, rather than strand daily clothing at the
 // floor while the newly assigned storage occupies the best access band.
 const reach=selectionContext(cfg).reach,datum=upperShelfHeight(cfg);
 let current=scoreLayout(sections,cfg,dividers),moves=0;
 for(let pass=0;pass<8&&moves<24;pass++){
  let changed=false;
  for(const section of sections){
   const ordered=[...section.items].sort((a,b)=>(a.y??0)-(b.y??0));
   for(const a of ordered){
    const b=ordered.find(it=>it!==a&&Math.abs((it.y??0)-(a.y??0)-a.h)<.01&&Math.abs((it.x??0)-(a.x??0))<.01&&Math.abs((it.w??section.width)-(a.w??section.width))<.01);
    if(!b||(a.purpose==='reserve')===(b.purpose==='reserve'))continue;
    const moving=[a,b];
    // Move a contiguous daily bank together; otherwise an already well-placed
    // upper shelf can prevent the low shelf beneath it from ever improving.
    if(b.purpose==='reserve'){
     let first=a;
     while(true){
      const previous=ordered.find(it=>it.purpose!=='reserve'&&Math.abs((it.y??0)+it.h-(first.y??0))<.01&&Math.abs((it.x??0)-(a.x??0))<.01&&Math.abs((it.w??section.width)-(a.w??section.width))<.01);
      if(!previous)break;moving.unshift(previous);first=previous;
     }
    }
    const old=moving.map(it=>it.y??0),bottom=old[0]!;
    if(a.purpose==='reserve'){b.y=bottom;a.y=bottom+b.h;}
    else {for(const it of moving)if(it!==b)it.y=(it.y??0)+b.h;b.y=bottom;}
    const improves=moving.some((it,i)=>CATEGORIES.includes(it.purpose as typeof CATEGORIES[number])&&bandFit(it.purpose as typeof CATEGORIES[number],interactionHeight(it,cfg),reach)>bandFit(it.purpose as typeof CATEGORIES[number],interactionHeight({...it,y:old[i]!},cfg),reach)+1e-6);
    const crosses=datum!==undefined&&moving.some(it=>(it.y??0)*10<datum-.1&&((it.y??0)+it.h)*10>datum+.1);
    if(improves&&!crosses){
     const trial=scoreLayout(sections,cfg,dividers);
     if(trial.metrics.valid&&(trial.metrics.coverage.total??0)>=(current.metrics.coverage.total??0)&&trial.score>current.score){current=trial;changed=true;moves++;break;}
    }
    moving.forEach((it,i)=>{it.y=old[i]!;});
   }
  }
  if(!changed)break;
 }
 // A fitting supplies its top board. Where daily reach leaves a small gap
 // below the upper band, add the missing support instead of floating boxes.
 if(datum!==undefined){
  const clear=mergeAdjacentSpaces(createSpaceModel({...cfg,fixedSections:sections,fixedDividers:dividers}).spaces);
  for(const gap of clear){
   if(gap.y>datum-R.panel+.1||gap.y+gap.h<datum-.1||gap.w>R.shelfSpan+.1)continue;
   dividers.push({i:gap.bay,orientation:'horizontal',x0:gap.x/10,x1:(gap.x+gap.w)/10,y:(datum-R.panel/2)/10});
  }
 }
 // Support boards change the actual remaining clearance. Close the resulting
 // slits only after the final structure exists, then let the caller reject any
 // candidate that still leaves unallocated interior geometry.
 return {sections:finishStorageCompartments(sections,dividers,cfg),dividers};
}


/** A generated recommendation must be a furnished cabinet, not an abandoned search. */
export function hasUnassignedCompartment(sections:readonly PlannerSection[],dividers:readonly EditorDivider[],cfg:PlannerConfig) {
 if(cfg.fixedSections)return false;
 return mergeAdjacentSpaces(createSpaceModel({...cfg,fixedSections:sections,fixedDividers:dividers}).spaces)
  .some(gap=>gap.w>.1&&gap.h>.1);
}
