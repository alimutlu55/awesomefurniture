import type { HardwareEntry } from './hardware-types';

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
    costEur: 95, ratedLoadKg: 12, // lifts are sold by the load they lift; 12 kg is common for the standard size
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
    tools: ['pozidriv'],
    cue: 'Screw onto both sides',
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
    tools: ['pozidriv'],
    cue: 'Screw the runners on, slide the rack in',
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
    tools: ['pozidriv'],
    cue: 'Screw the runners on, slide the basket in',
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
