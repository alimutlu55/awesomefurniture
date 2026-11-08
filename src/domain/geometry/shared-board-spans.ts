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

/** The most a drawer stands off the one under it and still makes one stack with it (cm). */
export const STACK_GAP = 5;
type Fitted = BoardRect & {k?:string};

/**
 * Drawers stacked as a chest of drawers is built: drawers the same width, one above another, at most STACK_GAP apart with
 * nothing between, are one stack (by their place in `items`, lowest first). A stack has a board under its lowest drawer
 * and one over its highest and none between them: its drawers run on runners screwed to the uprights either side.
 * Every drawer is a stack, of one when nothing stacks with it.
 */
export function drawerStacks(items:readonly Fitted[]):number[][] {
 const stacks:number[][]=[];
 const order=items.map((item,j)=>({item,j})).filter(({item})=>hasTrait(item.k,'drawerBox')).sort((p,q)=>p.item.y0-q.item.y0);
 for(const {item,j} of order){
  const stack=stacks.find(st=>{
   const under=items[st.at(-1)!]!,gap=item.y0-under.y1;
   const between=items.some((o,k)=>k!==j&&!st.includes(k)&&o.x0<item.x1-.01&&item.x0<o.x1-.01&&o.y0<item.y0-.01&&o.y1>under.y1+.01);
   return near(under.x0,item.x0)&&near(under.x1,item.x1)&&gap>-.06&&gap<=STACK_GAP&&!between;
  });
  if(stack)stack.push(j);else stacks.push([j]);
 }
 return stacks;
}

/** The height each drawer's front covers: its own, and in a stack, its own height and an equal share of the gaps between
 * the drawers, one after another from the stack's foot, so drawers alike get fronts alike at one even reveal however far
 * apart they were placed. */
export function stackFrontSpans(items:readonly Fitted[],stacks:readonly (readonly number[])[]=drawerStacks(items)):{y0:number;y1:number}[] {
 const spans=items.map(item=>({y0:item.y0,y1:item.y1}));
 for(const st of stacks){
  const share=st.slice(1).reduce((sum,j,n)=>sum+items[j]!.y0-items[st[n]!]!.y1,0)/st.length;
  let y=items[st[0]!]!.y0;
  for(const j of st){const h=items[j]!.y1-items[j]!.y0;spans[j]={y0:y,y1:y+=h+share};}
 }
 return spans;
}

/**
 * The side panel a stack of drawers stands against where it has no upright: a drawer runs on runners screwed to an
 * upright either side of it, so a stack narrower than its bay, with open space beside it, gets a panel at that edge,
 * inside its width (the fronts cover it), from the board under the stack to the one over it (drawerStacks). Centimetres,
 * the section's frame.
 */
export function drawerStackSides(items:readonly Fitted[],panels:readonly {top:readonly BoardRect[];bottom:readonly BoardRect[]}[],uprights:SectionUprights,
 stacks:readonly (readonly number[])[]=drawerStacks(items)) {
 const sides:{owner:number;side:BoardRect}[]=[];
 const standing=(x:number,y0:number,y1:number)=>near(x,0)||near(x,uprights.width)
  ||uprights.dividers.some(q=>(near(q.x0,x)||near(q.x1,x))&&q.y0<=y0+.5&&q.y1>=y1-.5);
 for(const st of stacks){
  const low=st[0]!,high=st.at(-1)!,first=items[low]!,y0=first.y0,y1=items[high]!.y1;
  for(const edge of ['x0','x1'] as const){
   if(standing(first[edge],y0,y1))continue;
   const x0=edge==='x0'?first.x0:first.x1-PANEL,below=panels[low]!.bottom.length?PANEL:0,above=panels[high]!.top.length?PANEL:0;
   sides.push({owner:high,side:{x0,x1:x0+PANEL,y0:y0+below,y1:y1-above}});
  }
 }
 return sides;
}

/** Top boards own touching boundaries before bottom boards. Hanging rails need
 * no bottom board. Explicit boards and the cabinet frame take precedence. With `uprights`, a drawer stack with no upright
 * at an edge gets a side there (`side`, on the stack's top drawer), and the boards inside the stack stop at it. */
export function fittingPanels(items:readonly Fitted[],floor:number,ceiling:Ceiling,explicit:readonly BoardRect[],uprights?:SectionUprights) {
 const owners=[...explicit],stacks=drawerStacks(items),fronts=stackFrontSpans(items,stacks);
 // Inside a stack of drawers no board: only under its lowest drawer and over its highest.
 const notTop=new Set(stacks.flatMap(st=>st.slice(0,-1))),notBottom=new Set(stacks.flatMap(st=>st.slice(1)));
 const result=items.map((_,j)=>({top:[] as BoardRect[],bottom:[] as BoardRect[],support:[] as (Pick<BoardRect,'x0'|'x1'> & {rise:number})[],side:[] as BoardRect[],front:fronts[j]!}));
 items.forEach((item,index)=>{
  if(notTop.has(index))return;
  for(const span of fittingBoardSpans(item,ceiling,owners)){
   const panel={...span,y0:item.y1-PANEL,y1:item.y1};
   result[index]!.top.push(panel);owners.push(panel);
  }
 });
 items.forEach((item,index)=>{
  if(hasTrait(item.k,'hanging')||notBottom.has(index))return;
  const mirrored=owners.map(board=>({...board,y0:-board.y1,y1:-board.y0}));
  for(const span of fittingBoardSpans({...item,y1:-item.y0},-floor,mirrored)){
   const panel={...span,y0:item.y0,y1:item.y0+PANEL};
   result[index]!.bottom.push(panel);owners.push(panel);
  }
 });
 if(uprights)for(const {owner,side} of drawerStackSides(items,result,uprights,stacks)){
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
