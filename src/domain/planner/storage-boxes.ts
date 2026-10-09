export interface StorageBoxSize { width: number; height: number; depth: number }
export const DEFAULT_BOX: Readonly<StorageBoxSize> = Object.freeze({width:30,height:30,depth:30});
export function storageBoxSize(config: Record<string,unknown>): StorageBoxSize {
 const dimension=(key:string)=>typeof config[key]==='number'&&Number.isFinite(config[key])&&config[key]>0?config[key] as number:30;
 return {width:dimension('boxWidth'),height:dimension('boxHeight'),depth:dimension('boxDepth')};
}
/** 2 cm between boxes, 1 cm at each side and 3 cm total depth clearance. */
export function packStorageBoxes(width:number, depth:number, requested:number, size:StorageBoxSize=DEFAULT_BOX) {
 if (![width,depth,size.width,size.depth,size.height].every(x=>Number.isFinite(x)&&x>0)) return {capacity:0,positions:[] as {x:number;z:number}[]};
 const cols=Math.max(0,Math.floor((width+1e-6)/(size.width+2)));
 const rows=Math.max(0,Math.floor((depth-1+1e-6)/(size.depth+2)));
 const capacity=cols*rows,count=Math.max(0,Math.min(capacity,Math.floor(Number.isFinite(requested)?requested:0)));
 const usedRows=cols?Math.ceil(count/cols):0;
 const positions=Array.from({length:count},(_,i)=>{
  const row=Math.floor(i/cols),inRow=Math.min(cols,count-row*cols);
  return {x:(i%cols-(inRow-1)/2)*(size.width+2),z:((usedRows-1)/2-row)*(size.depth+2)};
 });
 return {capacity,positions};
}
