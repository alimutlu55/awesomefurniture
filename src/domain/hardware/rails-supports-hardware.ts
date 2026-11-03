import type { HardwareEntry } from './hardware-types';

/**
 * Oval wardrobe hanging rail (30 × 15 mm / Ø24 mm equivalent, cut 4 mm shorter than clear bay width).
 * All dimensions in millimetres (mm).
 */
export const RAIL_ENTRY: HardwareEntry = {
  key: 'rail',
  category: 'rail',
  name: 'Hanging rail, oval',
  unit: 'pc',
  mountsOn: ['side', 'partition'],
  sizesMm: [400, 500, 600, 800, 1000, 1200],
  rules: {
    clearanceMm: {
      topDrop: 60,
      endCutShort: 4,
      side: 12,
    },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 530,
    maxSpanMm: { 18: 1200, 25: 900 },
    costEur: 18,
  },
  drilling: [],
  fixings: [],
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Drop the hanging rails into their end supports',
      summary: 'Cut the oval hanging rail 4 mm shorter than the bay width and drop it into the two end flanges.',
      place: 'Lower each rail into its left and right end supports.',
    },
  },
  display: {
    model3d: {
      family: 'rail-tube',
      primitives: [{ shape: 'cylinder', sizeMm: [25, 600, 25], offsetMm: [0, 0, 0], axis: 'x', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'rail-bar',
      label: 'Hanging rail',
    },
    listLine: {
      label: 'Hanging rail, oval',
      unit: 'pc',
      defaultSpec: 'cut 4 mm under clear bay width',
    },
  },
  source: 'Oval hanging rail 60 mm below top board, 530 mm minimum clear hanging depth, 1200 mm max span (900 mm for heavy coats) — common practice; check the maker\'s template.',
};

/**
 * Rail end support flange/socket mounted to the carcass side or partition.
 */
export const RAIL_SUPPORT_ENTRY: HardwareEntry = {
  key: 'support',
  category: 'support',
  name: 'Rail end support',
  unit: 'pc',
  mountsOn: ['side', 'partition'],
  sizesMm: [40],
  rules: {
    clearanceMm: { topDrop: 60 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    costEur: 4,
  },
  drilling: [],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '3.5 × 16',
      qtyPerUnit: 2,
    },
  ],
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Fit the rail end supports',
      summary: 'Fix an end support flange on each side of the bay 60 mm below the top board.',
      fix: 'Fasten each end support level with the opposite side of the bay.',
    },
  },
  display: {
    model3d: {
      family: 'rail-support',
      primitives: [{ shape: 'disc', sizeMm: [40, 4, 40], offsetMm: [0, 0, 0], axis: 'x', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'rail-bar',
      label: 'Rail support',
    },
    listLine: {
      label: 'Rail end support',
      unit: 'pc',
      defaultSpec: 'for oval rail',
    },
  },
  source: RAIL_ENTRY.source,
};

/**
 * System 32 plug-in shelf support pin (Ø5 × 16 mm steel pin in 5 × 10 mm blind holes on the 37 mm line).
 */
export const SHELF_PIN_ENTRY: HardwareEntry = {
  key: 'pin',
  category: 'support',
  name: 'Shelf support',
  unit: 'pc',
  mountsOn: ['side', 'partition', 'shelf'],
  sizesMm: [5],
  rules: {
    clearanceMm: { frontSetback: 37 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    maxSpanMm: { 18: 800, 25: 1000 },
    systemLineMm: 37,
    pitchMm: 32,
    costEur: 1,
  },
  drilling: [
    {
      reference: 'system32',
      lineMm: 37,
      pitchMm: 32,
      face: 'inside',
      kind: 'pin',
      dMm: 5,
      depthMm: 10,
      stationsMm: [-64, -32, 0, 32, 64],
    },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'pin',
      size: 'Ø5 × 16',
      qtyPerUnit: 1,
      pilotHole: { kind: 'pin', dMm: 5, depthMm: 10 },
    },
  ],
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'before-place',
    fittedFirst: true,
    approachFrom: [1, 0, 0],
    instructions: {
      title: 'Push in the shelf support pins',
      summary: 'Push four Ø5 mm shelf support pins into matching System 32 holes before lowering each adjustable shelf.',
      drill: 'Drill 5-hole vertical adjustment rows (Ø5 × 10 mm at 32 mm pitch) on the front and rear 37 mm System 32 lines.',
      place: 'Push four shelf pins home at the chosen height for each adjustable shelf.',
    },
  },
  display: {
    model3d: {
      family: 'shelf-pin',
      primitives: [{ shape: 'cylinder', sizeMm: [5, 16, 5], offsetMm: [0, -2.5, 0], axis: 'y', lod: 'all' }],
      approachVector: [1, 0, 0],
    },
    drawingMark: {
      symbol: 'pin-tick',
      label: 'Shelf pin',
    },
    listLine: {
      label: 'Shelf support',
      unit: 'pc',
      defaultSpec: 'Ø5 mm plug-in pin',
    },
  },
  source: 'System 32 Ø5 × 10 mm shelf pin rows on 37 mm setback lines; max shelf span 800 mm for 18 mm board, 1000 mm for 25 mm board — common practice; check the maker\'s template.',
};

