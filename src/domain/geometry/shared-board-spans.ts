import { PANEL } from '../wardrobe/catalog.js';

interface BoardRect {x0:number;x1:number;y0:number;y1:number}
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
