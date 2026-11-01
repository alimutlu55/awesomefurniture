/**
 * How a piece is put together, chosen per piece in Make and saved with the design. None of it changes the piece's
 * size or its boards' sizes: it changes how the boards are joined, how the back is held, and what is drilled.
 */
export const JOINT_SYSTEMS = ['confirmat', 'cam', 'dowel'] as const;
export type JointSystem = typeof JOINT_SYSTEMS[number];
export const BACK_FIXINGS = ['nailed', 'grooved'] as const;
export type BackFixing = typeof BACK_FIXINGS[number];

export interface Construction {
  /** Carcass joints: one-piece connectors screwed through the face (confirmat), cam and dowel (flat-pack), or glued dowels. */
  readonly joints: JointSystem;
  /** The back: nailed into a rebate, or slid into a groove in the boards around it. */
  readonly back: BackFixing;
}
export const DEFAULT_CONSTRUCTION: Construction = { joints: 'confirmat', back: 'nailed' };

/** A piece's construction, its saved choices over the defaults. */
export function constructionOf(design: { construction?: Partial<Construction> | undefined }): Construction {
  const saved = design.construction ?? {};
  return {
    joints: JOINT_SYSTEMS.includes(saved.joints as JointSystem) ? saved.joints as JointSystem : DEFAULT_CONSTRUCTION.joints,
    back: BACK_FIXINGS.includes(saved.back as BackFixing) ? saved.back as BackFixing : DEFAULT_CONSTRUCTION.back,
  };
}
