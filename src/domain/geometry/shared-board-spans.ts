import { PANEL } from '../wardrobe/catalog.js';

export interface BoardRect {x0:number;x1:number;y0:number;y1:number}
/** Clear-width portions of a fitting's top board that need their own panel.
 * Frame ceilings and explicit shelves own shared boundaries. Centimetres. */
export function fittingBoardSpans(top:Pick<BoardRect,'x0'|'x1'> & {y1:number},ceiling:number,boards:readonly BoardRect[]) {
 if(top.y1>=ceiling-.05)return [];
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
 return spans;
}

/** Top boards own touching boundaries before bottom boards. Explicit boards and
 * the cabinet frame take precedence; partially shared widths are split. */
export function fittingPanels(items:readonly BoardRect[],floor:number,ceiling:number,explicit:readonly BoardRect[]) {
 const owners=[...explicit];
 const result=items.map(()=>({top:[] as BoardRect[],bottom:[] as BoardRect[],support:[] as (Pick<BoardRect,'x0'|'x1'> & {rise:number})[]}));
 items.forEach((item,index)=>{
  for(const span of fittingBoardSpans(item,ceiling,owners)){
   const panel={...span,y0:item.y1-PANEL,y1:item.y1};
   result[index]!.top.push(panel);owners.push(panel);
  }
 });
 items.forEach((item,index)=>{
  const mirrored=owners.map(board=>({...board,y0:-board.y1,y1:-board.y0}));
  for(const span of fittingBoardSpans({...item,y1:-item.y0},-floor,mirrored)){
   const panel={...span,y0:item.y0,y1:item.y0+PANEL};
   result[index]!.bottom.push(panel);owners.push(panel);
  }
 });
 items.forEach((item,index)=>{
  result[index]!.support=owners.filter(board=>board.y0<=item.y0+.06&&board.y1>=item.y0-.06&&board.y1<=item.y0+PANEL+.06&&board.x1>item.x0+.01&&board.x0<item.x1-.01)
   .map(board=>({x0:Math.max(item.x0,board.x0),x1:Math.min(item.x1,board.x1),rise:Math.max(0,board.y1-item.y0)}));
 });
 return result;
}
