import { WardrobePlanner as planner } from './wardrobe-planner.js';
import type { PlannerConfig,PlannerSection,PlannerProposal } from './wardrobe-planner';
import { selectStorageLayouts } from './selection-planner';
import { dailyStorageQuality } from './daily-storage-composer';
import { reportShelfPossessions } from './possession-report';
import { MODS, PANEL, PLINTH } from '../wardrobe/catalog.js';
import { hasTrait } from '../wardrobe/fittings';
const round=(n:number)=>Math.round(n*100)/100;
const copy=(sections:readonly PlannerSection[])=>sections.map(s=>({...s,items:s.items.map(it=>({...it}))}));
const upper=(s:PlannerSection)=>s.items.findIndex(it=>it.k==='seasonal');
const upperBottom=(s:PlannerSection)=>{const i=upper(s);return i<0?null:planner.layoutSection(s.items,s.width)[i]!.y0;};
/** Coordinate complete stacks; every candidate is revalidated by the physical engine. */
export function coordinateUpperStorage(sections:readonly PlannerSection[],cfg:PlannerConfig):PlannerSection[] {
 const original=copy(sections);
 if(!planner.analyze(original,cfg).valid) return original;
 const starts=original.map(upperBottom).filter((x):x is number=>x!==null);
 if(starts.length<2) return original;
 const targets=[...new Set(starts.map(round))].sort((a,b)=>a-b);
 for(const target of targets){
  const result=copy(original);let possible=true;
  for(const section of result){
   const index=upper(section);if(index<0)continue;
   let delta=round(target-upperBottom(section)!);
   // Prefer adjusting empty/accessory clearance, then hanging clearance; drawers last.
   const indices=section.items.slice(0,index).map((_,i)=>i).sort((a,b)=>{
    const priority=(i:number)=>['void','shelf'].includes(section.items[i]!.k)?0:hasTrait(section.items[i]!.k, 'hanging')?1:2;
    return priority(a)-priority(b)||b-a;
   });
   for(const i of indices){
    if(Math.abs(delta)<.02)break;
    const it=section.items[i]!,limits=MODS[it.k];
    const minimum=it.k==='long'?planner.longMin(Number(cfg.longDrop??160)):limits.mn;
    const change=delta<0?Math.max(delta,minimum-it.h):Math.min(delta,limits.mx-it.h);
    it.h=round(it.h+change);delta=round(delta-change);
   }
   if(Math.abs(delta)>.02){possible=false;break;}
  }
  // Changing the lower stack must also resize the final upper compartment.
  // Otherwise its top board becomes an orphan shelf below the cabinet ceiling.
  const ceiling=Number(cfg.h??230)-PLINTH-2*PANEL;
  if(possible) for(const section of result){
   const last=section.items.at(-1);
   if(last?.k!=='seasonal')continue;
   const top=planner.layoutSection(section.items,section.width).at(-1)!.y1;
   const height=round(last.h+ceiling-top);
   if(height>MODS.seasonal.mx+.02){possible=false;break;}
   last.h=height;
  }
  if(possible&&planner.analyze(result,cfg).valid){
   const before=planner.analyze(original,cfg).capacities,after=planner.analyze(result,cfg).capacities;
   if(Object.keys(before).every(key=>after[key]!>=before[key]!-.01))return result;
  }
 }
 return original;
}
export function compositionOf(sections:readonly PlannerSection[]) {
 const levels=sections.map(upperBottom).filter((x):x is number=>x!==null);
 const spread=levels.length?Math.max(...levels)-Math.min(...levels):0;
 const tops=sections.filter(s=>upper(s)>=0).map(s=>planner.layoutSection(s.items,s.width).at(-1)!.y1);
 const topSpread=tops.length?Math.max(...tops)-Math.min(...tops):0;
 let balance=0,pairs=0;
 for(let i=0;i<Math.floor(sections.length/2);i++){
  const a=sections[i]!,b=sections[sections.length-1-i]!;pairs++;
  const width=1-Math.min(1,Math.abs(a.width-b.width)/Math.max(a.width,b.width));
  const edgeA=planner.layoutSection(a.items,a.width).map(x=>x.y1),edgeB=planner.layoutSection(b.items,b.width).map(x=>x.y1);
  const matched=edgeA.filter(y=>edgeB.some(z=>Math.abs(y-z)<.05)).length;
  balance+=width*.5+(Math.max(edgeA.length,edgeB.length)?matched/Math.max(edgeA.length,edgeB.length):1)*.5;
 }
 const upperAligned=levels.length>=2&&spread<.05&&topSpread<.05;
 const score=(levels.length>=2?Math.max(0,1-Math.max(spread,topSpread)/30):.5)*.65+(pairs?balance/pairs:.5)*.35;
 return {upperAligned,upperBayCount:levels.length,upperShelfHeight:levels.length?round(Math.min(...levels)+PLINTH+PANEL):null,alignmentSpread:round(spread),upperTopSpread:round(topSpread),balance:pairs?round(balance/pairs):1,score:round(score)};
}
/** Compatibility facade; Auto design now uses the space-selection beam and shared score. */
export function generateDesignedLayouts(cfg:PlannerConfig):PlannerProposal[] {
 return selectStorageLayouts(cfg).map(p=>reportShelfPossessions(p,cfg)).map(p=>({...p,composition:{...compositionOf(p.sections),dailyQuality:dailyStorageQuality(p.sections,cfg)}}));
}
