import { PANEL } from '../wardrobe/catalog.js';
import { hasTrait } from '../wardrobe/fittings';

export interface BoardRect {x0:number;x1:number;y0:number;y1:number}

/** Supporting surfaces from section dividers: horizontal shelves, plus the top face of upright dividers. */
export function sectionDividerBoards(dividers: readonly { orientation?: 'horizontal' | 'vertical'; x0: number; x1: number; y0: number; y1: number }[], offset = 0): BoardRect[] {
 return dividers.map(q => q.orientation === 'vertical'
  ? { x0: q.x0, x1: q.x1, y0: q.y1 + offset - PANEL, y1: q.y1 + offset }
  : { x0: q.x0, x1: q.x1, y0: q.y0 + offset, y1: q.y1 + offset });
}

/** Clear-width portions of a fitting's top board that need their own panel.
 * Frame ceilings and explicit shelves own shared boundaries. Centimetres. */
/** A ceiling is a flat height or, under a shaped top, the highest underside over a span. */
export type Ceiling=number|((x0:number,x1:number)=>number);
export function fittingBoardSpans(top:Pick<BoardRect,'x0'|'x1'> & {y1:number},ceiling:Ceiling,boards:readonly BoardRect[]) {
 if(top.y1>=(typeof ceiling==='number'?ceiling:ceiling(top.x0,top.x1))-.05)return [];
 let spans=[{x0:top.x0,x1:top.x1}];
 for(const board of boards){
  if(board.y0>top.y1+.06||board.y1<=top.y1-PANEL+.01)continue;
  spans=spans.flatMap(span=>{
   if(board.x1<=span.x0+.01||board.x0>=span.x1-.01)return [span];
   const pieces=[];
   if(board.x0>span.x0+.01)pieces.push({x0:span.x0,x1:Math.min(span.x1,board.x0)});
   if(board.x1<span.x1-.01)pieces.push({x0:Math.max(span.x0,board.x1),x1:span.x1});
   return pieces;
  });
 }
 return spans.filter(span=>span.x1-span.x0>PANEL+.01);
}

/** Where a section's uprights stand, to say which drawer edges have one: its width (the bay's own sides at 0 and
 * `width`) and its upright dividers. Without it no stack side is added (the planner's board count). */
export interface SectionUprights {width:number;dividers:readonly BoardRect[]}
const near=(a:number,b:number)=>Math.abs(a-b)<.5;
/** A section's uprights from its width and its dividers (dividerRect, heights above `floor`). */
export const sectionUprights=(width:number,dividers:readonly (BoardRect & {orientation?:string})[],floor:number):SectionUprights=>
 ({width,dividers:dividers.filter(q=>q.orientation==='vertical').map(q=>({...q,y0:floor+q.y0,y1:floor+q.y1}))});

/**
 * The side panel a stack of drawers stands against where it has no upright: a drawer runs on runners screwed to an
 * upright either side of it, so a stack narrower than its bay, with open space beside it, gets a panel at that edge,
 * inside its width (the fronts cover it), from the board under the stack to the one over it. Drawers one above another
 * with the same edge are one stack. Centimetres, the section's frame.
 */
export function drawerStackSides(items:readonly (BoardRect & {k?:string})[],panels:readonly {top:readonly BoardRect[];bottom:readonly BoardRect[]}[],uprights:SectionUprights) {
 const sides:{owner:number;side:BoardRect}[]=[];
 const standing=(x:number,item:BoardRect)=>near(x,0)||near(x,uprights.width)
  ||uprights.dividers.some(q=>(near(q.x0,x)||near(q.x1,x))&&q.y0<=item.y0+.5&&q.y1>=item.y1-.5);
 for(const edge of ['x0','x1'] as const){
  const open=items.map((item,j)=>({item,j})).filter(({item})=>hasTrait(item.k,'drawerBox')&&!standing(item[edge],item)).sort((p,q)=>p.item.y0-q.item.y0);
  for(const {item,j} of open){
   const x0=edge==='x0'?item.x0:item.x1-PANEL,x1=x0+PANEL,below=panels[j]!.bottom.length?PANEL:0,above=panels[j]!.top.length?PANEL:0;
   const last=sides.filter(s=>near(s.side.x0,x0)).find(s=>Math.abs(s.side.y1-(item.y0+below))<PANEL+.6);
   if(last){last.side={...last.side,y1:item.y1-above};last.owner=j;}
   else sides.push({owner:j,side:{x0,x1,y0:item.y0+below,y1:item.y1-above}});
  }
 }
 return sides;
}

/** Top boards own touching boundaries before bottom boards. Hanging rails need
 * no bottom board. Explicit boards and the cabinet frame take precedence. With `uprights`, a drawer stack with no upright
 * at an edge gets a side there (`side`, on the stack's top drawer), and the boards inside the stack stop at it. */
export function fittingPanels(items:readonly (BoardRect & {k?:string})[],floor:number,ceiling:Ceiling,explicit:readonly BoardRect[],uprights?:SectionUprights) {
 const owners=[...explicit];
 const result=items.map(()=>({top:[] as BoardRect[],bottom:[] as BoardRect[],support:[] as (Pick<BoardRect,'x0'|'x1'> & {rise:number})[],side:[] as BoardRect[]}));
 items.forEach((item,index)=>{
  for(const span of fittingBoardSpans(item,ceiling,owners)){
   const panel={...span,y0:item.y1-PANEL,y1:item.y1};
   result[index]!.top.push(panel);owners.push(panel);
  }
 });
 items.forEach((item,index)=>{
  if(hasTrait(item.k,'hanging'))return;
  const mirrored=owners.map(board=>({...board,y0:-board.y1,y1:-board.y0}));
  for(const span of fittingBoardSpans({...item,y1:-item.y0},-floor,mirrored)){
   const panel={...span,y0:item.y0,y1:item.y0+PANEL};
   result[index]!.bottom.push(panel);owners.push(panel);
  }
 });
 if(uprights)for(const {owner,side} of drawerStackSides(items,result,uprights)){
  result[owner]!.side.push(side);
  // A board between two drawers of the stack stops at its side; the boards under and over the whole stack run past it.
  const cut=(b:BoardRect)=>b.y0<side.y0-.01||b.y1>side.y1+.01||b.x1<=side.x0+.01||b.x0>=side.x1-.01?[b]
   :[{...b,x1:Math.min(b.x1,side.x0)},{...b,x0:Math.max(b.x0,side.x1)}].filter(q=>q.x1-q.x0>PANEL+.01);
  for(const r of result){r.top=r.top.flatMap(cut);r.bottom=r.bottom.flatMap(cut);}
 }
 items.forEach((item,index)=>{
  result[index]!.support=owners.filter(board=>board.y0<=item.y0+.06&&board.y1>=item.y0-.06&&board.y1<=item.y0+PANEL+.06&&board.x1>item.x0+.01&&board.x0<item.x1-.01)
   .map(board=>({x0:Math.max(item.x0,board.x0),x1:Math.min(item.x1,board.x1),rise:Math.max(0,board.y1-item.y0)}));
 });
 return result;
}
