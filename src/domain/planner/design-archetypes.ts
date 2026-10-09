import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorItem } from '../wardrobe/editor-design';
import type { ModuleCandidate } from './selection-modules';
import { interactionHeight } from './selection-modules';
import { buildDemand,selectionContext,SELECTION_RULES as R } from './selection-config';
import type { Criteria } from './selection-config';
import type { OpenSpace } from './selection-spaces';
import { MODS } from '../wardrobe/catalog.js';
export type Hero='accessibility'|'drawerStorage'|'openStorage'|'hangingCapacity'|'spareSpace';
export interface DesignArchetype {id:string;title:string;hero:Hero|null;weights:Criteria;floor:number;
 applicable:(cfg:PlannerConfig)=>boolean;accept:(items:readonly EditorItem[],cfg:PlannerConfig)=>boolean;
 bias:(module:ModuleCandidate)=>number;gate:(sections:readonly PlannerSection[])=>boolean;
 reserve:boolean;columns:readonly [number,number]}
const any=()=>true,base=R.weights;
const foldShare=(cfg:PlannerConfig)=>{const d=buildDemand(cfg);return(d.folded+d.pants+d.small)/Math.max(1,Object.values(d).reduce((a,b)=>a+b,0));};
const folds=(it:EditorItem)=>['folded','pants'].includes(it.purpose??'');
const area=(m:ModuleCandidate,k:readonly string[])=>m.items.filter(it=>k.includes(it.k)).reduce((n,it)=>n+it.h*(it.w??1),0)/Math.max(1,m.items.reduce((n,it)=>n+it.h*(it.w??1),0));
export const ARCHETYPES:readonly DesignArchetype[]=[
 {id:'balanced',title:'Best Overall',hero:null,weights:base,floor:.45,applicable:any,accept:any,bias:()=>1,gate:any,reserve:false,columns:[1,6]},
 {id:'daily',title:'Daily Driver',hero:'accessibility',weights:{...base,accessibility:.55,clearance:.15,utilisation:.08,grouping:.10,safety:.07,buildability:.05},floor:.45,
 applicable:cfg=>foldShare(cfg)>=.25,accept:(items,cfg)=>items.every(it=>{if(it.k==='void'||it.k==='seasonal'||!['folded','pants','small'].includes(it.purpose??''))return true;const h=interactionHeight(it,cfg),r=selectionContext(cfg).reach;return h>=r*.4&&h<=r*.8;}),
 bias:m=>1+area(m,['drawer','pants'])*2,gate:any,reserve:true,columns:[2,4]},
 {id:'drawers',title:'Drawer First',hero:'drawerStorage',weights:{...base,accessibility:.40,clearance:.20,utilisation:.15,grouping:.10,safety:.10,buildability:.05},floor:.45,
 applicable:cfg=>cfg.drawers!=='none'&&foldShare(cfg)>=.25,accept:items=>items.every(it=>!folds(it)||!['folded','shelf'].includes(it.k)),
 bias:m=>1+area(m,['drawer','sdrawer','basket'])*4,gate:s=>s.some(b=>b.items.some(it=>it.k==='drawer')),reserve:false,columns:[2,4]},
 {id:'open',title:'Open & Simple',hero:'openStorage',weights:{...base,accessibility:.25,clearance:.15,utilisation:.15,grouping:.10,safety:.10,buildability:.25},floor:.45,
 applicable:cfg=>buildDemand(cfg).folded+buildDemand(cfg).pants>0,accept:items=>items.every(it=>it.k!=='drawer'&&it.k!=='basket'),
 bias:m=>1+area(m,['folded','shelf'])*4,gate:s=>s.some(b=>b.items.some(it=>it.k==='folded'||it.k==='shelf')),reserve:false,columns:[2,4]},
 {id:'hang',title:'Hanging Focus',hero:'hangingCapacity',weights:{...base,accessibility:.25,clearance:.15,utilisation:.35,grouping:.10,safety:.10,buildability:.05},floor:.45,
 applicable:cfg=>buildDemand(cfg).short>0&&selectionContext(cfg).height>=2000&&Number(cfg.reach??185)>=200,
 accept:any,bias:m=>1+area(m,['short','long','lift'])*4,
 gate:s=>s.some(b=>b.items.filter(it=>it.k==='short').some((it,i,list)=>list.some((other,j)=>j!==i&&other.x===it.x&&other.w===it.w))),reserve:false,columns:[2,4]},
 {id:'spare',title:'Room to Grow',hero:'spareSpace',weights:{...base,accessibility:.25,clearance:.20,utilisation:.10,grouping:.15,safety:.15,buildability:.15},floor:.45,
 // Saved growth is already included in demand; do not recommend spare-space layouts.
 applicable:()=>false,accept:any,bias:()=>1,gate:any,reserve:true,columns:[2,5]},
];
export function strategyModules(candidates:readonly ModuleCandidate[],strategy:DesignArchetype|undefined,cfg:PlannerConfig):ModuleCandidate[] {
 return candidates.filter(m=>!strategy||strategy.accept(m.items,cfg)).map(m=>strategy?{...m,value:m.value*strategy.bias(m)}:m);
}
/** Concept stage budgets distinct column sketches before detail fitting search. */
export function selectConcepts(widths:number[][],strategy:DesignArchetype|undefined,cfg:PlannerConfig):number[][] {
 if(cfg.fixedSections||cfg.bayWidths)return widths;
 const limits=strategy?.columns??[1,6],groups=new Map<number,number[][]>();
 for(const w of widths){if(w.length<limits[0]||w.length>limits[1])continue;const group=groups.get(w.length)??[];group.push(w);groups.set(w.length,group);}
 const concepts:number[][]=[];
 for(const [n,options] of groups){
  options.sort((a,b)=>conceptScore(b,cfg)-conceptScore(a,cfg)||JSON.stringify(a).localeCompare(JSON.stringify(b)));
  concepts.push(...options.slice(0,n===1?1:2));
 }
 return concepts;
}
function conceptScore(widths:number[],cfg:PlannerConfig) {
 const d=buildDemand(cfg),hang=d.short+d.long>0;
 return widths.reduce((n,w)=>n+(w<=80&&w>=40?1:0)+(hang&&w>=45?.5:0),0)/widths.length-Math.max(0,widths.length-4)*.15;
}
export type CandidateCache=Map<string,ModuleCandidate[]>;
export function candidateKey(sp:OpenSpace,unmet:unknown,seasonal:number) {return JSON.stringify([sp,unmet,seasonal]);}
export type ConceptRole='flex'|'fold'|'hang'|'long';
/** Reserve one visual block for the archetype before choosing exact fitting heights. */
export function conceptRoles(widths:readonly number[],strategy:DesignArchetype|undefined,cfg:PlannerConfig):ConceptRole[] {
 const roles:ConceptRole[]=widths.map(()=> 'flex');
 if(cfg.fixedSections||cfg.bayWidths||!strategy)return roles;
 if(['drawers','open','daily'].includes(strategy.id))roles[Math.floor(widths.length/2)]='fold';
 if(strategy.id==='hang')roles[widths.indexOf(Math.max(...widths))]='hang';
 return roles;
}
export function conceptAllows(items:readonly EditorItem[],role:ConceptRole='flex') {
 return items.every(it=>role==='flex'||it.k==='void'||it.k==='seasonal'||(it.k==='shelf'&&['accessories','reserve'].includes(it.purpose??''))||
  (role==='long'?it.k==='long':role==='fold'?!['short','long','lift'].includes(it.k):!['folded','pants'].includes(it.purpose??'')));
}
export function conceptRoleOptions(widths:readonly number[],strategy:DesignArchetype|undefined,cfg:PlannerConfig):ConceptRole[][] {
 const roles=conceptRoles(widths,strategy,cfg),options=[roles],c=selectionContext(cfg);
 const minimum=c.longDrop+R.hookAllowance+R.hemClearance;
 const suitable=widths.findIndex(w=>w>=(c.depth<550?55:45)&&w<=80);
 // Keep a long-garment sketch alive instead of letting short-hang/folding siblings
 // consume every beam slot. The unconstrained sketch remains available as well.
 if(!cfg.fixedSections&&!cfg.bayWidths&&strategy?.id==='balanced'&&widths.length>1&&c.demand.long>0&&suitable>=0&&
  minimum<=MODS.long.mx*10&&minimum<=c.height&&minimum+R.base-60<=c.reach){
  const long=[...roles];long[suitable]='long';options.push(long);
 }
 return options;
}
