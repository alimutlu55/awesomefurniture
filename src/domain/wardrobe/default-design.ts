import type { EditorDesign } from './editor-design';

/** A fresh design for each new cabinet. */
export function createInitialDesign(): EditorDesign {
 return {w:200,h:230,d:60,n:1,wt:[100,100,100,100,100,100],secs:[[],[],[],[],[],[]],dividers:[],fin:'Oak',doors:'none',profile:{needs:{short:24,long:6,pants:12,folded:30,shoes:8,small:30,bags:0},reach:185,longDrop:160,upper:'fill',drawers:'auto',allowLift:false,density:'comfort',growth:15,jackets:6,coats:2,accessible:false,reachStd:185,engaged:false},proposal:null};
}
