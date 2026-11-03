import type { HardwareEntry } from './hardware-types';

const CUP = { d: 35, depth: 13, fromEdge: 22.5 } as const;

/**
 * Concealed cabinet hinges (standard 110°, wide 155°, widest 170°, zero-protrusion 155°,
 * thick-door 95°, glass/mirror clamp 95°, blind-corner 95°). All dimensions in millimetres (mm).
 */
export const HINGE_ENTRY: HardwareEntry = {
  key: 'hinge',
  category: 'hinge',
  name: 'Concealed hinge, 110°',
  unit: 'pc',
  mountsOn: ['door', 'front', 'side', 'partition'],
  sizesMm: [35],
  defaultVariant: 'standard',
  variants: [
    {
      key: 'standard',
      name: 'Concealed hinge, 110°',
      sizeLabel: '110°',
      angleDeg: 110,
      cup: CUP,
      use: 'Most doors',
      loadKg: 4,
    },
    {
      key: 'wide',
      name: 'Concealed hinge, 155°',
      sizeLabel: '155°',
      angleDeg: 155,
      cup: CUP,
      use: 'Door against a wall or a neighbour',
      loadKg: 4,
    },
    {
      key: 'widest',
      name: 'Concealed hinge, 170°',
      sizeLabel: '170°',
      angleDeg: 170,
      cup: CUP,
      use: 'Door that must fold right back',
      loadKg: 4,
    },
    {
      key: 'zero',
      name: 'Zero-protrusion hinge, 155°',
      sizeLabel: '155° zero protrusion',
      angleDeg: 155,
      cup: CUP,
      use: 'Pull-outs behind the door',
      loadKg: 4,
    },
    {
      key: 'thick',
      name: 'Thick-door hinge, 95°',
      sizeLabel: '95° thick door',
      angleDeg: 95,
      cup: { d: 35, depth: 15, fromEdge: 22.5 },
      use: 'Doors thicker than 25 mm',
      loadKg: 5,
    },
    {
      key: 'glass',
      name: 'Glass/mirror door hinge',
      sizeLabel: 'glass',
      angleDeg: 95,
      cup: null,
      use: 'Glass and mirror doors, clamped',
      loadKg: 3,
    },
    {
      key: 'corner',
      name: 'Blind-corner hinge, 95°',
      sizeLabel: '95° blind corner',
      angleDeg: 95,
      cup: CUP,
      use: 'A door beside a blind corner',
      loadKg: 4,
    },
  ],
  rules: {
    clearanceMm: {
      frontSetback: 37,
      standoff: 12,
      reveal: 3,
      side: 100,
    },
    boardThicknessMm: { min: 16, max: 28, standard: [16, 18, 19, 22] },
    maxLeafMm: { width: 600, height: 2400 },
    quantityByHeightMm: [
      [900, 2],
      [1600, 3],
      [2000, 4],
      [Infinity, 5],
    ],
    edgeInsetMm: 100,
    systemLineMm: 37,
    pitchMm: 32,
    exclusions: [
      {
        material: 'glass',
        forbidsHoles: true,
        fallbackVariant: 'glass',
        reason: 'Tempered glass cannot be bored for a 35 mm cup; use the glass-door clamp hinge.',
      },
    ],
    costEur: 15,
  },
  drilling: [
    {
      reference: 'front-edge',
      lineMm: 22.5,
      face: 'back',
      kind: 'cup',
      dMm: 35,
      depthMm: 13,
    },
  ],
  fixings: [
    {
      target: 'door',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '35 mm cup',
      qtyPerUnit: 1,
      pilotHole: { kind: 'cup', dMm: 35, depthMm: 13 },
    },
  ],
  motion: {
    kind: 'swing',
    axis: 'y',
    maxAngleDeg: 110,
    standoffMm: 12,
  },
  assembly: {
    stage: 'doors',
    requires: ['inside', 'drawer-test'],
    phase: 'lying-before-place',
    adjustAxes: ['side', 'height', 'depth'],
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Press the hinge cups and hang the doors',
      summary: 'Press each 35 mm hinge cup square into the door back, clip the arms onto the mounting plates, and adjust 3-way.',
      drill: 'Bore Ø35 × 13 mm hinge cups centred 22.5 mm in from the hinge edge (none in glass).',
      place: 'Hold the door leaf in front of the cabinet and align each hinge arm with its mounting plate.',
      fix: 'Clip the hinges home and turn the side, height, and depth adjustment screws until all reveals are even.',
    },
  },
  display: {
    model3d: {
      family: 'hinge-cup',
      primitives: [
        { shape: 'cylinder', sizeMm: [35, 12, 35], offsetMm: [0, 6, 0], axis: 'y', lod: 'all' },
        { shape: 'box', sizeMm: [14, 40, 9], offsetMm: [0, -20, 0], axis: 'y', lod: 'all' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'hinge-pivot',
      strokeDash: [6, 3],
      label: 'Hinge',
    },
    listLine: {
      label: 'Concealed hinge, 110°',
      unit: 'pc',
      defaultSpec: '35 mm cup',
    },
  },
  source: 'common practice; check the maker\'s template',
};

/**
 * System 32 cruciform mounting plate for concealed hinges.
 */
export const PLATE_ENTRY: HardwareEntry = {
  key: 'plate',
  category: 'hinge',
  name: 'Mounting plate',
  unit: 'pc',
  mountsOn: ['side', 'partition'],
  sizesMm: [32],
  rules: {
    clearanceMm: { frontSetback: 37 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    systemLineMm: 37,
    pitchMm: 32,
  },
  drilling: [
    {
      reference: 'system32',
      lineMm: 37,
      pitchMm: 32,
      face: 'inside',
      kind: 'plate',
      dMm: 5,
      depthMm: 12,
      stationsMm: [-16, 16],
    },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '5 × 12',
      qtyPerUnit: 2,
      pilotHole: { kind: 'plate', dMm: 5, depthMm: 12 },
    },
  ],
  assembly: {
    stage: 'doors',
    requires: ['carcass', 'partitions'],
    phase: 'before-place',
    approachFrom: [1, 0, 0],
    instructions: {
      title: 'Fix the hinge mounting plates',
      summary: 'Screw the mounting plates to the side panels and partitions on the 37 mm System 32 line before hanging the doors.',
      drill: 'Drill paired Ø5 × 12 mm System 32 holes 32 mm apart, 37 mm back from the front edge.',
      place: 'Set each mounting plate over its two System 32 holes.',
      fix: 'Drive the two Ø5 × 12 mm Euro screws into each plate.',
    },
  },
  display: {
    model3d: {
      family: 'mounting-plate',
      primitives: [{ shape: 'box', sizeMm: [42, 6, 42], offsetMm: [0, -3, 0], axis: 'y', lod: 'all' }],
      approachVector: [1, 0, 0],
    },
    drawingMark: {
      symbol: 'hinge-pivot',
      label: 'Mounting plate',
    },
    listLine: {
      label: 'Mounting plate',
      unit: 'pc',
      defaultSpec: 'System 32 (37 mm line)',
    },
  },
  source: HINGE_ENTRY.source,
};
