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
 return CATEGORIES.every(k=>(reference.metrics.capacities[k]??0)<=0||(p.metrics.capacities[k]??0)>0);
}
/** Family collapse is performed before specialist selection, with a balanced reference. */
export function selectSpecialists(pool:readonly SpecialistPlan[],strategies:readonly DesignArchetype[]=ARCHETYPES):SpecialistPlan[] {
 if(!pool.length)return[];
 const complete=pool.filter(p=>p.complete),eligible=complete.length?complete:pool;
 const best=rankStoragePlans(eligible)[0]!;
 const shown:SpecialistPlan[]=[{...best,title:'Best Overall'+(best.complete?'':' · partial'),variations:[]}];
 const rejected:string[]=[],contenders:{plan:SpecialistPlan;strategy:DesignArchetype;margin:number}[]=[];
 for(const strategy of strategies){
  if(!strategy.hero)continue;const hero=strategy.hero;
  const candidates=pool.filter(p=>p.archetype===strategy.id&&meetsFloors(p,strategy)&&(!best.complete||p.complete)&&retainsServedCategories(p,best));
  candidates.sort((a,b)=>b.heroes[hero]-a.heroes[hero]||b.score-a.score||a.id.localeCompare(b.id));
  const p=candidates[0];if(!p){rejected.push(strategy.title+': no plan meets the physical, coverage and quality floors.');continue;}
  const baseline=best.heroes[hero],margin=baseline>1e-6?(p.heroes[hero]-baseline)/baseline:p.heroes[hero]>0?1:0;
  if(margin<.15-1e-9){rejected.push(strategy.title+': less than 15% advantage over Best Overall.');continue;}
  contenders.push({plan:p,strategy,margin});
 }
 contenders.sort((a,b)=>b.margin-a.margin||a.strategy.id.localeCompare(b.strategy.id));
 for(const {plan:p,strategy,margin} of contenders){
  const family=shown.find(q=>dnaDistance(p.dna,q.dna)<DNA_THRESHOLD-1e-9);
  if(family){family.variations.push({archetype:strategy.title,score:p.score});rejected.push(strategy.title+': same structural family as '+family.title+'.');continue;}
  const hero=strategy.hero!,gainPoints=(p.heroes[hero]-best.heroes[hero])*100;
  const capacityLoss=Math.max(0,((best.metrics.coverage.total??0)-(p.metrics.coverage.total??0))*100);
  const costRise=Math.max(0,p.cost-best.cost);
  const criterionNames={accessibility:'daily access fit',clearance:'clearance fit',utilisation:'use of space',grouping:'grouping',safety:'safety margin',buildability:'buildability'};
  const losses=Object.entries(best.breakdown.criteria).map(([k,v])=>({key:k as keyof typeof criterionNames,points:(v-p.breakdown.criteria[k as keyof typeof criterionNames])*100})).sort((a,b)=>b.points-a.points);
  const loss=losses[0];
  const giveUp=capacityLoss>.5?`Gives up ${Math.round(capacityLoss)} points of inventory coverage.`:costRise>0?`${Math.round(costRise/Math.max(1,best.cost)*100)}% higher estimated fitting cost.`:loss&&loss.points>.5?`Gives up ${Math.round(loss.points)} points of ${criterionNames[loss.key]}.`:'No measured loss in inventory coverage or the six scored criteria.';
  shown.push({...p,title:strategy.title+(p.complete?'':' · partial'),comparison:{hero,baseline:best.heroes[hero],value:p.heroes[hero],margin,gainPoints,giveUp},variations:[]});
  if(shown.length===R.proposalCount)break;
 }
 // Keep sibling variants as collapsed metadata, not additional headline cards.
 for(const p of pool){const family=shown.find(q=>p.id!==q.id&&dnaDistance(p.dna,q.dna)<DNA_THRESHOLD);const name=strategies.find(a=>a.id===p.archetype)?.title??p.archetype;if(family&&!family.variations.some(v=>v.archetype===name&&v.score===p.score))family.variations.push({archetype:name,score:p.score});}
 if(shown.length<R.proposalCount)shown[0]!.selectionNote=`${shown.length} distinct ${shown.length===1?'layout':'layouts'} meet the quality and diversity requirements. `+rejected.join(' ');
 return shown.map((p,i)=>({...p,id:'layout-'+(i+1)}));
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
   if(!CATEGORIES.some(k=>buildDemand(cfg)[k]>0&&(p.metrics.capacities[k]??0)>0))continue;
   const missed=Object.entries(p.breakdown.criteria).filter(([,value])=>value<ARCHETYPES[0]!.floor).map(([key])=>key);
   pool.push({...p,id:'fallback-'+(compact?'tight-':'preset-')+p.id,archetype:'balanced',dna:layoutDNA(p.sections,cfg),heroes:heroMetrics(p,cfg),variations:[],
    warnings:[...p.warnings,`Quality targets not met: ${missed.join(', ')}. This physically valid layout provides the storage shown; review its access and design trade-offs.`]});
  }
 }
 const demand=buildDemand(cfg),requested=CATEGORIES.filter(k=>demand[k]>0);
 const inclusive=pool.filter(p=>requested.every(k=>(p.metrics.capacities[k]??0)>0));
 // A storage trade-off may reduce quantities, but should not erase a feasible category.
 if(inclusive.length)pool=inclusive;
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
