import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { MODS } from '../wardrobe/catalog.js';
import { storageBoxSize,packStorageBoxes } from './storage-boxes';
import { createSpaceModel } from './selection-spaces';
import { selectionContext,SELECTION_RULES as R } from './selection-config';
import { upperShelfHeight,upperShelfSpaces } from './upper-shelf';
import { scoreLayout } from './layout-score';
import { WardrobePlanner as physical } from './wardrobe-planner.js';
/** Final adjustments never move fixed geometry and are rechecked by the shared gates. */
export function finalizeSelection(input:readonly PlannerSection[],dividers:readonly EditorDivider[],cfg:PlannerConfig):PlannerSection[] {
 let result=input.map(s=>({...s,items:s.items.map(it=>({...it}))}));
 if(cfg.fixedSections)return result;
 const c=selectionContext(cfg),size=storageBoxSize(cfg),minimum=Math.ceil(size.height+R.panel/10+2)*10;
 let boxes=physical.analyze(result,cfg).capacities.seasonalBoxes??0;
 if(cfg.upper!=='none'){
  const spaces=upperShelfSpaces(createSpaceModel({...cfg,fixedSections:result,fixedDividers:dividers}).spaces,cfg);
  for(const sp of spaces.sort((a,b)=>b.y-a.y||a.bay-b.bay)){
   if(result.reduce((n,s)=>n+s.items.length,0)+2>R.maxParts)break;
   const start=Math.max(sp.y,upperShelfHeight(cfg)??(c.reach-R.base)),room=sp.y+sp.h-start;
   const count=Math.min(physical.seasonalAllowance(cfg)-boxes,packStorageBoxes(sp.w/10,c.depth/10,0,size).capacity);
   if(sp.w>R.shelfSpan||room<minimum||count<1)continue;
   const section=result[sp.bay]!;
   if(section.items.some(it=>it.k==='seasonal'&&(it.y??0)*10>=sp.y&&(it.x??0)*10<sp.x+sp.w-.1&&sp.x<((it.x??0)+(it.w??section.width))*10-.1))continue;
   const gap=start-sp.y;
   if(gap>.1)section.items.push({k:'void',purpose:'free',x:sp.x/10,y:sp.y/10,w:sp.w/10,h:gap/10});
   section.items.push({k:'seasonal',purpose:'seasonal',boxes:count,x:sp.x/10,y:start/10,w:sp.w/10,h:Math.min(MODS.seasonal.mx*10,room)/10});
   boxes+=count;
  }
 }
 // Absorb tiny unused strips into a fitting only when its limits still hold.
 for(let bay=0;bay<result.length;bay++){
  const spaces=upperShelfSpaces(createSpaceModel({...cfg,fixedSections:result,fixedDividers:dividers}).spaces,cfg);
  for(const sp of spaces.filter(s=>s.bay===bay&&s.h<R.sliver&&s.h>.1)){
   const candidate=result.map(s=>({...s,items:s.items.map(it=>({...it}))}));
   const below=candidate[bay]!.items.find(it=>Math.abs(((it.y??0)+it.h)*10-sp.y)<.1&&Math.abs((it.x??0)*10-sp.x)<.1&&Math.abs((it.w??candidate[bay]!.width)*10-sp.w)<.1);
   if(!below||below.h*10+sp.h>MODS[below.k].mx*10+.1)continue;
   below.h+=sp.h/10;
   if(scoreLayout(candidate,cfg,dividers).metrics.valid)result=candidate;
  }
 }
 return result;
}
