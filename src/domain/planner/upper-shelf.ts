import type { PlannerConfig } from './wardrobe-planner';
import type { OpenSpace } from './selection-spaces';
import { selectionContext,SELECTION_RULES as R,CATEGORIES } from './selection-config';
import { storageBoxSize } from './storage-boxes';
import { MODS } from '../wardrobe/catalog.js';

/** Cabinet-wide datum chosen before fitting individual bays (millimetres from
 * the internal floor). Rail-to-shelf allowance protects reachable hanging. */
export function upperShelfHeight(cfg:PlannerConfig):number|undefined {
 const c=selectionContext(cfg);
 if(cfg.fixedSections||cfg.upper==='none'||!CATEGORIES.some(k=>c.demand[k]>0))return undefined;
 const minimum=Math.max(MODS.seasonal.mn*10,Math.ceil(storageBoxSize(cfg).height+R.panel/10+R.removalGap/10)*10);
 const longMinimum=Math.max(MODS.long.mn*10,c.longDrop+R.hookAllowance+R.hemClearance);
 const reachableLong=c.demand.long>0&&longMinimum<=MODS.long.mx*10&&longMinimum+R.base-60<=c.reach;
 const lowest=Math.max(c.reach-R.base,reachableLong?longMinimum:0),highest=c.height-minimum;
 if(highest<lowest)return undefined;
 // Shoe-dominant cabinets need their highest daily shelf at reach, whereas a
 // hanging rail sits 6 cm below its compartment top. Reserving that rail offset
 // above shoe stacks strands a slit that cannot be absorbed without losing access.
 const shelfDominant=c.demand.shoes>c.demand.short+c.demand.long;
 const railAllowance=(shelfDominant?0:60)+(cfg.allowLift===true&&c.demand.short>0?650:0);
 return Math.min(highest,Math.max(lowest,c.reach-R.base+railAllowance));
}

/** A planning boundary, not an obstacle. Both sides stay usable but no generated
 * fitting may straddle the common shelf line. Actual fittings supply its boards. */
export function upperShelfSpaces(spaces:readonly OpenSpace[],cfg:PlannerConfig):OpenSpace[] {
 const height=upperShelfHeight(cfg);
 if(height===undefined)return [...spaces];
 return spaces.flatMap(sp=>height>sp.y+.1&&height<sp.y+sp.h-.1
  ? [{...sp,h:height-sp.y},{...sp,y:height,h:sp.y+sp.h-height}]:[sp]);
}
