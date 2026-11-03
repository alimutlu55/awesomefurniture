import type { HardwareEntry } from './hardware-types';

/**
 * One-piece Ø7 × 50 mm cabinet connector screw (confirmat).
 * Screwed through a Ø7 mm face clearance bore into a Ø5 × 45 mm end pilot hole.
 * All dimensions in millimetres (mm).
 */
export const CONFIRMAT_ENTRY: HardwareEntry = {
  key: 'confirmat',
  category: 'connector',
  name: 'Connector screw',
  unit: 'pc',
  mountsOn: ['side', 'partition', 'top', 'base', 'shelf'],
  sizesMm: [50],
  defaultVariant: '7x50',
  variants: [{ key: '7x50', name: '7 × 50 mm one-piece connector screw', sizeLabel: '7 × 50', sizesMm: [50] }],
  rules: {
    clearanceMm: { endCutShort: 120 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    edgeInsetMm: 50,
    maxSpacingMm: 300,
    pitchMm: 32,
  },
  drilling: [
    { reference: 'joint-line', lineMm: 0, face: 'outside', kind: 'connector', dMm: 7, depthMm: 0, through: true },
    { reference: 'joint-line', lineMm: 0, face: 'edge', kind: 'pilot', dMm: 5, depthMm: 45 },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'outside',
      fastenerKind: 'confirmat',
      size: '7 × 50',
      qtyPerUnit: 1,
      pilotHole: { kind: 'pilot', dMm: 5, depthMm: 45 },
    },
  ],
  assembly: {
    stage: 'carcass',
    requires: ['plinth'],
    phase: 'after-place',
    approachFrom: [-1, 0, 0],
    instructions: {
      title: 'Drive the connector screws',
      summary: 'Drive Ø7 × 50 mm connector screws through the 7 mm face clearance holes into the 5 × 45 mm end pilot holes.',
      drill: 'Bore Ø7 mm through the face panel and Ø5 × 45 mm into the mating board end, 50 mm from each corner and at most 300 mm apart.',
      fix: 'Turn each 7 × 50 mm connector screw home until the countersunk head sits flush.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [
        { shape: 'cylinder', sizeMm: [6.4, 50, 6.4], offsetMm: [0, 25, 0], axis: 'y', lod: 'make' },
        { shape: 'disc', sizeMm: [14.08, 1.6, 14.08], offsetMm: [0, -0.8, 0], axis: 'y', lod: 'make' },
      ],
      approachVector: [0, 1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Confirmat' },
    listLine: { label: 'Connector screw', unit: 'pc', defaultSpec: '7 × 50' },
  },
  source: 'One-piece cabinet connector screw Ø7 × 50 mm (Ø7 mm face through-bore, Ø5 × 45 mm end pilot bore, 50 mm edge inset, max 300 mm spacing) — generic European panel-joinery practice.',
};

/**
 * Eccentric cam lock housing (Ø15 × 12.5 mm at 34 mm from the joint plane).
 */
export const CAM_ENTRY: HardwareEntry = {
  key: 'cam',
  category: 'connector',
  name: 'Cam connector',
  unit: 'pc',
  mountsOn: ['base', 'top', 'shelf', 'partition'],
  sizesMm: [15],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    systemLineMm: 34,
    edgeInsetMm: 50,
    maxSpacingMm: 300,
    pitchMm: 32,
  },
  drilling: [
    { reference: 'joint-line', lineMm: 34, face: 'inside', kind: 'cam', dMm: 15, depthMm: 12.5 },
    { reference: 'joint-line', lineMm: 0, face: 'edge', kind: 'pilot', dMm: 8, depthMm: 34 },
  ],
  fixings: [
    {
      target: 'shelf',
      fromFace: 'inside',
      fastenerKind: 'cam',
      size: '15 mm',
      qtyPerUnit: 1,
      pilotHole: { kind: 'cam', dMm: 15, depthMm: 12.5 },
    },
  ],
  assembly: {
    stage: 'carcass',
    requires: ['plinth'],
    phase: 'after-place',
    approachFrom: [0, -1, 0],
    instructions: {
      title: 'Insert and lock the cam connectors',
      summary: 'Press each Ø15 mm cam housing into its pocket with the arrow toward the joint and turn half a turn to grip the cam bolt.',
      drill: 'Bore Ø15 × 12.5 mm cam pockets 34 mm in from the joint edge and Ø8 × 34 mm edge holes to meet them.',
      fix: 'Push each cam housing home and turn clockwise 180° to lock onto the cam bolt head.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [
        { shape: 'cylinder', sizeMm: [14.4, 12, 14.4], offsetMm: [0, 6.2, 0], axis: 'y', lod: 'make' },
        { shape: 'box', sizeMm: [11, 0.8, 2], offsetMm: [0, -0.1, 0], axis: 'y', lod: 'make' },
        { shape: 'cylinder', sizeMm: [4.4, 0.8, 4.4], offsetMm: [5, -0.1, 0], axis: 'y', lod: 'make' },
      ],
      approachVector: [0, 1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Cam' },
    listLine: { label: 'Cam connector', unit: 'pc', defaultSpec: '15 mm' },
  },
  source: 'Eccentric cam lock housing Ø15 × 12.5 mm for 18 mm board, 34 mm drilling distance from joint edge (Ø8 × 34 mm edge bore) — generic System 32 Knock-Down (KD) fitting practice.',
};

/**
 * Cam dowel bolt (34 mm drilling distance, Ø5 × 11 mm Euro thread into the face board).
 */
export const BOLT_ENTRY: HardwareEntry = {
  key: 'bolt',
  category: 'connector',
  name: 'Cam bolt',
  unit: 'pc',
  mountsOn: ['side', 'partition', 'top', 'base'],
  sizesMm: [34],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    systemLineMm: 34,
  },
  drilling: [
    { reference: 'joint-line', lineMm: 0, face: 'inside', kind: 'bolt', dMm: 5, depthMm: 11 },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'bolt',
      size: '34',
      qtyPerUnit: 1,
      pilotHole: { kind: 'bolt', dMm: 5, depthMm: 11 },
    },
  ],
  assembly: {
    stage: 'carcass',
    requires: ['plinth'],
    phase: 'lying-before-place',
    approachFrom: [1, 0, 0],
    instructions: {
      title: 'Screw in the cam bolts',
      summary: 'Screw the 34 mm cam dowel bolts into their Ø5 × 11 mm face holes up to the shoulder before bringing the boards together.',
      drill: 'Drill Ø5 × 11 mm blind holes on the joint line of the face board.',
      fix: 'Turn each cam bolt down to its shoulder so the neck stands 34 mm proud.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [
        { shape: 'cylinder', sizeMm: [5, 11, 5], offsetMm: [0, 5.5, 0], axis: 'y', lod: 'make' },
        { shape: 'cylinder', sizeMm: [3.6, 32, 3.6], offsetMm: [0, -16, 0], axis: 'y', lod: 'make' },
        { shape: 'cylinder', sizeMm: [7.2, 3, 7.2], offsetMm: [0, -33, 0], axis: 'y', lod: 'make' },
        { shape: 'box', sizeMm: [5, 0.6, 1], offsetMm: [0, 0.2, 0], axis: 'y', lod: 'make' },
      ],
      approachVector: [0, 1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Cam bolt' },
    listLine: { label: 'Cam bolt', unit: 'pc', defaultSpec: '34' },
  },
  source: CAM_ENTRY.source,
};

