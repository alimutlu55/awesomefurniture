import type { EditorItem } from '../wardrobe/editor-design';
import type { PlannerConfig } from './wardrobe-planner';
import { MODS } from '../wardrobe/catalog.js';
import { storageBoxSize } from './storage-boxes';
import { selectionContext,SELECTION_RULES as R } from './selection-config';
/** A purpose cannot bypass the limits of the storage it represents. Centimetres. */
export function storageHeightLimits(it:EditorItem,cfg:PlannerConfig) {
 const catalog=MODS[it.k];let min:number=catalog.mn,max:number=catalog.mx;
 if(it.purpose==='reserve'){min=Math.max(min,15);max=Math.min(max,40);}
 if(it.k==='long')min=Math.max(min,(selectionContext(cfg).longDrop+R.hookAllowance+R.hemClearance)/10);
 if(it.k==='shelf'&&['folded','pants'].includes(it.purpose??'')){min=Math.max(min,MODS.folded.mn);max=Math.min(max,MODS.folded.mx);}
 if(it.k==='seasonal')min=Math.max(min,Math.ceil(storageBoxSize(cfg).height+R.panel/10+R.removalGap/10));
 return {min,max};
}
