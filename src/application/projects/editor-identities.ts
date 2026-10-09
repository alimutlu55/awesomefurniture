import type { EditorCabinet } from './editor-scene';

/** Assign once before taking scene/history snapshots. Deep copies inherit IDs,
 * so duplicate entities receive fresh IDs while existing objects keep theirs. */
export function ensureEditorIdentities(cabinets: readonly EditorCabinet[], newId: () => string): void {
 const seen=new Set<string>();
 for(const cabinet of cabinets){
  for(const entity of [...cabinet.state.secs.flat(),...cabinet.state.dividers]){
   if(!entity.id || seen.has(entity.id)) entity.id=newId();
   seen.add(entity.id);
  }
 }
}
