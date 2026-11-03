export interface Box3D {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

export interface CargoBasketTier {
  readonly index: number;
  readonly y: number;
  readonly base: Box3D;
  readonly rail: Box3D;
  readonly railHeight: number;
}

export interface CargoBracket {
  readonly y: number;
  readonly at: readonly [number, number, number];
  readonly screws: readonly (readonly [number, number, number])[];
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
  readonly frame: {
    readonly uprights: readonly Box3D[];
    readonly crossbars: readonly Box3D[];
  };
  readonly runners: {
    readonly bottom: Box3D;
    readonly top?: Box3D | undefined;
    readonly length: number;
  };
  readonly baskets: readonly CargoBasketTier[];
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

/** Basket width: 100mm for narrow 150mm units (standard No. 15), or sw - 4cm for wider units. */
export function cargoBasketWidth(sw: number): number {
  if (sw <= 16) return 10;
  return Math.max(10, Math.round((sw - 4) * 10) / 10);
}

/** Basket depth: typically 45cm to 50cm, fitting comfortably inside depth d. */
export function cargoBasketDepth(d: number): number {
  return Math.max(20, Math.min(d - 6, 50));
}

/** Runner length matching depth. */
export function cargoRunnerLength(d: number): number {
  if (d >= 55) return 50;
  return Math.max(30, Math.min(45, Math.floor((d - 5) / 5) * 5));
}

/** Front fixing bracket count: 2 for base cargo; 3 or 4 for tall pantry cargo. */
export function cargoBracketCount(hh: number): number {
  if (hh >= 100) return hh >= 180 ? 4 : 3;
  return 2;
}

/** High-precision geometry of a kitchen cargo pull-out system. Centimetres. */
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
  const mount = options.mount ?? (sw <= 16 ? 'left' : 'bottom');
  const basketW = cargoBasketWidth(sw);
  const basketD = cargoBasketDepth(d);
  const length = cargoRunnerLength(d);
  const z1 = d - 3.5;
  const z0 = z1 - basketD;
  const runnerZ0 = z1 - length;

  // Front Fixing Bracket Heights
  const bracketCount = cargoBracketCount(hh);
  const bracketHeights: number[] = [];
  if (isTall) {
    if (bracketCount === 4) {
      bracketHeights.push(y + 8, y + hh * 0.38, y + hh * 0.68, y + hh - 8);
    } else {
      bracketHeights.push(y + 8, y + hh * 0.5, y + hh - 8);
    }
  } else {
    bracketHeights.push(y + 5.5, y + hh - 6.5);
  }

  // Frame construction
  const uprights: Box3D[] = [];
  const crossbars: Box3D[] = [];
  const frameTop = y + hh - 4;
  const frameBottom = y + 2.5;

  if (isTall) {
    // Tall larder pull-out: central rectangular steel ladder frame with longitudinal top/bottom guide rails
    const postW = 2.2;
    for (const side of [-1, 1]) {
      const px = cx + side * 2.8;
      // Front and rear upright posts
      uprights.push(
        { x0: px - postW / 2, x1: px + postW / 2, y0: frameBottom, y1: frameTop, z0: z0 + 1, z1: z0 + 3.2 },
        { x0: px - postW / 2, x1: px + postW / 2, y0: frameBottom, y1: frameTop, z0: z1 - 3.2, z1: z1 - 1 }
      );
    }
    // Longitudinal chassis rails connecting front and rear along depth
    crossbars.push(
      { x0: cx - 4, x1: cx + 4, y0: frameBottom, y1: frameBottom + 2.4, z0: z0 + 1, z1: z1 - 1 },
      { x0: cx - 4, x1: cx + 4, y0: frameTop - 2.4, y1: frameTop, z0: z0 + 1, z1: z1 - 1 }
    );
    // Rear crossbars at tiers
    for (const cy_ of [frameBottom + 2, y + hh * 0.38, y + hh * 0.68, frameTop - 2]) {
      crossbars.push(
        { x0: cx - 4, x1: cx + 4, y0: cy_ - 1, y1: cy_ + 1, z0: z0 + 1, z1: z0 + 3.2 }
      );
    }
    // Front bracket connector lugs extending forward to lock directly into front door brackets
    for (const by of bracketHeights) {
      crossbars.push(
        { x0: cx - 3.5, x1: cx + 3.5, y0: by - 1.1, y1: by + 1.1, z0: z1 - 3.2, z1: z1 + 0.5 }
      );
    }
  } else {
    // Base cargo pull-out: rigid steel chassis spanning full depth with direct bracket coupling arms
    const postX = mount === 'left' ? cx - sw / 2 + 2.5 : mount === 'right' ? cx + sw / 2 - 2.5 : cx;
    uprights.push(
      // Rear upright post
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameBottom, y1: frameTop, z0: z0 + 1, z1: z0 + 3 },
      // Front upright post
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameBottom, y1: frameTop, z0: z1 - 3.2, z1: z1 - 1.2 }
    );
    // Longitudinal top and bottom structural chassis rails spanning full cabinet depth
    crossbars.push(
      { x0: postX - 1.4, x1: postX + 1.4, y0: frameBottom, y1: frameBottom + 2.2, z0: z0 + 1, z1: z1 - 0.8 },
      { x0: postX - 1.2, x1: postX + 1.2, y0: frameTop - 2, y1: frameTop, z0: z0 + 1, z1: z1 - 0.8 },
      // Rear basket support crossbars
      { x0: Math.min(postX, cx - basketW / 2), x1: Math.max(postX, cx + basketW / 2), y0: frameBottom + 1, y1: frameBottom + 2.8, z0: z0 + 1, z1: z0 + 3 },
      { x0: Math.min(postX, cx - basketW / 2), x1: Math.max(postX, cx + basketW / 2), y0: frameTop - 2.8, y1: frameTop - 1, z0: z0 + 1, z1: z0 + 3 }
    );
    // Front horizontal connector arms extending from the chassis upright directly into the door brackets!
    for (const by of bracketHeights) {
      const minX = Math.min(postX, cx - 2.5);
      const maxX = Math.max(postX, cx + 2.5);
      crossbars.push(
        // Lateral bridge from postX to door bracket center cx
        { x0: minX, x1: maxX, y0: by - 1.1, y1: by + 1.1, z0: z1 - 3.2, z1: z1 - 1.2 },
        // Front tongue sliding directly into the door bracket receiver block
        { x0: cx - 2.2, x1: cx + 2.2, y0: by - 1.0, y1: by + 1.0, z0: z1 - 2.5, z1: z1 + 0.5 }
      );
    }
  }

  // Runners
  const bottomRunner: Box3D = {
    x0: cx - (isTall ? 3.5 : basketW / 2),
    x1: cx + (isTall ? 3.5 : basketW / 2),
    y0: y + 1.2,
    y1: y + 4.2,
    z0: runnerZ0,
    z1,
  };
  const topRunner: Box3D | undefined = isTall
    ? {
        x0: cx - 3,
        x1: cx + 3,
        y0: y + hh - 4,
        y1: y + hh - 1.4,
        z0: runnerZ0,
        z1,
      }
    : undefined;

  // Baskets / Tiers
  const lowestY = y + 4;
  const highestY = isTall ? y + hh - 18 : y + hh - 22;
  const step = tiers > 1 ? (highestY - lowestY) / (tiers - 1) : 0;
  const baskets: CargoBasketTier[] = [];

  for (let k = 0; k < tiers; k++) {
    const ty = lowestY + k * step;
    const railHeight = k === 0 ? 8.5 : 6;
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
    });
  }

  // Front Fixing Brackets
  const screwOffset = 2.0;
  const brackets: CargoBracket[] = bracketHeights.map(by => ({
    y: by,
    at: [cx, by, d] as const,
    screws: [
      [cx - screwOffset, by, d] as const,
      [cx + screwOffset, by, d] as const,
    ],
  }));

  return {
    isTall,
    tiers,
    basketStyle,
    mount,
    basketW,
    basketD,
    frame: { uprights, crossbars },
    runners: { bottom: bottomRunner, top: topRunner, length },
    baskets,
    brackets,
  };
}
