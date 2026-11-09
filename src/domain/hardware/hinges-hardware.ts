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
    costEur: 4.5,
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
    // The cup is pressed into its 35 mm hole and held by a screw through each ear of its flange.
    {
      target: 'door',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '3.5 × 16',
      qtyPerUnit: 2,
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
    costEur: 0.8,
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
      // A Euro screw: its 6.3 mm thread cuts into the 5 mm System 32 hole, and it stops short of the hole's 12 mm.
      size: 'Euro 6.3 × 11.5',
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

/**
 * Twin/triple-track top-running and bottom-rolling sliding wardrobe door gear with soft-close dampers.
 */
export const SLIDING_TRACK_ENTRY: HardwareEntry = {
  key: 'slidingTrack',
  category: 'track',
  name: 'Sliding door track set',
  unit: 'set',
  mountsOn: ['top', 'base', 'door'],
  sizesMm: [1200, 1500, 1800, 2000, 2400, 3000],
  defaultVariant: 'double-track',
  variants: [
    { key: 'double-track', name: '2-track sliding door gear + soft-close', sizeLabel: '2-track (up to 50 kg/leaf)', loadKg: 50, sizesMm: [1200, 1500, 1800, 2000, 2400, 3000] },
    { key: 'triple-track', name: '3-track sliding door gear + soft-close', sizeLabel: '3-track (3-leaf wardrobe)', loadKg: 50, sizesMm: [1800, 2400, 3000] },
  ],
  rules: {
    clearanceMm: { frontSetback: 82, topDrop: 44, bottomGap: 18, reveal: 3, standoff: 41 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 19] },
    minCarcassDepthMm: 550,
    maxLeafMm: { width: 1200, height: 2600 },
    maxSpanMm: 3000,
    edgeInsetMm: 50,
    maxSpacingMm: 400,
    costEur: 95,
  },
  drilling: [
    { reference: 'front-edge', lineMm: 41, pitchMm: 350, face: 'inside', kind: 'pilot', dMm: 2.5, depthMm: 12 },
  ],
  fixings: [
    { target: 'top', fromFace: 'inside', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 6, pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 12 } },
    { target: 'base', fromFace: 'inside', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 6, pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 12 } },
    { target: 'door', fromFace: 'back', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 8, pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 12 } },
  ],
  motion: {
    kind: 'slide',
    axis: 'x',
    travelRatio: 0.5,
  },
  assembly: {
    stage: 'doors',
    requires: ['top', 'carcass', 'inside', 'drawer-test'],
    phase: 'before-place',
    adjustAxes: ['height', 'side'],
    approachFrom: [0, -1, 0],
    instructions: {
      title: 'Fix the sliding-door tracks and hang the leaves',
      summary: 'Screw the twin upper running track under the top and the lower guide channel onto the base, hook the door rollers in, and level the leaves.',
      drill: 'Pre-drill Ø2.5 × 12 mm pilot holes along the 41 mm track centreline under the top and on the base.',
      place: 'Tilt each door leaf into the upper running track and drop its bottom guide rollers into the lower channel.',
      fix: 'Turn the lower roller height screws until each leaf runs plumb against the side stile and latches into the soft-close damper.',
    },
  },
  display: {
    model3d: {
      family: 'sliding-track',
      primitives: [
        { shape: 'channel', sizeMm: [1800, 44, 82], offsetMm: [0, -22, 0], axis: 'x', lod: 'all' },
        { shape: 'channel', sizeMm: [1800, 12, 62], offsetMm: [0, 6, 0], axis: 'x', lod: 'all' },
      ],
      approachVector: [0, -1, 0],
    },
    drawingMark: { symbol: 'track-line', strokeDash: [8, 3], label: 'Sliding track' },
    listLine: { label: 'Sliding door track set', unit: 'set', defaultSpec: '2-track aluminium profile + rollers, soft-close' },
  },
  source: 'Twin-track wardrobe sliding door gear (82 mm 2-track depth, 44 mm head track height, 1200–3000 mm cut-to-length aluminium profiles, max 1200 × 2600 mm leaf up to 50 kg) — EN 1527 / generic millwork practice.',
};
