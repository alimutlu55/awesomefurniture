import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { CATEGORIES,buildDemand,SELECTION_RULES as R } from './selection-config';
import type { Demand } from './selection-config';
import { createSpaceModel,mergeAdjacentSpaces } from './selection-spaces';
import { upperShelfSpaces } from './upper-shelf';
import { modulesFor } from './selection-modules';
import { strategyModules,conceptAllows } from './design-archetypes';
import type { DesignArchetype,ConceptRole } from './design-archetypes';
import { scoreLayout } from './layout-score';
/** Recover usable remainders before adding seasonal storage. Never move manual pins. */
export function recoverStorageSpace(input:readonly PlannerSection[],boards:readonly EditorDivider[],cfg:PlannerConfig,strategy?:DesignArchetype,roles:readonly ConceptRole[]=[],compact=true) {
 const sections=input.map(s=>({...s,items:s.items.map(it=>({...it}))})),dividers=structuredClone([...boards]);
 if(cfg.fixedSections)return {sections,dividers};
 // Search's early seasonal decisions must not lock daily space inside a void spacer.
 sections.forEach(s=>{s.items=s.items.filter(it=>it.k!=='void'&&it.k!=='seasonal');});
 const demand=buildDemand(cfg);
 for(let step=0;step<R.maxParts;step++){
  const parts=sections.reduce((n,s)=>n+s.items.length,0)+dividers.length;
  if(parts>=R.maxParts)break;
  const current=scoreLayout(sections,cfg,dividers);
  const unmet=Object.fromEntries(CATEGORIES.map(k=>[k,Math.max(0,demand[k]-(current.metrics.capacities[k]??0))])) as Demand;
  if(CATEGORIES.every(k=>unmet[k]===0))break;
  const spaces=upperShelfSpaces(mergeAdjacentSpaces(createSpaceModel({...cfg,fixedSections:sections,fixedDividers:dividers}).spaces),cfg);
  const candidates=spaces.flatMap(sp=>{
   const options=strategyModules(modulesFor(sp,unmet,cfg,0,compact),strategy,cfg).filter(m=>conceptAllows(m.items,roles[sp.bay]));
   return options.map(module=>({sp,module,missing:CATEGORIES.reduce((n,k)=>n+Math.min(unmet[k],module.capacity[k]),0)}));
  }).filter(o=>o.missing>0&&parts+o.module.items.length<=R.maxParts)
   .sort((a,b)=>b.missing-a.missing||b.module.value-a.module.value||a.sp.bay-b.sp.bay||a.sp.y-b.sp.y);
  let filled=false;
  for(const candidate of candidates){
   const section=sections[candidate.sp.bay]!;
   section.items.push(...candidate.module.items);
   if(scoreLayout(sections,cfg,dividers).metrics.valid){filled=true;break;}
   section.items.splice(-candidate.module.items.length);
  }
  if(filled)continue;
  // Wide leftover rectangles need support before an existing shelf fitting can fit.
  const wide=spaces.find(sp=>sp.w>R.shelfSpan&&sp.h>=220&&sp.w>=2*R.minBay+R.panel&&sp.y+R.base<Number(cfg.reach??185)*10);
  if(!wide||dividers.length>=R.maxSections)break;
  const cut=Math.min(R.shelfSpan,Math.max(R.minBay,(wide.w-R.panel)/2));
  const trial:EditorDivider={i:wide.bay,orientation:'vertical',x:(wide.x+cut+R.panel/2)/10,y0:wide.y/10,y1:(wide.y+wide.h)/10};
  dividers.push(trial);
  if(!scoreLayout(sections,cfg,dividers).metrics.valid){dividers.pop();break;}
 }
 return {sections,dividers};
}
