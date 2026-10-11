import type { EditorDesign } from './editor-design';
import { defaultNeeds } from './possessions';

/** A fresh design for each new cabinet. */
export function createInitialDesign(): EditorDesign {
 return {w:200,h:230,d:60,n:1,wt:[100,100,100,100,100,100],secs:[[],[],[],[],[],[]],dividers:[],fin:'Oak',doors:'none',profile:{needs:defaultNeeds(),reach:185,longDrop:160,upper:'fill',drawers:'auto',allowLift:false,density:'comfort',growth:15,jackets:6,coats:2,accessible:false,reachStd:185,engaged:false},proposal:null};
}
