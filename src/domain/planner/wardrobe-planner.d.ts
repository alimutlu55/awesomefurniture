import type { EditorItem } from '../wardrobe/editor-design';
export interface LayoutPosition { x0: number; x1: number; y0: number; y1: number; w: number; h: number; off: number }
export interface PlannerSection { width: number; items: EditorItem[]; role?: string }
export interface PlannerMetrics {
  valid: boolean; errors: string[]; warnings: string[]; reachIssues: unknown[];
  capacities: Record<string, number>; coverage: Record<string, number>; shortfalls: { key: string; needed: number; capacity: number; missing: number }[]; overage: number;
  cost: number; ergo: number; doubleHang: number; usedHeight: number; usableHeight: number;
  utilization: number; highStorageLitres: number; unassignedLitres: number; maxDailyAccess: number; liftCount: number;
  seasonal: { targetBoxes: number; allocatedBoxes: number; coverage: number; zoneCount: number; fill: boolean };
}
export interface PlannerProposal {
  inventory?: {complete:boolean;coverage:number;weakest:number;missing:{key:string;missing:number}[]};
  familyVariant?: boolean;
  archetype?: string;
  dna?: import('./layout-dna').LayoutDNA;
  heroes?: Record<import('./design-archetypes').Hero,number>;
  comparison?: {hero:import('./design-archetypes').Hero;baseline:number;value:number;margin:number;gainPoints:number;giveUp:string};
  variations?: {archetype:string;score:number}[];
  selectionNote?: string;
  boards?: import('./board-schedule').PlanBoard[];
  dividers?: import('../wardrobe/editor-design').EditorDivider[];
  complete?: boolean;
  breakdown?: {criteria:import('./selection-config').Criteria;weights:import('./selection-config').Criteria};
  placements?: import('./layout-score').PlacementReason[];
  structureKey?: string;
  partCount?: number;
  positionSum?: number;
  composition?: {upperTopSpread?:number;dailyQuality?:{fillerHeight:number;lowFoldedHeight:number;drawerGroups:number;penalty:number};upperAligned:boolean;upperBayCount:number;upperShelfHeight:number|null;alignmentSpread:number;balance:number;score:number};
  id: string; title: string; summary: string; sections: PlannerSection[];
  /** Handbags asked for and placed on handbag shelves. Added after the clothing layout is chosen. */
  bags?: {requested:number;placed:number} | undefined;
  metrics: PlannerMetrics; cost: number; score: number; coverage: Record<string, number>; reasons: string[]; warnings: string[];
}
/** The preserved numerical engine accepts partial configurations and normalizes defaults. */
export type PlannerConfig = Record<string, unknown>;
export const WardrobePlanner: {
  generate(config: PlannerConfig): PlannerProposal[];
  analyze(sections: readonly PlannerSection[] | { sections: readonly PlannerSection[] }, config: PlannerConfig): PlannerMetrics;
  fitSection(width: number, config: PlannerConfig, index?: number): PlannerSection | null;
  layoutSection(items: readonly EditorItem[], width: number): LayoutPosition[];
  itemWidth(item: EditorItem, width: number): number;
  configure(config: PlannerConfig): void;
  longMin(drop: number): number;
  seasonalAllowance(config: PlannerConfig): number;
  zoneOf(height: number): string;
  accessInfo(item: EditorItem, bottom: number, config: PlannerConfig): {
    height: number; railHeight: number | null; handleHeight?: number; type: string;
    withinReach: boolean; aboveReach?: boolean; limit?: number; label: string;
  };
  placeItem(input: { bw: number; H: number; w: number; h: number; want: { x: number; y: number }; others?: { x0: number; x1: number; y0: number; y1: number }[]; snap?: boolean; tol?: number; grid?: number }): { x: number; y: number; pushed: boolean; snapX: string | null; snapY: string | null } | null;
  geo: {
    foldStacks(width: number, drawer: boolean): number;
    hangCount(width: number, front: boolean, depth: number, kind: string): number;
    spacing(kind: string): number; foldW(): number; shoeW(): number;
    pantsCount(width: number): number; shoePairs(width: number): number;
    smallCount(width: number, depth: number, height: number): number;
  };
};
