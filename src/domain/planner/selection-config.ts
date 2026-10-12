import type { PlannerConfig } from './wardrobe-planner';
import { PANEL, PLINTH } from '../wardrobe/catalog.js';
import { POSSESSIONS, defaultNeeds } from '../wardrobe/possessions';
import type { PossessionKey } from '../wardrobe/possessions';
/** Planner categories are the possessions registry: add a possession there, not here. */
export const CATEGORIES = POSSESSIONS.map(p=>p.key) as readonly PossessionKey[];
export type Category = PossessionKey;
export type Demand = Record<Category,number>;
export const CRITERIA = ['accessibility','clearance','utilisation','grouping','safety','buildability'] as const;
export type Criterion = typeof CRITERIA[number];
export type Criteria = Record<Criterion,number>;
/** Millimetres inside selection; existing centimetre editor/catalog stay unchanged. */
export const SELECTION_RULES = Object.freeze({
 proposalCount:8,candidateCount:24,beamWidth:32,conceptBeamQuota:4,maxSteps:48,maxParts:40,maxSections:6,grid:32,panel:PANEL*10,base:(PLINTH+PANEL)*10,
 minBay:250,widths:[400,500,600,800,1000],zones:[.2,.4,.8,1],rearDepth:450,
 railSpan:1200,coatSpan:900,shelfSpan:800,hookAllowance:100,hemClearance:50,
 handGap:40,idealHandGap:[30,60],wasteHandGap:150,sliver:30,defaultSpare:15,
 foldThickness:30,stackLayers:{compact:8,comfort:6,spacious:5},drawerIdeal:260,smallDrawerIdeal:120,removalGap:20,
 normalisedWeights:{storage:{accessibility:.25,clearance:.15,utilisation:.30,grouping:.10,safety:.10,buildability:.10},
 comfort:{accessibility:.40,clearance:.18,utilisation:.12,grouping:.12,safety:.10,buildability:.08},
 simple:{accessibility:.25,clearance:1/6,utilisation:.125,grouping:.125,safety:1/12,buildability:.25}},
 frequency:Object.fromEntries(POSSESSIONS.map(p=>[p.key,p.planner.frequency])) as Record<PossessionKey,number>,
 home:Object.fromEntries(POSSESSIONS.map(p=>[p.key,p.planner.home])) as Record<PossessionKey,readonly [number,number]>,
 weights:{accessibility:.30,clearance:.20,utilisation:.15,grouping:.15,safety:.10,buildability:.10},
} as const);
const R_STORAGE_WEIGHTS=SELECTION_RULES.normalisedWeights.storage;
export const number = (value:unknown,fallback:number) => typeof value==='number'&&Number.isFinite(value)?value:fallback;
export const clamp = (n:number,lo=0,hi=1) => Math.max(lo,Math.min(hi,n));
export function buildDemand(cfg:PlannerConfig):Demand {
 const needs=cfg.needs as Partial<Demand>|undefined,spare=clamp(number(cfg.growth,SELECTION_RULES.defaultSpare),0,30);
 const defaults:Demand=defaultNeeds();
 return Object.fromEntries(CATEGORIES.map(k=>[k,Math.ceil(Math.max(0,number(needs?.[k],defaults[k]))*(1+spare/100)-1e-9)])) as Demand;
}
/** The selection context of a planner configuration. Planning asks for it thousands of times with the same
 * configuration object, so it is built once per object (configurations are never changed in place) and frozen. */
const CONTEXTS=new WeakMap<PlannerConfig,ReturnType<typeof buildContext>>();
export function selectionContext(cfg:PlannerConfig) {
 let context=CONTEXTS.get(cfg);
 if(!context){context=buildContext(cfg);CONTEXTS.set(cfg,context);}
 return context;
}
function buildContext(cfg:PlannerConfig) {
 const reach=number(cfg.reach,185)*10,depth=number(cfg.d,60)*10,height=number(cfg.h,230)*10-SELECTION_RULES.base-SELECTION_RULES.panel;
 return Object.freeze({reach,depth,height,accessible:cfg.accessible===true,longDrop:number(cfg.longDrop,160)*10,spare:number(cfg.growth,15),demand:Object.freeze(buildDemand(cfg)),
 weights:Object.freeze(cfg.composition==='storage'?R_STORAGE_WEIGHTS:({...SELECTION_RULES.weights}) as Criteria)});
}
export function bandFit(category:Category,interaction:number,reach:number) {
 const [lo,hi]=SELECTION_RULES.home[category],r=interaction/Math.max(1,reach);
 return r>=lo&&r<=hi?1:clamp(1-Math.max(lo-r,r-hi)/.4);
}
export const snapUp=(mm:number)=>Math.ceil((mm-1e-6)/SELECTION_RULES.grid)*SELECTION_RULES.grid;
