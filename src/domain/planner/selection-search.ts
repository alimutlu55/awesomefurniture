import type { PlannerConfig,PlannerProposal,PlannerSection } from './wardrobe-planner';
import type { EditorDivider } from '../wardrobe/editor-design';
import { WardrobePlanner as physical } from './wardrobe-planner.js';
import { CATEGORIES,selectionContext,SELECTION_RULES as R,clamp } from './selection-config';
import type { Demand } from './selection-config';
import { createSpaceModel,partitionOptions } from './selection-spaces';
import type { OpenSpace } from './selection-spaces';
import { recoverStorageSpace } from './selection-recovery';
import { finishStorageCompartments,unassignedSpaceWarnings } from './storage-compartments';
import { completeStorageEnvelope,hasUnassignedCompartment } from './storage-envelope';
import { upperShelfHeight,upperShelfSpaces } from './upper-shelf';
import { finalizeSelection } from './selection-finalize';
import { modulesFor } from './selection-modules';
import { scoreLayout } from './layout-score';
import { heroMetrics } from './design-hero-metrics';
import { selectConcepts,strategyModules,candidateKey,conceptRoleOptions,conceptAllows } from './design-archetypes';
import type { DesignArchetype,CandidateCache,ConceptRole } from './design-archetypes';
import { purposeName,PURPOSE } from '../wardrobe/catalog.js';
export {scoreLayout} from './layout-score';
interface Ranked {inventory?:PlannerProposal['inventory'];complete:boolean;score:number;partCount:number;positionSum:number;id:string;metrics?:{coverage:Record<string,number>}}
export function rankStoragePlans<T extends Ranked>(plans:readonly T[]):T[] {
 return [...plans].sort((a,b)=>(a.inventory&&b.inventory?(Number(b.inventory.complete)-Number(a.inventory.complete)||b.inventory.coverage-a.inventory.coverage||b.inventory.weakest-a.inventory.weakest):0)||Number(b.complete)-Number(a.complete)||(!a.complete&&!b.complete?(b.metrics?.coverage.total??0)-(a.metrics?.coverage.total??0):0)||b.score-a.score||a.partCount-b.partCount||a.positionSum-b.positionSum||a.id.localeCompare(b.id));
}
export type SelectionProposal=PlannerProposal & ReturnType<typeof scoreLayout> & {structureKey:string;dividers:EditorDivider[];conceptRoles:ConceptRole[]};
interface State {roles:ConceptRole[];sections:PlannerSection[];dividers:EditorDivider[];spaces:OpenSpace[];capacity:Demand;boxes:number;value:number;id:string;parts:number}
const keyOf=(s:Pick<State,'sections'|'dividers'>)=>JSON.stringify([s.sections.map(b=>[b.width,b.items]),s.dividers]);
export function structureKey(sections:readonly PlannerSection[],dividers:readonly EditorDivider[]=[]) {
 // Ignore centimetre-level slack changes; retain bay roles, fitting order and cuts.
 const bays=sections.map(s=>[Math.round(s.width/10),s.items.filter(it=>!['void','seasonal'].includes(it.k)).map(it=>[it.k,it.purpose,Math.round((it.x??0)/10)])]);
 return [JSON.stringify([bays,dividers.map(d=>[d.i,d.orientation])]),JSON.stringify([[...bays].reverse(),dividers.map(d=>[sections.length-1-d.i,d.orientation])])].sort()[0]!;
}
/** Select a fitting for each clear remainder, with a bounded deterministic beam. */
export function searchStorageLayouts(cfg:PlannerConfig,strategy?:DesignArchetype,cache:CandidateCache=new Map(),limit=R.candidateCount,compact=true):SelectionProposal[] {
 const c=selectionContext(cfg),targetBoxes=physical.seasonalAllowance(cfg),finished:State[]=[];
 if(c.height<1000||c.depth<350)return[];
 const fixed=cfg.fixedSections!==undefined,states:State[]=[];
 for(const widths of selectConcepts(partitionOptions(cfg),strategy,cfg)){
  const model=createSpaceModel({...cfg,bayWidths:widths}),metrics=physical.analyze(model.sections,cfg);
  const datum=upperShelfHeight(cfg);
  // Reserve the upper band; its boxes are finalized after daily inventory.
  model.spaces=upperShelfSpaces(model.spaces,cfg).filter(sp=>datum===undefined||sp.y<datum-.1);
  if(fixed&&!scoreLayout(model.sections,cfg,model.dividers).metrics.valid)return[];
  for(const roles of conceptRoleOptions(widths,strategy,cfg))states.push({...model,roles,capacity:Object.fromEntries(CATEGORIES.map(k=>[k,metrics.capacities[k]??0])) as Demand,boxes:metrics.capacities.seasonalBoxes??0,value:0,id:JSON.stringify([widths,roles]),parts:model.sections.reduce((n,s)=>n+s.items.length,0)+model.dividers.length});
 }
 const progress=(s:State)=>{
  const requested=CATEGORIES.filter(k=>c.demand[k]>0);
  const coverage=requested.reduce((n,k)=>n+Math.min(1,s.capacity[k]/c.demand[k]),0)/Math.max(1,requested.length);
  const possible=(k:typeof CATEGORIES[number])=>s.spaces.reduce((n,sp)=>{
   const minimum=k==='short'?1000:k==='long'?c.longDrop+R.hookAllowance+R.hemClearance:k==='pants'?224:k==='folded'?224:k==='small'?128:192;
   if(sp.h<minimum||sp.w<(k==='short'||k==='long'?450:250)||sp.y+minimum+R.base-(k==='short'||k==='long'?60:0)>c.reach)return n;
   const w=sp.w/10;
   const cap=k==='short'||k==='long'?physical.geo.hangCount(w,c.depth<550,c.depth/10,k):k==='pants'?Math.max(1,Math.floor((w-3)/physical.geo.foldW()))*6:k==='folded'?physical.geo.foldStacks(w,true)*6:k==='small'?physical.geo.smallCount(w,c.depth/10,12.8):physical.geo.shoePairs(w);
   return n+cap*Math.max(1,Math.floor(sp.h/minimum));
  },0);
  const optimistic=requested.reduce((n,k)=>n+Math.min(1,(s.capacity[k]+possible(k))/c.demand[k]),0)/Math.max(1,requested.length);
  const railDemand=Math.max(0,c.demand.short-s.capacity.short)*physical.geo.spacing('short')+Math.max(0,c.demand.long-s.capacity.long)*physical.geo.spacing('long');
  const railWidth=s.spaces.filter(sp=>sp.h>=1000&&sp.w>=450&&sp.y+1000+R.base-60<=c.reach).reduce((n,sp)=>n+Math.max(0,sp.w/10-3),0);
  const railFeasibility=railDemand?Math.min(1,railWidth/railDemand):1;
  const regular=s.sections.reduce((n,b)=>n+Math.max(...R.widths.map(w=>clamp(1-Math.abs(w-b.width*10)/300))),0)/s.sections.length;
  const totalArea=s.sections.reduce((n,b)=>n+b.width*10*c.height,0);
  const assignedArea=s.sections.reduce((n,b)=>n+b.items.filter(it=>it.k!=='void').reduce((area,it)=>area+(it.w??b.width)*10*it.h*10,0),0);
  const pendingArea=s.spaces.reduce((n,sp)=>n+sp.w*sp.h,0);
  const abandoned=Math.max(0,totalArea-assignedArea-pendingArea)/Math.max(1,totalArea);
  const redundant=requested.reduce((n,k)=>n+Math.max(0,s.capacity[k]/c.demand[k]-1),0)/Math.max(1,requested.length);
  return -abandoned*50-redundant*8+coverage*80+optimistic*40+railFeasibility*20+Math.log1p(Math.max(0,s.value))*(strategy?.hero?2:.2)+regular*.5+s.boxes*.02-s.parts*.01;
 };
 let beam=states.sort((a,b)=>progress(b)-progress(a)||a.id.localeCompare(b.id));
 // Retain width strategies initially; the first expansion may discover their fit.
 for(let step=0;step<R.maxSteps&&beam.length;step++){
  const expanded:State[]=[];
  for(const state of beam){
   if(!state.spaces.length||state.parts>=R.maxParts){finished.push({...state,spaces:[]});continue;}
   const unmet=Object.fromEntries(CATEGORIES.map(k=>[k,Math.max(0,c.demand[k]-state.capacity[k])])) as Demand;
   const options=state.spaces.map(sp=>{const seasonal=Math.max(0,targetBoxes-state.boxes),key=JSON.stringify([compact,candidateKey(sp,unmet,seasonal)]);
    let candidates=cache.get(key);if(!candidates){candidates=modulesFor(sp,unmet,cfg,seasonal,compact);cache.set(key,candidates);}
    return {sp,modules:strategyModules(candidates,strategy,cfg).filter(m=>conceptAllows(m.items,state.roles[sp.bay]))};});
   options.sort((a,b)=>a.modules.length-b.modules.length||b.sp.h-a.sp.h||a.sp.bay-b.sp.bay||a.sp.y-b.sp.y||a.sp.x-b.sp.x);
   const choice=options[0]!,remaining=state.spaces.filter(sp=>sp!==choice.sp);
   // Empty is an explicit terminal decision for this space, not a fake fitting.
   expanded.push({...state,spaces:remaining,id:state.id+'e'});
   // Natural vertical and horizontal board cuts use the existing divider model.
   const sp=choice.sp;
   for(const cut of R.widths){
    if(cut<R.minBay||sp.w-cut-R.panel<R.minBay||state.dividers.length>=R.maxSections)continue;
    expanded.push({...state,dividers:[...state.dividers,{i:sp.bay,orientation:'vertical',x:(sp.x+cut+R.panel/2)/10,y0:sp.y/10,y1:(sp.y+sp.h)/10}],
     spaces:[...remaining,{...sp,w:cut},{...sp,x:sp.x+cut+R.panel,w:sp.w-cut-R.panel}],parts:state.parts+1,id:state.id+'v'+cut});
   }
   if(sp.w<=R.shelfSpan)for(const pitch of [R.grid*Math.ceil(c.reach*.2/R.grid),R.grid*Math.ceil(c.reach*.4/R.grid)]){
    if(pitch<=sp.y+R.minBay||pitch+R.panel>=sp.y+sp.h-R.minBay||state.dividers.length>=R.maxSections)continue;
    expanded.push({...state,dividers:[...state.dividers,{i:sp.bay,orientation:'horizontal',x0:sp.x/10,x1:(sp.x+sp.w)/10,y:(pitch+R.panel/2)/10}],
     spaces:[...remaining,{...sp,h:pitch-sp.y},{...sp,y:pitch+R.panel,h:sp.y+sp.h-pitch-R.panel}],parts:state.parts+1,id:state.id+'h'+pitch});
   }
   for(const module of choice.modules){
  const sections=state.sections.map(s=>({...s,items:[...s.items]}));
    sections[choice.sp.bay]!.items.push(...module.items);
    const remainder=choice.sp.h-module.height;
    const spaces=remainder>.1?[...remaining,{...choice.sp,y:choice.sp.y+module.height,h:remainder}]:remaining;
    const capacity=Object.fromEntries(CATEGORIES.map(k=>[k,state.capacity[k]+module.capacity[k]])) as Demand;
    expanded.push({...state,sections,spaces,capacity,boxes:state.boxes+module.seasonalBoxes,value:state.value+module.value,parts:state.parts+module.items.length,id:state.id+JSON.stringify(module.items.map(it=>[it.k,it.h,it.purpose]))});
   }
  }
  expanded.sort((a,b)=>progress(b)-progress(a)||a.parts-b.parts||a.id.localeCompare(b.id));
  const seen=new Set<string>(),perShape=new Map<string,number>();
  const diverse=expanded.filter(s=>{
   const key=keyOf(s)+JSON.stringify([s.spaces,s.roles]);if(seen.has(key))return false;seen.add(key);
   const shape=JSON.stringify([s.sections.map(b=>b.width),s.roles]),count=perShape.get(shape)??0;
   if(count>=R.conceptBeamQuota)return false;perShape.set(shape,count+1);return true;
  });
  const protectedLong=diverse.filter(s=>s.roles.includes('long')).slice(0,Math.floor(R.beamWidth/4));
  const protectedSet=new Set(protectedLong);
  beam=[...protectedLong,...diverse.filter(s=>!protectedSet.has(s)).slice(0,R.beamWidth-protectedLong.length)];
 }
 finished.push(...beam);
 const plans:SelectionProposal[]=[];
 for(const [index,source] of finished.entries()){
  const state={...source,sections:source.sections.map(s=>({...s,items:s.items.map(it=>({...it}))})),dividers:structuredClone(source.dividers)};
  if(!state.parts&&CATEGORIES.some(k=>c.demand[k]))continue;
  const recovered=recoverStorageSpace(state.sections,state.dividers,cfg,strategy,state.roles,compact);
  state.dividers=recovered.dividers;
  state.sections=finishStorageCompartments(finalizeSelection(recovered.sections,state.dividers,cfg),state.dividers,cfg);
  const envelope=completeStorageEnvelope(state.sections,state.dividers,cfg);
  state.sections=envelope.sections;state.dividers=envelope.dividers;
  if(hasUnassignedCompartment(state.sections,state.dividers,cfg))continue;
  if(!state.sections.every((s,i)=>conceptAllows(s.items,state.roles[i])))continue;
  if(strategy&&(!strategy.gate(state.sections)||!strategy.accept(state.sections.flatMap(s=>s.items),cfg)))continue;
  const sections=state.sections.map(s=>({...s,items:[...s.items].sort((a,b)=>(a.y??0)-(b.y??0)||(a.x??0)-(b.x??0)),role:[...new Set(s.items.map(purposeName))].join(' + ')||'Available space'}));
  const unassigned=unassignedSpaceWarnings(sections,state.dividers,cfg);
  if(!fixed&&cfg.upper!=='none'&&upperShelfHeight(cfg)===undefined)unassigned.push('A shared upper storage band cannot fit the measured boxes above daily reach while preserving required garment clearance. Upper storage is fitted only where those constraints allow it.');
  // Report any geometry that cannot form a useful bounded compartment.
  const evaluation=scoreLayout(sections,cfg,state.dividers);if(!evaluation.metrics.valid)continue;
  if(strategy&&!Object.values(evaluation.breakdown.criteria).every(v=>v>=strategy.floor))continue;
  const title=evaluation.complete?'Complete storage plan':'Partial storage plan';
  const shortfalls=evaluation.metrics.shortfalls.map(s=>`${Math.ceil(s.missing)} ${PURPOSE[s.key as keyof typeof PURPOSE]} lack storage${s.key==='short'||s.key==='long'?' (about '+Math.ceil(s.missing*physical.geo.spacing(s.key))+' cm of rail)':''}`).join('; ');
  const summary=evaluation.complete?'Holds your inventory including the saved spare allowance.':`Partial: ${shortfalls}.`;
  plans.push({...evaluation,conceptRoles:state.roles,id:'candidate-'+index,title,summary,sections,dividers:state.dividers,cost:evaluation.metrics.cost,coverage:evaluation.metrics.coverage,
   structureKey:structureKey(sections,state.dividers),reasons:[summary,...evaluation.placements.map(p=>p.reason)],warnings:[...evaluation.metrics.warnings,...unassigned]});
 }
 const ranked=strategy?.hero?[...plans].sort((a,b)=>Number(b.complete)-Number(a.complete)||
  heroMetrics(b,cfg)[strategy.hero!]-heroMetrics(a,cfg)[strategy.hero!]||Object.entries(b.breakdown.criteria).reduce((n,[k,v])=>n+v*strategy.weights[k as keyof typeof strategy.weights],0)-Object.entries(a.breakdown.criteria).reduce((n,[k,v])=>n+v*strategy.weights[k as keyof typeof strategy.weights],0)||b.score-a.score||a.id.localeCompare(b.id)):rankStoragePlans(plans),unique=new Set<string>();
 return ranked.filter(p=>{if(unique.has(p.structureKey))return false;unique.add(p.structureKey);return true;}).slice(0,limit).map((p,i)=>({...p,score:scoreLayout(p.sections,cfg,p.dividers).score,id:'layout-'+(i+1),title:(i===0?'Best overall':'Alternative '+(i+1))+(p.complete?'':' · partial')}));
}