/**
 * Fluted hardwood dowel pin (Ø8 × 35 mm standard, Ø6 × 30 mm short for shallow sloped-roof joints).
 */
export const DOWEL_ENTRY: HardwareEntry = {
  key: 'dowel',
  category: 'connector',
  name: 'Dowel',
  unit: 'pc',
  mountsOn: ['side', 'partition', 'top', 'base', 'shelf'],
  sizesMm: [35, 30],
  defaultVariant: 'standard',
  variants: [
    { key: 'standard', name: '8 × 35 mm fluted beech dowel', sizeLabel: '8 × 35', sizesMm: [35] },
    { key: 'short', name: '6 × 30 mm short blind dowel (sloped roof joint)', sizeLabel: '6 × 30', sizesMm: [30] },
  ],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    edgeInsetMm: 50,
    maxSpacingMm: 300,
    pitchMm: 32,
  },
  drilling: [
    { reference: 'joint-line', lineMm: 0, face: 'inside', kind: 'dowel', dMm: 8, depthMm: 12 },
    { reference: 'joint-line', lineMm: 0, face: 'edge', kind: 'dowel', dMm: 8, depthMm: 25 },
    { reference: 'joint-line', lineMm: 0, face: 'inside', kind: 'dowel', dMm: 6, depthMm: 10 },
    { reference: 'joint-line', lineMm: 0, face: 'edge', kind: 'dowel', dMm: 6, depthMm: 22 },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'dowel',
      size: '8 × 35',
      qtyPerUnit: 1,
      pilotHole: { kind: 'dowel', dMm: 8, depthMm: 12 },
    },
    {
      target: 'shelf',
      fromFace: 'edge',
      fastenerKind: 'dowel',
      size: '8 × 35',
      qtyPerUnit: 1,
      pilotHole: { kind: 'dowel', dMm: 8, depthMm: 25 },
    },
  ],
  assembly: {
    stage: 'carcass',
    requires: ['plinth'],
    phase: 'lying-before-place',
    approachFrom: [1, 0, 0],
    instructions: {
      title: 'Tap in the wooden dowels',
      summary: 'Glue and tap the fluted beech dowels into the 25 mm edge bores before pressing the mating face panel home.',
      drill: 'Bore Ø8 × 12 mm holes in the face panel and matching Ø8 × 25 mm holes in the board edge.',
      fix: 'Tap each dowel 25 mm into the board end so 10 mm projects to engage the face hole.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [{ shape: 'cylinder', sizeMm: [8, 35, 8], offsetMm: [0, 0, 0], axis: 'y', lod: 'make' }],
      approachVector: [0, 1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Dowel' },
    listLine: { label: 'Dowel', unit: 'pc', defaultSpec: '8 × 35' },
  },
  source: 'Fluted hardwood dowel pins Ø8 × 35 mm (12 mm face bore + 25 mm edge bore) and Ø6 × 30 mm for shallow sloped-top joints (10 mm + 22 mm) — DIN 68150 / generic joinery practice.',
};

/**
 * Wood/chipboard and machine screws (4 × 40 plinth/box, 4 × 30 drawer front, 4 × 14 bracket, 4 × 12 runner, M4 × 6 cargo lock).
 */
export const SCREW_ENTRY: HardwareEntry = {
  key: 'screw',
  category: 'fixing',
  name: 'Screw',
  unit: 'pc',
  mountsOn: ['plinth', 'drawer-box', 'front', 'side', 'partition'],
  sizesMm: [40, 30, 14, 12, 6],
  defaultVariant: '4x40',
  variants: [
    { key: '4x40', name: '4 × 40 mm countersunk wood screw', sizeLabel: '4 × 40', sizesMm: [40] },
    { key: '4x30', name: '4 × 30 mm drawer front fixing screw', sizeLabel: '4 × 30', sizesMm: [30] },
    { key: '4x14', name: '4 × 14 mm pan-head bracket screw', sizeLabel: '4 × 14', sizesMm: [14] },
    { key: '4x12', name: '4 × 12 mm runner fixing screw', sizeLabel: '4 × 12', sizesMm: [12] },
    { key: 'M4x6', name: 'M4 × 6 mm machine locking screw', sizeLabel: 'M4 × 6', sizesMm: [6] },
  ],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 12, max: 25, standard: [16, 18, 25] },
    edgeInsetMm: 50,
    maxSpacingMm: 300,
  },
  drilling: [
    { reference: 'joint-line', lineMm: 0, face: 'outside', kind: 'screw', dMm: 4, depthMm: 0, through: true },
    { reference: 'joint-line', lineMm: 0, face: 'edge', kind: 'pilot', dMm: 2.5, depthMm: 30 },
  ],
  fixings: [
    {
      target: 'plinth',
      fromFace: 'outside',
      fastenerKind: 'screw',
      size: '4 × 40',
      qtyPerUnit: 1,
      pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 30 },
    },
  ],
  assembly: {
    stage: 'plinth',
    requires: [],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Drive the fixing screws',
      summary: 'Drive wood screws through the clearance holes into the pilot holes.',
      drill: 'Drill Ø4 mm clearance holes through the outer board and Ø2.5 mm pilot holes into the mating board.',
      fix: 'Drive each screw home until snug.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [
        { shape: 'cylinder', sizeMm: [4, 40, 4], offsetMm: [0, 20, 0], axis: 'y', lod: 'make' },
        { shape: 'disc', sizeMm: [8.8, 1.6, 8.8], offsetMm: [0, -0.8, 0], axis: 'y', lod: 'make' },
      ],
      approachVector: [0, 1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Screw' },
    listLine: { label: 'Screw', unit: 'pc', defaultSpec: '4 × 40' },
  },
  source: 'Countersunk and pan-head chipboard screws Ø4 × 12–40 mm (Ø4 mm clearance bore, Ø2.5 mm pilot bore) and M4 × 6 mm machine screws — generic cabinetmaking practice.',
};

