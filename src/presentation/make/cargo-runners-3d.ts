import * as THREE from 'three';
import type { MakePiece } from '../../domain/make/make-parts';
import type { Fitting } from '../../domain/make/make-joints';
import { cargoPulloutGeometry } from '../../domain/kitchen/cargo-pullout';

/** Carrier and guide share the cargo geometry; the cabinet channel stays fixed. */
export function cargoRunnerMeshes(piece:MakePiece,f:Fitting,geometry:THREE.BufferGeometry,metal:THREE.Material) {
 const front=piece.boards[f.runner!.moving[0]!]!, cx=(front.x0+front.x1)/2;
 const config=piece.fittings.find(q=>q.size?.startsWith('cargo frame:'))?.size?.split(':');
 const mount=config?.[3]==='left'?'left':config?.[3]==='right'?'right':'bottom';
 const geo=cargoPulloutGeometry(cx,front.y0,front.x1-front.x0,front.y1-front.y0,piece.size.d,{mount});
 return f.runner!.fixed.flatMap((board,k)=>{
  const host=piece.boards[board]!, upper=host.name==='Top', bounds=upper?geo.runners.top!:geo.runners.bottom;
  const x=mount!=='bottom' && !upper ? (mount==='left'?host.x1+.5:host.x0-.5) : cx;
  const y=upper?host.y0-1.5:mount==='bottom'?host.y1+1.5:(bounds.y0+bounds.y1)/2;
  return [0,.5,1].map(ratio=>{
   const mesh=new THREE.Group();mesh.position.set(x-piece.size.w/2,y,(bounds.z0+bounds.z1)/2-piece.size.d/2);
   const bar=new THREE.Mesh(geometry,metal);bar.scale.set(upper?3:4, .8,geo.runners.length*(1-ratio*.06));bar.position.y=ratio*.7;mesh.add(bar);
   return {mesh,board,moving:f.runner!.moving[k]!,ratio};
  });
 });
}
