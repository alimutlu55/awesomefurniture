/** Handbags stand upright on open shelves. Design bag: 31 × 14 × 23 cm, 33 cm per bag with a 2 cm gap.
 * Centimetres. The shelf is 25 cm tall: the bag plus 2 cm of clearance. */
export const BAG = { width: 31, depth: 14, height: 23, pitch: 33, shelf: 25 } as const;

export const bagsPerShelf = (widthCm: number) => Math.max(0, Math.floor((widthCm - 2) / BAG.pitch));