/**
 * Back panel pin nail (1.6 × 20 mm driven at 150 mm centres around the rear rebate or drawer bottom).
 */
export const NAIL_ENTRY: HardwareEntry = {
  key: 'nail',
  category: 'fixing',
  name: 'Nail',
  unit: 'pc',
  mountsOn: ['back', 'drawer-box'],
  sizesMm: [20],
  defaultVariant: '1.6x20',
  variants: [{ key: '1.6x20', name: '1.6 × 20 mm back panel pin nail', sizeLabel: '1.6 × 20', sizesMm: [20] }],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 3, max: 8, standard: [3, 6] },
    maxSpacingMm: 150,
  },
  drilling: [],
  fixings: [
    { target: 'back', fromFace: 'back', fastenerKind: 'nail', size: '1.6 × 20', qtyPerUnit: 1 },
  ],
  assembly: {
    stage: 'back',
    requires: ['top'],
    phase: 'after-place',
    approachFrom: [0, 0, -1],
    instructions: {
      title: 'Pin the back panel into the rebate',
      summary: 'After squaring the carcass diagonals, drive 1.6 × 20 mm panel pins every 150 mm around the rear rebate.',
      fix: 'Drive 1.6 × 20 mm nails flush around the back edges and along intermediate shelves and partitions.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [{ shape: 'cylinder', sizeMm: [1.6, 20, 1.6], offsetMm: [0, 10, 0], axis: 'y', lod: 'make' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'pin-tick', label: 'Nail' },
    listLine: { label: 'Nail', unit: 'pc', defaultSpec: '1.6 × 20' },
  },
  source: 'Back panel pin nail Ø1.6 × 20 mm driven at 150 mm centres into rear rebate or drawer box bottom — generic cabinetmaking practice.',
};
