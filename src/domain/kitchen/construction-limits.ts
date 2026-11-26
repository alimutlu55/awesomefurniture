/** What each kitchen construction setting can physically be, in centimetres. The field, the command and the saved
 * format all read this table. `upTo` names a further limit set by the unit itself. */
export const KITCHEN_CONSTRUCTION_LIMITS = Object.freeze({
  /** 0 is no plinth (legs or a wall unit); kitchen plinths are 10–15 cm, adjustable legs reach 30 cm. */
  plinthHeight: { min: 0, max: 30 },
  /** The corner allowance: at least a millimetre of strip, at most a 30 cm blind corner. */
  cornerStrip: { min: .1, max: 30 },
  /** End panels: 0 is none; 10 cm is a thick decorative or mitred panel. */
  leftPanelThickness: { min: 0, max: 10 },
  rightPanelThickness: { min: 0, max: 10 },
  endPanelThickness: { min: 0, max: 10 },
  /** The thinnest front is 4 mm glass; 5 cm is a framed or solid-wood door. */
  frontThickness: { min: .4, max: 5 },
  /** The thinnest worktop is 10 mm compact laminate; 15 cm is a mitred stone apron. */
  worktopThickness: { min: 1, max: 15 },
  /** A grille no wider than the unit and no taller than the plinth it sits in. */
  ventilationWidth: { min: 0, max: 150, upTo: 'width' },
  ventilationHeight: { min: 0, max: 30, upTo: 'plinth' },
  /** The lower fridge door: 0 is one door; never taller than the unit. */
  fridgeSplit: { min: 0, max: 270, upTo: 'height' },
} as const);

export type KitchenConstructionKey = keyof typeof KITCHEN_CONSTRUCTION_LIMITS;

/** The range a setting can take on this unit, in centimetres. The plinth is part of the unit's height, so it may only
 * change as far as keeps the unit a height it is made in (`heights`, the unit's own height range). */
export function kitchenConstructionRange(key: KitchenConstructionKey,
  unit: { w: number; h: number; plinth: number; heights?: readonly [number, number] | undefined }) {
  const limit: { min: number; max: number; upTo?: 'width' | 'height' | 'plinth' } = KITCHEN_CONSTRUCTION_LIMITS[key];
  const bound = limit.upTo === 'width' ? unit.w : limit.upTo === 'height' ? unit.h : limit.upTo === 'plinth' ? unit.plinth : Infinity;
  const range = { min: limit.min, max: Math.min(limit.max, bound) };
  if (key === 'plinthHeight' && unit.heights) {
    const [lowest, tallest] = unit.heights, round = (v: number) => Math.round(v * 10) / 10;
    range.min = Math.max(range.min, round(unit.plinth - (unit.h - lowest)));
    range.max = Math.min(range.max, round(unit.plinth + (tallest - unit.h)));
  }
  return range;
}
