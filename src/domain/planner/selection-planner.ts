import type { PlannerConfig } from './wardrobe-planner';
import type { SelectionProposal } from './selection-search';
import { searchStorageLayouts,rankStoragePlans } from './selection-search';
import { ARCHETYPES } from './design-archetypes';
import type { CandidateCache,DesignArchetype,Hero } from './design-archetypes';
import { layoutDNA,dnaDistance,DNA_THRESHOLD } from './layout-dna';
import type { LayoutDNA } from './layout-dna';
import { heroMetrics } from './design-hero-metrics';
import { CATEGORIES,buildDemand,selectionContext,SELECTION_RULES as R } from './selection-config';
import { MODS } from '../wardrobe/catalog.js';
export { rankStoragePlans,structureKey } from './selection-search';
export { scoreLayout } from './layout-score';
export type { SelectionProposal } from './selection-search';
export interface SpecialistPlan extends SelectionProposal {archetype:string;dna:LayoutDNA;heroes:Record<Hero,number>;
 comparison?:{hero:Hero;baseline:number;value:number;margin:number;gainPoints:number;giveUp:string};
 variations:{archetype:string;score:number}[];selectionNote?:string}
export { heroMetrics } from './design-hero-metrics';
export function meetsFloors(p:SelectionProposal,strategy:DesignArchetype) {return Object.values(p.breakdown.criteria).every(v=>v>=strategy.floor);}
export function retainsServedCategories(p:SelectionProposal,reference:SelectionProposal) {
 return CATEGORIES.every(k=>(reference.metrics.capacities?.[k]??0)<=0||(p.metrics.capacities?.[k]??0)>0);
}
/** Choose distinct concepts first, then useful family variants; rank every card by inventory. */
export function selectSpecialists(pool:readonly SpecialistPlan[],strategies:readonly DesignArchetype[]=ARCHETYPES):SpecialistPlan[] {
 const valid=pool.filter(p=>p.metrics.valid!==false);
 const quality=valid.filter(p=>p.breakdown&&meetsFloors(p,ARCHETYPES[0]!));
 const ranked=rankStoragePlans(quality.length?quality:valid);
 if(!ranked.length)return[];
 const best=ranked[0]!;
 const eligible=ranked.filter(p=>retainsServedCategories(p,best));
 const unique:SpecialistPlan[]=[];const keys=new Set<string>();
 for(const p of eligible){
  const key=p.structureKey??JSON.stringify(p.dna);
  if(keys.has(key))continue;keys.add(key);unique.push(p);
 }
 const shown:SpecialistPlan[]=[best];
 // Prefer different structures without making a large possession-fit sacrifice.
 const fit=(p:SpecialistPlan)=>p.inventory?.coverage??p.metrics.coverage.total??0;
 for(const p of unique){
  if(shown.length>=R.proposalCount)break;
  if(p===best||fit(p)<fit(best)-.05)continue;
  if(shown.every(q=>dnaDistance(p.dna,q.dna)>=DNA_THRESHOLD))shown.push(p);
 }
 // Similar concepts remain selectable when their fitting arrangement meaningfully differs.
 for(const p of unique){
  if(shown.length>=R.proposalCount)break;
  if(shown.includes(p)||shown.some(q=>(q.structureKey??JSON.stringify(q.dna))===(p.structureKey??JSON.stringify(p.dna))))continue;
  if(shown.every(q=>dnaDistance(p.dna,q.dna)>=.025))shown.push(p);
 }
 return rankStoragePlans(shown).map((p,i)=>{
  const familyVariant=shown.some(q=>q!==p&&dnaDistance(p.dna,q.dna)<DNA_THRESHOLD);
  const name=strategies.find(a=>a.id===p.archetype)?.title??'Balanced storage';
  const title=i===0?'Best match':name==='Best Overall'?'Balanced storage':name;
  const summary=[p.inventory?.complete?'Current inventory fits':'Partial fit',p.complete?'Growth covered':'Growth partial',`${p.sections?.length??p.dna.columns} bays`].join(' · ');
  return {...p,id:'layout-'+(i+1),title,summary,familyVariant,variations:[],
   selectionNote:i===0&&shown.length<R.proposalCount?`Found ${shown.length} useful layouts within this search. The target is eight; remaining candidates repeated these arrangements or did not preserve requested storage categories.`:''};
 });
}
export function designAll(cfg:PlannerConfig):{plans:SpecialistPlan[];pool:SpecialistPlan[];skipped:string[]} {
 const cache:CandidateCache=new Map();let pool:SpecialistPlan[]=[];const skipped:string[]=[];
 // Keep a demand-only concept beam as a source for the balanced reference. It is
 // not a spare-space recommendation and has no reserved-space hero.
 const inventory:DesignArchetype={...ARCHETYPES.find(a=>a.id==='spare')!,id:'inventory',title:'Inventory fit',hero:'accessibility',weights:R.weights,applicable:c=>Number(c.w??200)>=100};
// Independent beams preserve preset paths when tight-capacity candidates are added.
 // Merging at the end avoids candidate expansion crowding a previously useful path out.
 for(const strategy of [...ARCHETYPES,inventory]){
  if(!strategy.applicable(cfg)){skipped.push(strategy.id==='spare'?'Room to Grow: spare-space recommendations are disabled; saved growth is included in the clothing demand.':strategy.title+': inventory or envelope does not suit this approach.');continue;}
  for(const compact of [false,true])for(const p of searchStorageLayouts(cfg,strategy,cache,R.candidateCount,compact)){
   if(!meetsFloors(p,strategy))continue;
   const dna=layoutDNA(p.sections,cfg);pool.push({...p,id:strategy.id+'-'+(compact?'tight-':'preset-')+p.id,archetype:strategy.id==='inventory'?'balanced':strategy.id,dna,heroes:heroMetrics(p,cfg),variations:[]});
  }
 }
 // A quality target is not a physical constraint. When all normal candidates
 // miss it, return useful, validated storage with the trade-offs made explicit.
 if(!pool.length){
  const strategy={...ARCHETYPES[0]!,floor:0};
  for(const compact of [false,true])for(const p of searchStorageLayouts(cfg,strategy,cache,R.candidateCount,compact)){
   if(!CATEGORIES.some(k=>buildDemand(cfg)[k]>0&&(p.metrics.capacities?.[k]??0)>0))continue;
   const missed=Object.entries(p.breakdown.criteria).filter(([,value])=>value<ARCHETYPES[0]!.floor).map(([key])=>key);
   pool.push({...p,id:'fallback-'+(compact?'tight-':'preset-')+p.id,archetype:'balanced',dna:layoutDNA(p.sections,cfg),heroes:heroMetrics(p,cfg),variations:[],
    warnings:[...p.warnings,`Quality targets not met: ${missed.join(', ')}. This physically valid layout provides the storage shown; review its access and design trade-offs.`]});
  }
 }
 const demand=buildDemand(cfg),requested=CATEGORIES.filter(k=>demand[k]>0);
 const inclusivePool=()=>{
  const inclusive=pool.filter(p=>requested.every(k=>(p.metrics.capacities[k]??0)>0));
  return inclusive.length?inclusive:pool;
 };
 // If the shared beams converged on too few designs, protect each bay-count concept
 // in its own bounded search. Existing candidates stay in the pool.
 if(selectSpecialists(inclusivePool()).length<R.proposalCount&&!cfg.fixedSections&&!cfg.bayWidths){
  for(const count of [2,3,4,1,5,6]){
   const strategy:DesignArchetype={...ARCHETYPES[0]!,columns:[count,count]};
   for(const compact of [true,false])for(const p of searchStorageLayouts(cfg,strategy,cache,R.candidateCount,compact)){
    if(!meetsFloors(p,strategy))continue;
    pool.push({...p,id:`expanded-${count}-${compact}-${p.id}`,archetype:'balanced',dna:layoutDNA(p.sections,cfg),heroes:heroMetrics(p,cfg),variations:[]});
   }
   if(selectSpecialists(inclusivePool()).length>=R.proposalCount)break;
  }
 }
 // A storage trade-off may reduce quantities, but should not erase a feasible category.
 pool=inclusivePool();
 const plans=selectSpecialists(pool,ARCHETYPES.filter(a=>a.applicable(cfg)));
 if(plans[0]&&!meetsFloors(plans[0],ARCHETYPES[0]!))plans[0].selectionNote='Best available physical fit; some quality targets are not met. See the warnings and inventory shortfalls.';
 if(plans[0]?.selectionNote&&skipped.length)plans[0].selectionNote+=' '+skipped.join(' ');
 return {plans,pool,skipped};
}
export function selectStorageLayouts(cfg:PlannerConfig):SpecialistPlan[] {return designAll(cfg).plans;}
export function noPlanExplanation(cfg:PlannerConfig):string {
 const c=selectionContext(cfg);
 if(CATEGORIES.every(k=>c.demand[k]===0))return 'Add clothing quantities to generate storage ideas.';
 const longMinimum=c.longDrop+R.hookAllowance+R.hemClearance;
 if(c.demand.long>0&&longMinimum>MODS.long.mx*10)return `Your saved longest garments need ${longMinimum/10} cm of clear hanging height. The existing long-hang fitting supports up to ${MODS.long.mx} cm.`;
 if(c.demand.long>0&&longMinimum+R.base-60>c.reach)return `A rail for your saved longest garments would be above your ${c.reach/10} cm reach. This setup needs a different long-hanging solution.`;
 return 'The search found no storage arrangement that meets the current fitting, reach and quality requirements for your listed clothing. Review cabinet dimensions or clothing quantities to explore alternatives.';
}
