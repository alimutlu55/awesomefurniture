export interface Box3D {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Official GTV Cargo Movix 150 / 200 Side-Mount manual specifications (centimetres unless noted). */
export const CARGO_MOVIX_SPECS = {
  /** Vertical spacing between lower and upper slides: 374 mm (Manual Pages 2 & 3). */
  slideVerticalSpacing: 37.4,
  /** Lower slide minimum distance from cabinet interior bottom: *min 50 mm undermount / *35 mm ball-bearing (Page 2). */
  lowerSlideOffset: 5.0,
  /** First slide screw hole setback from cabinet front edge: 45 mm undermount / 36 mm ball-bearing (Page 2). */
  slideFrontSetback: 4.5,
  /** Span between front (2–3 pręt) and rear (16–17 pręt) slide brackets: 192 mm (Pages 2 & 3). */
  slideBracketSpan: 19.2,
  /** Lower front fixing bracket height from bottom: *142 mm undermount / *106 mm ball-bearing (Page 2). */
  lowerFrontBracketOffset: 14.2,
  /** Vertical spacing between lower and upper front fixing brackets: 374 mm (Page 2). */
  frontBracketSpacing: 37.4,
  /** Horizontal screw spacing on Mocowania frontu: 78 mm = ±3.9 cm (Pages 2 & 3). */
  frontBracketScrewSpacing: 7.8,
  /** Front fixing bracket body dimensions: 103.5 × 36.5 mm (Page 3). */
  frontBracketWidth: 10.35,
  frontBracketHeight: 3.65,
  /** Maximum rated cargo load: 15 kg (Page 1). */
  maxLoadKg: 15,
  /** Nominal slide length 450 mm / full extension travel 430 mm (Pages 1 & 7). */
  nominalSlideMm: 450,
  extensionTravelMm: 430,
} as const;

export interface CargoBasketTier {
  readonly index: number;
  readonly y: number;
  readonly base: Box3D;
  readonly rail: Box3D;
  readonly railHeight: number;
  /** Clip-on transverse wire divider (6. Separatory, Manual Pages 1 & 7). */
  readonly separator: Box3D;
}

export interface CargoSlideBracket {
  readonly level: 'bottom' | 'top';
  readonly position: 'front' | 'rear';
  readonly wire: '2-3' | '16-17';
  readonly box: Box3D;
  /** Position of the vertical M4 × 6 locking screw (3. Wkręty montażowe M4×6, Manual Page 4). */
  readonly screwAt: readonly [number, number, number];
}

export interface CargoBracket {
  readonly y: number;
  readonly at: readonly [number, number, number];
  readonly screws: readonly (readonly [number, number, number])[];
  readonly width: number;
  readonly height: number;
  readonly cover: string;
}

export interface CargoPulloutOptions {
  readonly tiers?: number | undefined;
  readonly basketStyle?: 'wire' | 'solid' | undefined;
  readonly mount?: 'left' | 'right' | 'bottom' | undefined;
  readonly isTall?: boolean | undefined;
}

export interface CargoPullout {
  readonly isTall: boolean;
  readonly tiers: number;
  readonly basketStyle: 'wire' | 'solid';
  readonly mount: 'left' | 'right' | 'bottom';
  readonly basketW: number;
  readonly basketD: number;
  readonly maxLoadKg: number;
  readonly frame: {
    readonly uprights: readonly Box3D[];
    readonly crossbars: readonly Box3D[];
  };
  readonly runners: {
    readonly bottom: Box3D;
    readonly top?: Box3D | undefined;
    readonly length: number;
  };
  readonly slideBrackets: readonly CargoSlideBracket[];
  readonly baskets: readonly CargoBasketTier[];
  readonly separators: readonly Box3D[];
  readonly brackets: readonly CargoBracket[];
}

/** Standard tier count: base cargo has 2 tiers (or 3 for spice units); tall cargo has 4 to 6 tiers. */
export function cargoTierCount(hh: number, requested?: number): number {
  if (requested !== undefined && Number.isFinite(requested) && requested >= 2 && requested <= 6) {
    return Math.round(requested);
  }
  if (hh < 100) return 2;
  return Math.max(3, Math.min(6, Math.round(hh / 38)));
}

/** Basket width: 100mm (10.4cm Movix 150) for 150mm units, 150mm (15cm Movix 200) for 200mm units, or sw - 4cm for wider units. */
export function cargoBasketWidth(sw: number): number {
  if (sw <= 14) return 10;
  if (sw <= 20) return 15;
  return Math.max(10, Math.round((sw - 4) * 10) / 10);
}

/** Basket depth: typically 45cm to 50cm (464mm on GTV Movix), fitting comfortably inside depth d. */
export function cargoBasketDepth(d: number): number {
  return Math.max(20, Math.min(d - 6, 50));
}

/** Runner length matching depth (450mm standard GTV Movix PB-KO450BO / PK-L-H45-450, 500mm for deep carcasses). */
export function cargoRunnerLength(d: number): number {
  if (d >= 55) return 50;
  return Math.max(30, Math.min(45, Math.floor((d - 5) / 5) * 5));
}

/** Front fixing bracket count: 2 for base cargo; 3 or 4 for tall pantry cargo. */
export function cargoBracketCount(hh: number): number {
  if (hh >= 100) return hh >= 180 ? 4 : 3;
  return 2;
}

/** High-precision geometry of a kitchen cargo pull-out system following GTV Cargo Movix 150/200 manual. Centimetres. */
export function cargoPulloutGeometry(
  cx: number,
  y: number,
  sw: number,
  hh: number,
  d: number,
  options: CargoPulloutOptions = {}
): CargoPullout {
  const isTall = options.isTall ?? (hh >= 100);
  const tiers = cargoTierCount(hh, options.tiers);
  const basketStyle = options.basketStyle ?? 'wire';
  const mount = options.mount ?? (sw <= 20 ? 'left' : 'bottom');
  const basketW = cargoBasketWidth(sw);
  const basketD = cargoBasketDepth(d);
  const length = cargoRunnerLength(d);
  const z1 = d - 3.5;
  const z0 = z1 - basketD;
  const runnerZ0 = z1 - length;

  // Front Fixing Bracket Heights (GTV Manual Page 2: lower at *142 mm, upper at +374 mm = 516 mm)
  const bracketCount = cargoBracketCount(hh);
  const bracketHeights: number[] = [];
  if (isTall) {
    if (bracketCount === 4) {
      bracketHeights.push(y + 8, y + hh * 0.38, y + hh * 0.68, y + hh - 8);
    } else {
      bracketHeights.push(y + 8, y + hh * 0.5, y + hh - 8);
    }
  } else if (hh >= 58) {
    const lowerY = y + CARGO_MOVIX_SPECS.lowerFrontBracketOffset;
    bracketHeights.push(lowerY, lowerY + CARGO_MOVIX_SPECS.frontBracketSpacing);
  } else {
    const span = Math.min(CARGO_MOVIX_SPECS.frontBracketSpacing, Math.max(12, hh - 12));
    const midY = y + hh / 2;
    bracketHeights.push(midY - span / 2, midY + span / 2);
  }

  // Slide Vertical Positions (GTV Manual Page 2: lower slide at min 50 mm, upper slide at +374 mm = 424 mm)
  const lowerSlideY = y + CARGO_MOVIX_SPECS.lowerSlideOffset;
  const upperSlideY = isTall
    ? y + hh - 2.7
    : Math.min(y + hh - 5, lowerSlideY + CARGO_MOVIX_SPECS.slideVerticalSpacing);

  // Frame construction
  const uprights: Box3D[] = [];
  const crossbars: Box3D[] = [];
  const frameTop = y + hh - 4;
  const frameBottom = y + 2.5;
  const postX = isTall ? cx : mount === 'left' ? cx - sw / 2 + 2.5 : mount === 'right' ? cx + sw / 2 - 2.5 : cx;

  if (isTall) {
    // Tall larder pull-out: central rectangular steel ladder frame with longitudinal top/bottom guide rails
    const postW = 2.2;
    for (const side of [-1, 1]) {
      const px = cx + side * 2.8;
      uprights.push(
        { x0: px - postW / 2, x1: px + postW / 2, y0: frameBottom, y1: frameTop, z0: z0 + 1, z1: z0 + 3.2 },
        { x0: px - postW / 2, x1: px + postW / 2, y0: frameBottom, y1: frameTop, z0: z1 - 3.2, z1: z1 - 1 }
      );
    }
    crossbars.push(
      { x0: cx - 4, x1: cx + 4, y0: frameBottom, y1: frameBottom + 2.4, z0: z0 + 1, z1: z1 - 1 },
      { x0: cx - 4, x1: cx + 4, y0: frameTop - 2.4, y1: frameTop, z0: z0 + 1, z1: z1 - 1 }
    );
    for (const cy_ of [frameBottom + 2, y + hh * 0.38, y + hh * 0.68, frameTop - 2]) {
      crossbars.push(
        { x0: cx - 4, x1: cx + 4, y0: cy_ - 1, y1: cy_ + 1, z0: z0 + 1, z1: z0 + 3.2 }
      );
    }
    for (const by of bracketHeights) {
      crossbars.push(
        { x0: cx - 2.2, x1: cx + 2.2, y0: by - 1, y1: by + 1, z0: z1 - 3.2, z1: d - .5 }
      );
    }
  } else {
    // Base cargo pull-out: rigid steel chassis spanning full depth with direct bracket coupling arms
    uprights.push(
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameBottom, y1: frameTop, z0: z0 + 1, z1: z0 + 3 },
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameBottom, y1: frameTop, z0: z1 - 3.2, z1: z1 - 1.2 }
    );
    // Longitudinal lower and upper structural slide carrier rails at exact 374 mm spacing
    crossbars.push(
      { x0: postX - 1.4, x1: postX + 1.4, y0: frameBottom, y1: frameBottom + 2.2, z0: z0 + 1, z1: z1 - 0.8 },
      { x0: postX - 1.2, x1: postX + 1.2, y0: upperSlideY - 1.1, y1: upperSlideY + 1.1, z0: z0 + 1, z1: z1 - 0.8 },
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameTop - 2, y1: frameTop, z0: z0 + 1, z1: z1 - 0.8 },
      // Rear basket support crossbars
      { x0: Math.min(postX, cx - basketW / 2), x1: Math.max(postX, cx + basketW / 2), y0: frameBottom + 1, y1: frameBottom + 2.8, z0: z0 + 1, z1: z0 + 3 },
      { x0: Math.min(postX, cx - basketW / 2), x1: Math.max(postX, cx + basketW / 2), y0: frameTop - 2.8, y1: frameTop - 1, z0: z0 + 1, z1: z0 + 3 }
    );
    // Front horizontal connector arms extending from the chassis upright directly into the door brackets
    for (const by of bracketHeights) {
      const minX = Math.min(postX, cx - 2.5);
      const maxX = Math.max(postX, cx + 2.5);
      crossbars.push(
        { x0: minX, x1: maxX, y0: by - 1.1, y1: by + 1.1, z0: z1 - 3.2, z1: z1 - 1.2 },
        { x0: cx - 2.2, x1: cx + 2.2, y0: by - 1.0, y1: by + 1.0, z0: z1 - 2.5, z1: d - .5 }
      );
    }
  }

  // 4 Clip-on Slide Brackets (4. Mocowanie do prowadnicy kulkowej / 7. Mocowanie do prowadnicy dolnego montażu)
  // Clipped onto 2–3 pręt (front) and 16–17 pręt (+192 mm rear) on both lower and upper slide levels, locked by M4 × 6 screws.
  const slideBrackets: CargoSlideBracket[] = [];
  const frontBracketZ = z1 - CARGO_MOVIX_SPECS.slideFrontSetback;
  const rearBracketZ = frontBracketZ - CARGO_MOVIX_SPECS.slideBracketSpan;
  const bracketX = mount === 'left' ? cx - basketW / 2 + 0.8 : mount === 'right' ? cx + basketW / 2 - 0.8 : cx;
  for (const [level, sy] of [['bottom', lowerSlideY], ['top', upperSlideY]] as const) {
    for (const [position, wire, sz] of [['front', '2-3', frontBracketZ], ['rear', '16-17', rearBracketZ]] as const) {
      const box: Box3D = {
        x0: bracketX - 1.2,
        x1: bracketX + 1.2,
        y0: sy - 0.6,
        y1: sy + 0.6,
        z0: sz - 1.6,
        z1: sz + 1.6,
      };
      slideBrackets.push({
        level,
        position,
        wire,
        box,
        screwAt: [bracketX, sy + 0.6, sz] as const,
      });
      crossbars.push(box);
    }
  }

  // Runners: Lower slide at *min 50 mm and Upper slide 374 mm above lower slide (Pages 2 & 3)
  const bottomRunner: Box3D = {
    x0: cx - (isTall ? 3.5 : basketW / 2),
    x1: cx + (isTall ? 3.5 : basketW / 2),
    y0: lowerSlideY - 1.5,
    y1: lowerSlideY + 1.5,
    z0: runnerZ0,
    z1,
  };
  const topRunner: Box3D = isTall
    ? {
        x0: cx - 3,
        x1: cx + 3,
        y0: y + hh - 4,
        y1: y + hh - 1.4,
        z0: runnerZ0,
        z1,
      }
    : {
        x0: bottomRunner.x0,
        x1: bottomRunner.x1,
        y0: upperSlideY - 1.5,
        y1: upperSlideY + 1.5,
        z0: runnerZ0,
        z1,
      };

  // Baskets / Tiers + Clip-on Transverse Wire Separators (6. Separatory, Manual Pages 1 & 7)
  const lowestY = y + 4;
  const highestY = isTall ? y + hh - 18 : y + hh - 22;
  const step = tiers > 1 ? (highestY - lowestY) / (tiers - 1) : 0;
  const baskets: CargoBasketTier[] = [];
  const separators: Box3D[] = [];

  for (let k = 0; k < tiers; k++) {
    const ty = lowestY + k * step;
    const railHeight = k === 0 ? 8.5 : 6;
    const sepZ = (z0 + z1) / 2 + (k % 2 === 0 ? -3 : 3);
    const separator: Box3D = {
      x0: cx - (basketW + 0.2) / 2,
      x1: cx + (basketW + 0.2) / 2,
      y0: ty + 0.8,
      y1: ty + railHeight + 0.2,
      z0: sepZ - 0.25,
      z1: sepZ + 0.25,
    };
    separators.push(separator);
    baskets.push({
      index: k,
      y: ty,
      base: {
        x0: cx - basketW / 2,
        x1: cx + basketW / 2,
        y0: ty,
        y1: ty + (basketStyle === 'solid' ? 1.2 : 0.6),
        z0,
        z1,
      },
      rail: {
        x0: cx - (basketW + 0.4) / 2,
        x1: cx + (basketW + 0.4) / 2,
        y0: ty + 0.6,
        y1: ty + railHeight,
        z0: z0 - 0.2,
        z1: z1 + 0.2,
      },
      railHeight,
      separator,
    });
  }

  // Each basket rests on front (2–3 pręt) and rear (16–17 pręt) tier bridges connected to the chassis posts.
  for (const basket of baskets) for (const z of [z0 + 2, z1 - 2]) {
    crossbars.push({ x0: cx - basketW / 2, x1: cx + basketW / 2, y0: basket.base.y0 - .6, y1: basket.base.y0, z0: z - .6, z1: z + .6 });
  }

  // Front Fixing Brackets (2. Mocowania frontu: 103.5 × 36.5 mm, 78 mm screw spacing = ±3.9 cm, "GTV move" cover)
  const screwOffset = CARGO_MOVIX_SPECS.frontBracketScrewSpacing / 2;
  const brackets: CargoBracket[] = bracketHeights.map(by => ({
    y: by,
    at: [cx, by, d] as const,
    screws: [
      [cx - screwOffset, by, d] as const,
      [cx + screwOffset, by, d] as const,
    ],
    width: CARGO_MOVIX_SPECS.frontBracketWidth,
    height: CARGO_MOVIX_SPECS.frontBracketHeight,
    cover: 'GTV move',
  }));

  return {
    isTall,
    tiers,
    basketStyle,
    mount,
    basketW,
    basketD,
    maxLoadKg: CARGO_MOVIX_SPECS.maxLoadKg,
    frame: { uprights, crossbars },
    runners: { bottom: bottomRunner, top: topRunner, length },
    slideBrackets,
    baskets,
    separators,
    brackets,
  };
}
