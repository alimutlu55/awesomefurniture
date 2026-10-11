import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import type { EditorDivider,EditorItem } from '../wardrobe/editor-design';
import { WardrobePlanner as planner } from './wardrobe-planner.js';
import { boardSchedule } from './board-schedule';
import { CATEGORIES,CRITERIA,selectionContext,SELECTION_RULES as R,bandFit,clamp } from './selection-config';
import type { Category,Criteria } from './selection-config';
import { additionalGate,clearanceFit,interactionHeight } from './selection-modules';
import { boardRect,overlaps } from './selection-spaces';
import { hasTrait } from '../wardrobe/fittings';
const rounded=(n:number)=>Math.round(n*10000)/10000;
export interface PlacementReason {bay:number;item:number;kind:EditorItem['k'];reason:string;position:{x:number;y:number;z:number};size:{w:number;h:number;d:number};criteria:Criteria}
export function scoreLayout(sections:readonly PlannerSection[],cfg:PlannerConfig,dividers:readonly EditorDivider[]=[]) {
 const c=selectionContext(cfg),metrics=planner.analyze(sections,cfg),errors=[...metrics.errors],placements:PlacementReason[]=[];
 const frequencyTotal=CATEGORIES.reduce((n,k)=>n+c.demand[k]*R.frequency[k],0)||1;
 let accessibility=0,clearance=0,safety=0,weighted=0,occupied=0,unrequestedArea=0,positionSum=0;
 const remaining={...c.demand};
 const parts=new Set<string>(),bands=new Map<Category,{bay:number;y:number;top:number}[]>();
 // Inventory belongs in the best usable locations, independent of bay/item traversal.
 const samples=sections.flatMap((section,bay)=>{
  const layout=planner.layoutSection(section.items,section.width);
  return section.items.flatMap((source,item)=>{
   if(source.k==='void')return[];
   const pos=layout[item]!,it={...source,x:pos.x0,y:pos.y0,w:pos.w},category=it.purpose as Category;
   const local=planner.analyze([{width:pos.w,items:[{...it,x:0}]}],{...cfg,w:pos.w+R.panel/5});
   const access=interactionHeight(it,cfg);
   let band=CATEGORIES.includes(category)?bandFit(category,access,c.reach):0;
   if(hasTrait(it.k, 'openShelf')&&c.depth>R.rearDepth)band*=.75;
   return [{key:bay+':'+item,category,local,band,clear:clearanceFit(it,cfg),access,width:pos.w}];
  });
 });
 const evidence=new Map(samples.map(s=>[s.key,s])),allocation=new Map<string,number>();
 for(const sample of [...samples].sort((a,b)=>b.band-a.band||b.clear-a.clear||a.access-b.access||a.width-b.width)){
  if(!CATEGORIES.includes(sample.category))continue;
  const count=Math.min(remaining[sample.category],sample.local.capacities[sample.category]??0);
  allocation.set(sample.key,count);remaining[sample.category]=Math.max(0,remaining[sample.category]-count);
 }

 sections.forEach((section,bay)=>{
  const layout=planner.layoutSection(section.items,section.width);
  const rectangles=layout.map(p=>({x:p.x0*10,y:p.y0*10,w:p.w*10,h:p.h*10}));
  section.items.forEach((source,i)=>{
   const pos=layout[i]!,it={...source,x:pos.x0,y:pos.y0,w:pos.w},rect=rectangles[i]!;
   if((source.x??0)<-.01||(source.y??0)<-.01||(source.x??pos.x0)+(source.w??pos.w)>section.width+.01)errors.push(`Bay ${bay+1}: fixed coordinates are outside clear geometry.`);
   const gate=additionalGate(it,pos.w*10,pos.y0*10,cfg);if(gate)errors.push(`Bay ${bay+1}, item ${i+1}: ${gate}`);
   if(pos.x0<-.01||pos.x1>section.width+.01||pos.y0<-.01)errors.push(`Bay ${bay+1}: fitting outside its clear space.`);
   if(rectangles.some((other,j)=>j<i&&overlaps(rect,other)))errors.push(`Bay ${bay+1}: fittings overlap.`);
   if(dividers.some(d=>d.i===bay&&overlaps(rect,boardRect(d))))errors.push(`Bay ${bay+1}: fitting overlaps a board.`);
   if(it.k==='void')return;
   const category=it.purpose as Category,access=interactionHeight(it,cfg),cat=CATEGORIES.includes(category)?category:null;
   const local=evidence.get(bay+':'+i)!.local;
   const count=allocation.get(bay+':'+i)??0,weight=cat?count*R.frequency[cat]:.1;
   let band=cat?bandFit(cat,access,c.reach):access>=c.reach*.8?1:.4;
   if(hasTrait(it.k, 'openShelf')&&c.depth>R.rearDepth)band*=.75;
   const clear=clearanceFit(it,cfg),spanSafety=clamp((R.shelfSpan-pos.w*10)/R.shelfSpan+.25);
   const ergonomicSafety=cat&&['pants','folded'].includes(cat)&&access>c.reach*.8?.3:1;
   const safe=(spanSafety+ergonomicSafety)/2;
   accessibility+=cat?band*weight:0;clearance+=clear*weight;safety+=safe*weight;weighted+=weight;
   const fittingArea=pos.w*10*it.h*10;
   const seasonal=it.k==='seasonal'||['seasonal','linen','luggage'].includes(it.purpose??'');
   occupied+=fittingArea*(cat?Math.min(1,count/Math.max(1,local.capacities[category]??0)):seasonal?1:0);
   if(it.purpose==='reserve')occupied+=fittingArea*.5;
   if(!cat&&!seasonal&&it.purpose!=='reserve')unrequestedArea+=fittingArea;
   positionSum+=access;
   parts.add(`${Math.round(pos.w*10)},${Math.round(it.h*10)}`);
   if(cat){const list=bands.get(cat)??[];list.push({bay,y:pos.y0*10,top:pos.y1*10});bands.set(cat,list);}
   const criteria:Criteria={accessibility:rounded(band),clearance:rounded(clear),utilisation:1,grouping:1,safety:rounded(safe),buildability:Math.abs(pos.y0*10/R.grid-Math.round(pos.y0*10/R.grid))<.01?1:.5};
   placements.push({bay,item:i,kind:it.k,position:{x:pos.x0,y:pos.y0+R.base/10,z:0},size:{w:pos.w,h:it.h,d:c.depth/10},criteria,
    reason:it.purpose==='reserve'?`Adjustable ${Math.round(it.h)} cm compartment for additional belongings${pos.y1*10+R.base>c.reach?'; occasional storage above daily reach':'; within daily reach'}. No clothing or box inventory is assumed.`:cat?`${category} storage uses the ${access<=c.reach*.2?'floor':access<=c.reach*.4?'low':access<=c.reach*.8?'prime':access<=c.reach?'high':'above-reach'} band; capacity ${Math.floor(local.capacities[category]??0)} with checked clearance.`:it.purpose==='accessories'?'Open accessory storage uses a shelf compartment with checked height and reach; it adds no clothing inventory capacity.':'Seasonal storage stays above daily reach with box clearance.'});
  });
 });
 dividers.forEach((d,i)=>{
  const r=boardRect(d),s=sections[d.i];
  if(!s||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0||r.x<-.1||r.y<-.1||r.x+r.w>(s?.width??0)*10+.1||r.y+r.h>c.height+.1)errors.push(`Board ${i+1}: outside clear geometry.`);
  if(dividers.some((o,j)=>j<i&&o.i===d.i&&overlaps(r,boardRect(o))))errors.push(`Board ${i+1}: boards overlap.`);
 });
 const complete=!errors.length&&CATEGORIES.every(k=>(metrics.capacities[k]??0)>=c.demand[k]-.001);
 let groupCost=0;
 for(const list of bands.values()){
  list.sort((a,b)=>a.bay-b.bay||a.y-b.y);let groups=0,last:{bay:number;top:number}|undefined;
  for(const p of list){if(!last||p.bay!==last.bay||p.y>last.top+.1)groups++;last={bay:p.bay,top:p.top};}
  groupCost+=Math.max(0,groups-1);
 }
 const width=sections.reduce((n,s)=>n+s.width*10,0),area=width*c.height;
 const requested=CATEGORIES.filter(k=>c.demand[k]>0);
 const spareFit=requested.reduce((n,k)=>n+Math.min(1,c.demand[k]/Math.max(c.demand[k],metrics.capacities[k]??0)),0)/Math.max(1,requested.length);
 const demandFit=requested.reduce((n,k)=>n+Math.min(1,(metrics.capacities[k]??0)/c.demand[k]),0)/Math.max(1,requested.length);
 const standard=sections.reduce((n,s)=>n+Math.max(...R.widths.map(w=>clamp(1-Math.abs(w-s.width*10)/200))),0)/Math.max(1,sections.length);
 const near=(a:{bay:number;y:number;top:number},b:{bay:number;y:number;top:number})=>Math.abs(a.bay-b.bay)<=1&&Math.max(a.y-b.top,b.y-a.top)<=R.grid*2;
 const affinity=bands.has('folded')&&bands.has('pants')?(bands.get('folded')!.some(a=>bands.get('pants')!.some(b=>near(a,b)))?1:.5):1;
 const distinct=parts.size,partCount=placements.length+dividers.length+Math.max(0,sections.length-1);
 const gridScore=placements.reduce((n,p)=>n+p.criteria.buildability,0)/Math.max(1,placements.length);
 const criteria:Criteria={accessibility:clamp(accessibility/frequencyTotal),clearance:clamp(clearance/Math.max(.1,weighted)),
 utilisation:clamp(demandFit*.5+(area?occupied/area:0)*.2+spareFit*.3-(area?unrequestedArea/area:0)*.3),grouping:clamp((1-groupCost/Math.max(1,placements.length))*.8+affinity*.2),safety:clamp(safety/Math.max(.1,weighted)),
 buildability:clamp(standard*.3+gridScore*.3+Math.max(0,1-distinct/Math.max(1,placements.length))*.25+clamp(1-partCount/40)*.15)};
 for(const k of CRITERIA)criteria[k]=rounded(criteria[k]);
 const score=Math.round(100*CRITERIA.reduce((n,k)=>n+c.weights[k]*criteria[k],0)*100)/100;
 const finalMetrics={...metrics,valid:!errors.length,errors:[...new Set(errors)]};
 const currentDemand=selectionContext({...cfg,growth:0}).demand;
 const currentCategories=CATEGORIES.filter(k=>currentDemand[k]>0);
 const ratios=currentCategories.map(k=>Math.min(1,Math.floor(metrics.capacities[k]??0)/currentDemand[k]));
 const inventory={complete:currentCategories.length>0&&ratios.every(v=>v>=1),
  coverage:ratios.reduce((n,v)=>n+v,0)/Math.max(1,ratios.length),weakest:ratios.length?Math.min(...ratios):0,
  missing:currentCategories.filter(k=>(metrics.capacities[k]??0)<currentDemand[k]).map(k=>({key:k,missing:currentDemand[k]-Math.floor(metrics.capacities[k]??0)}))};
 return {score,complete,inventory,boards:boardSchedule(sections,cfg,dividers),breakdown:{criteria,weights:c.weights},metrics:finalMetrics,placements,partCount,positionSum};
}
