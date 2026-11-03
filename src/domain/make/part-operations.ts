import type { MakePart, MakePiece } from './make-parts';
import { boardPolygon } from './back-construction';

/** Local XYZ millimetres from the board's minimum XYZ corner, preserving the assembled axes.
 * This is an operation interchange record, not a CNC toolpath. Depth zero means through.
 * Machining is the exact removed XY polygon extruded between the two Z coordinates.
 */
export function partOperations(piece: MakePiece, part: MakePart) {
  const b = part.boards[0]!, origin = [b.x0, b.y0, b.z0];
  const mm = (cm: number) => Number((cm * 10).toPrecision(12));
  const polygon = (points: readonly {x:number;y:number}[]) => {
    const local = points.map(p => [mm(p.x-b.x0),mm(p.y-b.y0)]);
    const area = local.reduce((sum,p,i) => {const q=local[(i+1)%local.length]!;return sum+p[0]!*q[1]!-q[0]!*p[1]!;},0);
    if(area<0)local.reverse();
    const first=local.reduce((best,p,i)=>p[1]!<local[best]![1]! || p[1]===local[best]![1] && p[0]!<local[best]![0]! ? i : best,0);
    return [...local.slice(first),...local.slice(0,first)];
  };
  return {
    outline: polygon(boardPolygon(b)),
    z: [0,mm(b.z1-b.z0)],
    holes: piece.holes.filter(h=>h.board===part.ids[0]).map(h=>({kind:h.kind,at:h.at.map((v,i)=>mm(v-origin[i]!)),axis:h.axis,sign:h.sign,diameter:h.d,depth:h.depth})),
    machining: (b.machining??[]).map(m=>({kind:m.kind,outline:polygon(m.outline),z:[mm(m.z0-b.z0),mm(m.z1-b.z0)]})),
  };
}
