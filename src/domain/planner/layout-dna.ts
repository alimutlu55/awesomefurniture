import type { PlannerConfig,PlannerSection } from './wardrobe-planner';
import { WardrobePlanner as physical } from './wardrobe-planner.js';
import { CATEGORIES,selectionContext,SELECTION_RULES as R } from './selection-config';
import { interactionHeight } from './selection-modules';
export const DNA_THRESHOLD=.2;
export const DNA_TYPES=['hang','drawers','open','shoes','seasonal','spare'] as const;
export interface LayoutDNA {shares:Record<typeof DNA_TYPES[number],number>;columns:number;widthPattern:number[];zones:number[][]}
export function layoutDNA(sections:readonly PlannerSection[],cfg:PlannerConfig):LayoutDNA {
 const c=selectionContext(cfg),area=sections.reduce((n,s)=>n+s.width*10*c.height,0)||1;
 const shares={hang:0,drawers:0,open:0,shoes:0,seasonal:0,spare:0};
 const zones=CATEGORIES.map(()=>[0,0,0,0,0]);
 for(const s of sections){const positions=physical.layoutSection(s.items,s.width);
  s.items.forEach((it,i)=>{const p=positions[i]!,a=p.w*it.h*100/area;
   const kind=it.k==='void'?'spare':['short','long','lift'].includes(it.k)?'hang':['drawer','sdrawer','basket'].includes(it.k)?'drawers':it.k==='shoe'?'shoes':it.k==='seasonal'?'seasonal':'open';
   shares[kind]+=a;
   const cat=CATEGORIES.indexOf(it.purpose as typeof CATEGORIES[number]);if(cat<0)return;
   const height=Math.round(interactionHeight({...it,y:p.y0},cfg)/R.grid)*R.grid/c.reach;
   const zone=height<=.2?0:height<=.4?1:height<=.8?2:height<=1?3:4;
   zones[cat]![zone]!+=a;
  });
 }
 shares.spare+=Math.max(0,1-Object.values(shares).reduce((a,b)=>a+b,0));
 zones.forEach(z=>{const sum=z.reduce((a,b)=>a+b,0);if(sum)z.forEach((_,i)=>z[i]!/=sum);});
 // Sorted quantized widths erase mirrored order and sub-pitch geometric noise.
 return {shares,columns:sections.length,widthPattern:sections.map(s=>Math.round(s.width*10/64)*64).sort((a,b)=>a-b),zones};
}
export function dnaDistance(a:LayoutDNA,b:LayoutDNA):number {
 const shares=DNA_TYPES.reduce((n,k)=>n+Math.abs(a.shares[k]-b.shares[k]),0)/2;
 const count=Math.abs(a.columns-b.columns)/Math.max(1,a.columns,b.columns);
 const widthLength=Math.max(a.widthPattern.length,b.widthPattern.length),widths=Array.from({length:widthLength},(_,i)=>Math.min(1,Math.abs((a.widthPattern[i]??0)-(b.widthPattern[i]??0))/800)).reduce((x,y)=>x+y,0)/Math.max(1,widthLength);
 let zoneDifference=0,active=0;
 a.zones.forEach((z,i)=>{const other=b.zones[i]!;if(!z.some(Boolean)&&!other.some(Boolean))return;active++;zoneDifference+=z.reduce((n,v,j)=>n+Math.abs(v-other[j]!),0)/2;});
 return shares*.55+(count*.5+widths*.5)*.25+(zoneDifference/Math.max(1,active))*.20;
}
