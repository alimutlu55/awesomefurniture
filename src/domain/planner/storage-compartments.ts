import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { storageBoxSize,packStorageBoxes } from './storage-boxes';
import { MODS } from '../wardrobe/catalog.js';
import { createSpaceModel } from './selection-spaces';
import { selectionContext,SELECTION_RULES as R } from './selection-config';
import { storageHeightLimits } from './storage-fitting-limits';
import { upperShelfHeight } from './upper-shelf';
import { clearanceFit } from './selection-modules';
import { scoreLayout } from './layout-score';
import { WardrobePlanner as physical } from './wardrobe-planner.js';
const equal=(a:number,b:number)=>Math.abs(a-b)<.1;
/** Finish generated geometry with real bounded compartments, never blank spacer fittings.
 * Manual layouts retain their geometry. Unfillable remainders are reported explicitly.
 */
export function finishStorageCompartments(input:readonly PlannerSection[],boards:readonly EditorDivider[],cfg:PlannerConfig):PlannerSection[] {
 let result=input.map(s=>({...s,items:s.items.map(it=>({...it}))}));
 if(cfg.fixedSections)return result;
 result.forEach(s=>{s.items=s.items.filter(it=>it.k!=='void');});
 const c=selectionContext(cfg),box=storageBoxSize(cfg);
 const boxMinimum=Math.max(MODS.seasonal.mn,Math.ceil(box.height+R.panel/10+R.removalGap/10));
 // Preserve the shared upper boundary; never lower individual bays independently.
 // Take up short slits by distributing height through their contiguous storage stack.
 for(let pass=0;pass<4;pass++){
  let changed=false;
  const gaps=createSpaceModel({...cfg,fixedSections:result,fixedDividers:boards}).spaces;
  for(const gap of gaps.filter(sp=>sp.h>.1&&sp.h<MODS.shelf.mn*10)){
   const items=result[gap.bay]!.items;
   const chain=items.filter(it=>equal((it.x??0)*10,gap.x)&&equal((it.w??result[gap.bay]!.width)*10,gap.w)&&((it.y??0)+it.h)*10<=gap.y+.1).sort((a,b)=>(b.y??0)-(a.y??0));
   let boundary=gap.y;
   for(const source of chain){
    if(!equal(((source.y??0)+source.h)*10,boundary))break;
    boundary=(source.y??0)*10;
    const shifted=chain.filter(it=>(it.y??0)>=(source.y??0));
    let extra=Math.min(gap.h,(storageHeightLimits(source,cfg).max-source.h)*10);
    for(const it of shifted){const access=physical.accessInfo(it,R.base/10+(it.y??0),cfg);
     if(access.type!=='occasional')extra=Math.min(extra,((access.limit||c.reach/10)-access.height)*10);
    }
    while(extra>.1&&clearanceFit({...source,h:source.h+extra/10},cfg)<=0)extra-=10;
    if(extra<=.1)continue;
    const candidate=result.map(s=>({...s,items:s.items.map(it=>({...it}))})),bay=candidate[gap.bay]!;
    for(const [index,it] of bay.items.entries()){if(!shifted.includes(items[index]!))continue;
     if(equal((it.y??0)*10,(source.y??0)*10))it.h+=extra/10;else it.y=(it.y??0)+extra/10;
    }
    if(scoreLayout(candidate,cfg,boards).metrics.valid){result=candidate;changed=true;break;}
   }
  }
  if(!changed)break;
 }
 // Complete upper storage too: a tall band may need multiple bounded box shelves.
 // Rebalance the adjoining band instead of leaving a sub-minimum top remainder.
 if(cfg.upper!=='none')for(const gap of createSpaceModel({...cfg,fixedSections:result,fixedDividers:boards}).spaces){
  if(gap.y<(upperShelfHeight(cfg)??(c.reach-R.base))-.1||gap.w>R.shelfSpan)continue;
  const bay=result[gap.bay]!,below=bay.items.find(it=>it.k==='seasonal'&&equal((it.x??0)*10,gap.x)&&equal((it.w??bay.width)*10,gap.w)&&equal(((it.y??0)+it.h)*10,gap.y));
  const height=gap.h/10+(below?.h??0),count=Math.ceil(height/MODS.seasonal.mx),each=height/count;
  if(each<boxMinimum||bay.items.length+count-(below?1:0)+result.reduce((n,s)=>n+s.items.length,0)-bay.items.length>R.maxParts)continue;
  const existing=physical.analyze(result,cfg).capacities.seasonalBoxes??0;
  const allowance=physical.seasonalAllowance(cfg)-existing+(below?.boxes??0);
  const slots=packStorageBoxes(gap.w/10,c.depth/10,0,box).capacity;
  if(slots<1||allowance<count)continue;
  const candidate=result.map(s=>({...s,items:s.items.filter(it=>it!==below).map(it=>({...it}))}));
  const start=gap.y/10-(below?.h??0);let remaining=allowance;
  for(let i=0;i<count;i++){
   const boxes=Math.min(slots,remaining-(count-i-1));remaining-=boxes;
   candidate[gap.bay]!.items.push({k:'seasonal',purpose:'seasonal',boxes,h:each,x:gap.x/10,y:start+i*each,w:gap.w/10});
  }
  if(scoreLayout(candidate,cfg,boards).metrics.valid)result=candidate;
 }
 // Inventory finishing precedes envelope completion, which assigns remaining
 // useful rectangles to explicit adjustable storage without inventing inventory.
 return result;
}
export function unassignedSpaceWarnings(sections:readonly PlannerSection[],boards:readonly EditorDivider[],cfg:PlannerConfig):string[] {
 if(cfg.fixedSections)return[];
 return createSpaceModel({...cfg,fixedSections:sections,fixedDividers:boards}).spaces.filter(sp=>sp.h>R.sliver&&sp.w>R.sliver).map(sp=>
  `Unused cabinet space in section ${sp.bay+1}: ${(sp.w/10).toFixed(1)} × ${(sp.h/10).toFixed(1)} cm at ${(sp.y/10+R.base/10).toFixed(1)} cm. Unassigned clearance is not counted as storage; review the fitting and structural limits.`);
}
