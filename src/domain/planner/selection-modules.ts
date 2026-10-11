import type { EditorItem } from '../wardrobe/editor-design';
import type { PlannerConfig } from './wardrobe-planner';
import { WardrobePlanner as planner } from './wardrobe-planner.js';
import { MODS } from '../wardrobe/catalog.js';
import { storageBoxSize,packStorageBoxes } from './storage-boxes';
import { SELECTION_RULES as R,CATEGORIES,selectionContext,bandFit,snapUp,clamp } from './selection-config';
import type { Demand,Category } from './selection-config';
import { upperShelfHeight } from './upper-shelf';
import { storageHeightLimits } from './storage-fitting-limits';
import type { OpenSpace } from './selection-spaces';
import { shelfPossession } from '../wardrobe/possessions';
export interface ModuleCandidate {items:EditorItem[];capacity:Demand;seasonalBoxes:number;height:number;value:number;clearance:number;reason:string}
export function clearanceFit(it:EditorItem,cfg:PlannerConfig):number {
 const c=selectionContext(cfg),h=it.h*10;
 if(it.k==='void')return 0;
 if(['short','long','lift'].includes(it.k)){
  const min=it.k==='long'?c.longDrop+R.hookAllowance+R.hemClearance:MODS[it.k].mn*10;
  return h<min-.1?0:h<=min+100?1:clamp(1-(h-min-100)/200);
 }
 if(it.k==='folded'||(it.k==='shelf'&&['folded','pants'].includes(it.purpose??''))){
  const density=cfg.density==='compact'?'compact':cfg.density==='spacious'?'spacious':'comfort';
  const layers=Math.min(R.stackLayers[density],Math.floor((h-R.panel-R.idealHandGap[0])/R.foldThickness)),slack=h-R.panel-layers*R.foldThickness;
  return slack<R.idealHandGap[0]?0:slack<=R.idealHandGap[1]?1:clamp(1-(slack-R.idealHandGap[1])/(R.wasteHandGap-R.idealHandGap[1]));
 }
 return 1;
}
export function additionalGate(it:EditorItem,width:number,bottom:number,cfg:PlannerConfig):string|null {
 const c=selectionContext(cfg),h=it.h*10,kind=it.k;
 if(it.purpose==='reserve'&&kind!=='shelf')return 'Adjustable storage requires a shelf.';
 const limits=storageHeightLimits(it,cfg);
 if(kind!=='void'&&(it.h<limits.min-.03||it.h>limits.max+.03))return 'Storage purpose or fitting height exceeds its limits.';
 if(width>R.shelfSpan+.1&&kind!=='void')return 'Shelf span requires a supporting divider.';
 if(['short','long','lift'].includes(kind)){
  if(!it.front&&c.depth<500)return 'Hanging depth is insufficient.';
  if(width>(kind==='long'&&Number(cfg.coats)>0?R.coatSpan:R.railSpan)+.1)return 'Rail span requires support.';
  if(kind==='long'&&h<c.longDrop+R.hookAllowance+R.hemClearance-.1)return 'Long garment hook and hem clearance is insufficient.';
  if(kind==='lift'&&cfg.allowLift!==true)return 'Pull-down rails are opt-in.';
 }
 // Use the same centimetre-based reach rule as capacity analysis and manual layouts.
 if(['drawer','sdrawer','basket'].includes(kind)&&!planner.accessInfo(it,(bottom+R.base)/10,cfg).withinReach)return 'Drawer top exceeds the visible reach band.';
 return null;
}
export function modulesFor(space:OpenSpace,unmetDemand:Partial<Demand>,cfg:PlannerConfig,seasonalRemaining:number,compact=true):ModuleCandidate[] {
 // A category the caller does not mention has nothing unmet.
 const unmet=Object.fromEntries(CATEGORIES.map(k=>[k,unmetDemand[k]??0])) as Demand;
 const c=selectionContext(cfg),out:ModuleCandidate[]=[],size=storageBoxSize(cfg);
 const add=(specs:EditorItem[],reason:string)=>{
  const height=specs.reduce((n,it)=>n+it.h*10,0);if(height>space.h+.1)return;
  let y=space.y;
  const items=specs.map(it=>{const next={...it,x:space.x/10,y:y/10,w:space.w/10};y+=it.h*10;return next;});
  y=space.y;
  for(const it of items){if(additionalGate(it,space.w,y,cfg))return;y+=it.h*10;}
  const metrics=planner.analyze([{width:space.w/10,items:items.map(it=>({...it,x:0}))}],{...cfg,w:space.w/10+R.panel/5});
  if(!metrics.valid)return;
  const capacity=Object.fromEntries(CATEGORIES.map(k=>[k,metrics.capacities[k]??0])) as Demand;
  // Every daily fitting in a bank must serve remaining demand. A partly used final
  // fitting is normal; a whole unnecessary shelf/drawer is not a design alternative.
  for(const cat of CATEGORIES){
   const count=items.filter(it=>it.purpose===cat).length;
   if(count>1&&unmet[cat]<=capacity[cat]*(count-1)/count)return;
  }
  const clear=specs.reduce((n,it)=>n+clearanceFit(it,cfg),0)/specs.length;
  let benefit=0;
  items.forEach(it=>{const cat=it.purpose as Category;if(!CATEGORIES.includes(cat))return;const access=interactionHeight(it,cfg);
   benefit+=Math.min(capacity[cat],unmet[cat])*R.frequency[cat]*bandFit(cat,access,c.reach)*clear/items.filter(o=>o.purpose===cat).length;
  });
  const seasonal=metrics.capacities.seasonalBoxes??0;
  const served=CATEGORIES.reduce((n,k)=>n+Math.min(capacity[k],unmet[k]),0);
  if(!served&&!seasonal)return;
  out.push({items,capacity,seasonalBoxes:seasonal,height,value:(benefit+seasonal*.1)/(space.w*height/1e6),clearance:clear,reason});
 };
 const spec=(k:EditorItem['k'],purpose:EditorItem['purpose'],mm:number):EditorItem=>({k,purpose,h:mm/10,...(['short','long'].includes(k)&&c.depth<550?{front:true}:{})});
 for(const cat of CATEGORIES){
  if(unmet[cat]<=0)continue;
  if(cat==='short'||cat==='long'){
   const minimum=cat==='long'?Math.max(MODS.long.mn*10,c.longDrop+R.hookAllowance+R.hemClearance):MODS.short.mn*10;
   const heights=[snapUp(minimum),minimum,Math.min(MODS[cat].mx*10,Math.max(minimum,c.reach-R.base-space.y))];
   for(const h of new Set(heights))add([spec(cat,cat,h)],`${cat==='long'?'Long garments':'Shirts and jackets'} fit the rail clearance and reachable hanging band.`);
   if(cat==='short')add([spec('short','short',snapUp(minimum)),spec('short','short',snapUp(minimum))],'Two existing short-hang fittings use the available height; both rails remain reachable.');
   if(cat==='short'&&cfg.allowLift===true)add([spec('lift','short',snapUp(minimum))],'An enabled pull-down rail provides access through its reachable handle.');
  }else if(cat==='folded'||cat==='pants'){
   if(cat==='pants')add([spec('pants','pants',snapUp(MODS.pants.mn*10))],'Trouser pull-out keeps trousers together within reach.');
   // Include capacity breakpoints, not only pitch-rounded presets. A comfort
   // stack needs 228 mm, whereas 224 mm loses a layer and 288 mm wastes height.
   const layers=cat==='pants'?6:R.stackLayers[cfg.density==='compact'?'compact':cfg.density==='spacious'?'spacious':'comfort'];
   const thickness=cat==='pants'?40:R.foldThickness;
   const shelfHeight=Math.max(MODS.folded.mn*10,R.panel+R.idealHandGap[0]+layers*thickness);
   const drawerHeight=Math.max(MODS.drawer.mn*10,50+layers*thickness);
   for(const h of new Set([snapUp(MODS.folded.mn*10),snapUp(MODS.folded.h*10),300,...(compact?[shelfHeight]:[])]))add([spec('folded',cat,h)],`${cat==='pants'?'Folded trousers':'Folded clothing'} use this shelf with hand clearance; rear-depth access is included in the score.`);
   if(cfg.drawers!=='none')for(const h of new Set([snapUp(R.drawerIdeal),...(compact?[drawerHeight]:[])]))for(const n of [1,2,3])add(Array.from({length:n},()=>spec('drawer',cat,h)),'A grouped drawer bank makes folded clothing visible and accessible.');
  }else if(cat==='small'){
   add([spec('sdrawer','small',Math.max(MODS.sdrawer.mn*10,R.smallDrawerIdeal))],'A small-item drawer preserves practical contents and hand clearance.');
   add([spec('sdrawer','small',MODS.sdrawer.h*10)],'A standard-height small-item drawer gives extra room for organising underwear and socks.');
   for(const n of [1,2,3])add(Array.from({length:n},()=>spec('sdrawer','small',snapUp(R.smallDrawerIdeal))),'Small-item drawers keep underwear and socks together below the drawer reach limit.');
  }else if(shelfPossession(cat)){
   // A possession that stands on a shelf: one to maxStack stacked shelves of its own height.
   const held=shelfPossession(cat)!;
   for(let n=1;n<=held.holder.maxStack;n++)add(Array.from({length:n},()=>spec('shelf',cat,held.holder.height*10)),`${held.label} stand on shelves of their own, within reach.`);
  }else if(cat==='shoes'){
   for(const h of new Set([snapUp(MODS.shoe.mn*10),...(compact?[MODS.shoe.mn*10]:[])]))for(const n of [1,2,3])add(Array.from({length:n},()=>spec('shoe','shoes',h)),'Shoe tiers use lower storage without consuming the prime clothing band.');
  }
 }
 if(cfg.upper!=='none'&&seasonalRemaining>0){
  const h=Math.max(MODS.seasonal.mn*10,(size.height*10)+R.panel+R.removalGap),start=Math.max(space.y,upperShelfHeight(cfg)??(c.reach-R.base));
  const gap=start-space.y,room=space.h-gap;
  if(room>=h-.1&&space.w<=R.shelfSpan+.1){
   const boxes=Math.min(seasonalRemaining,packStorageBoxes(space.w/10,c.depth/10,0,size).capacity);
   if(boxes>0){const padding:EditorItem[]=gap>.1?[spec('void','free',gap)]:[];
    add([...padding,{k:'seasonal',purpose:'seasonal',h:Math.min(MODS.seasonal.mx*10,room)/10,boxes}], 'Seasonal boxes occupy space above daily reach, with measured box removal clearance.');
   }
  }
 }
 return out.sort((a,b)=>b.value-a.value||a.items.length-b.items.length||JSON.stringify(a.items).localeCompare(JSON.stringify(b.items)));
}
export function interactionHeight(it:EditorItem,cfg:PlannerConfig):number {
 const bottom=R.base+(it.y??0)*10,h=it.h*10;
 void cfg;
 if(['short','long'].includes(it.k))return bottom+h-60;
 if(it.k==='lift')return bottom+h-60-650;
 if(['drawer','sdrawer','pants','basket'].includes(it.k))return bottom+h;
 if(it.k==='seasonal')return bottom+h/2;
 return bottom+Math.min(h-R.panel,180)/2;
}
