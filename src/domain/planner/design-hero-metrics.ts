import type { PlannerConfig } from './wardrobe-planner';
import type { SelectionProposal } from './selection-search';
import type { Hero } from './design-archetypes';
import { buildDemand,SELECTION_RULES as R } from './selection-config';
import { WardrobePlanner as physical } from './wardrobe-planner.js';
import { layoutDNA } from './layout-dna';
import { hasTrait } from '../wardrobe/fittings';
export function heroMetrics(p:SelectionProposal,cfg:PlannerConfig):Record<Hero,number> {
 const demand=buildDemand(cfg),foldDemand=demand.folded+demand.pants+demand.small;
 const drawers={folded:0,pants:0,small:0},open={folded:0,pants:0,small:0};
 for(const s of p.sections)for(const it of s.items){
  if(!['folded','pants','small'].includes(it.purpose??''))continue;
  const pos=physical.layoutSection(s.items,s.width)[s.items.indexOf(it)]!;
  const local=physical.analyze([{width:pos.w,items:[{...it,x:0,y:pos.y0,w:pos.w}]}],{...cfg,w:pos.w+R.panel/5});
  const n=local.capacities[it.purpose!]??0;
  if(hasTrait(it.k, 'drawerBox'))drawers[it.purpose as keyof typeof drawers]+=n;
  if(hasTrait(it.k, 'openShelf'))open[it.purpose as keyof typeof open]+=n;
 }
 return {accessibility:p.breakdown.criteria.accessibility,drawerStorage:Math.min(1,Object.entries(drawers).reduce((n,[k,v])=>n+Math.min(v,demand[k as keyof typeof demand]),0)/Math.max(1,foldDemand)),openStorage:Math.min(1,Object.entries(open).reduce((n,[k,v])=>n+Math.min(v,demand[k as keyof typeof demand]),0)/Math.max(1,foldDemand)),
 hangingCapacity:Math.min(1,((p.metrics.capacities.short??0)+(p.metrics.capacities.long??0))/Math.max(1,demand.short+demand.long)),spareSpace:layoutDNA(p.sections,cfg).shares.spare};
}