/**
 * Counterbalanced pull-down wardrobe lift rail mechanism.
 */
export const PULL_DOWN_RAIL_ENTRY: HardwareEntry = {
  key: 'pullDownRail',
  category: 'lift',
  name: 'Pull-down rail mechanism',
  unit: 'set',
  mountsOn: ['side', 'partition'],
  sizesMm: [600, 800, 1000],
  rules: {
    clearanceMm: { topDrop: 60, side: 40 },
    boardThicknessMm: { min: 18, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 530,
    maxSpanMm: 1000,
    costEur: 95,
  },
  drilling: [
    {
      reference: 'system32',
      lineMm: 37,
      pitchMm: 32,
      face: 'inside',
      kind: 'screw',
      dMm: 5,
      depthMm: 12,
    },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '5 × 16 Euro screw',
      qtyPerUnit: 8,
    },
  ],
  motion: {
    kind: 'lift',
    axis: 'x',
    maxAngleDeg: 85,
  },
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount the pull-down wardrobe lift',
      summary: 'Screw the left and right damped pivot housings to the uprights and adjust the telescopic crossbar.',
    },
  },
  display: {
    model3d: {
      family: 'lift-stay',
      primitives: [
        { shape: 'box', sizeMm: [18, 450, 20], offsetMm: [0, -200, 10], axis: 'y', lod: 'all' },
        { shape: 'cylinder', sizeMm: [12, 650, 12], offsetMm: [0, -325, 230], axis: 'y', lod: 'all' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'lift-arc',
      strokeDash: [5, 3],
      label: 'Pull-down lift',
    },
    listLine: {
      label: 'Pull-down rail mechanism',
      unit: 'set',
      defaultSpec: 'telescopic, damped return',
    },
  },
  source: 'Counterbalanced wardrobe lift on System 32 side housings — common practice; check the maker\'s template.',
};

/**
 * Pull-out trouser rack on side-mounted full-extension slides.
 */
export const TROUSER_RACK_ENTRY: HardwareEntry = {
  key: 'trouserRack',
  category: 'runner',
  name: 'Trouser pull-out rack',
  unit: 'set',
  mountsOn: ['side', 'partition'],
  sizesMm: [450, 500],
  rules: {
    clearanceMm: { side: 25, frontSetback: 37, topDrop: 70 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 480,
    costEur: 65,
  },
  drilling: [
    {
      reference: 'system32',
      lineMm: 37,
      pitchMm: 32,
      face: 'inside',
      kind: 'runner',
      dMm: 5,
      depthMm: 12,
    },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 16',
      qtyPerUnit: 4,
    },
  ],
  motion: {
    kind: 'slide',
    axis: 'z',
    travelRatio: 0.7,
  },
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount the trouser pull-out rack',
      summary: 'Fix the side slides on the 37 mm System 32 line and clip the trouser frame onto the runners.',
    },
  },
  display: {
    model3d: {
      family: 'runner-telescope',
      primitives: [{ shape: 'box', sizeMm: [500, 15, 450], offsetMm: [0, 0, -10], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'runner-dashed',
      strokeDash: [4, 3],
      label: 'Trouser rack',
    },
    listLine: {
      label: 'Trouser pull-out rack',
      unit: 'set',
      defaultSpec: 'on full-extension runners',
    },
  },
  source: 'Pull-out trouser frame on System 32 side runners — common practice; check the maker\'s template.',
};

/**
 * Pull-out wire basket on side-mounted runners.
 */
export const WIRE_BASKET_ENTRY: HardwareEntry = {
  key: 'basket',
  category: 'runner',
  name: 'Pull-out wire basket on runners',
  unit: 'set',
  mountsOn: ['side', 'partition'],
  sizesMm: [400, 450, 500],
  rules: {
    clearanceMm: { side: 30, frontSetback: 37 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 450,
    costEur: 45,
  },
  drilling: [
    {
      reference: 'system32',
      lineMm: 37,
      pitchMm: 32,
      face: 'inside',
      kind: 'runner',
      dMm: 5,
      depthMm: 12,
    },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 16',
      qtyPerUnit: 4,
    },
  ],
  motion: {
    kind: 'slide',
    axis: 'z',
    travelRatio: 0.7,
  },
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount the pull-out wire basket',
      summary: 'Screw the basket roller slides to the uprights on the 37 mm line and drop the wire basket into its guides.',
    },
  },
  display: {
    model3d: {
      family: 'runner-telescope',
      primitives: [{ shape: 'box', sizeMm: [500, 180, 450], offsetMm: [0, 0, 0], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'runner-dashed',
      strokeDash: [4, 3],
      label: 'Wire basket',
    },
    listLine: {
      label: 'Pull-out wire basket on runners',
      unit: 'set',
      defaultSpec: 'with side runners',
    },
  },
  source: 'Pull-out wire basket on System 32 side runners — common practice; check the maker\'s template.',
};
