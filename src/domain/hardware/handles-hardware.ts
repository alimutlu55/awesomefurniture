import type { HardwareEntry } from './hardware-types';

const CENTRES = [96, 128, 160, 192, 320] as const;

/** Handle finishes, and the colour the 3D view gives each. Push-to-open has no handle at all: a latch opens the front. */
export const HANDLE_FINISH_CATALOG = [
  { key: 'matte_black', name: 'Matte black', colour: '#242426' },
  { key: 'brushed_brass', name: 'Brushed brass', colour: '#b99a57' },
  { key: 'anodized_champagne', name: 'Anodized champagne', colour: '#c2b69c' },
  { key: 'handleless_tip_on', name: 'Handleless · push-to-open', colour: '#242426' },
] as const;

/** Standard door handle line height from the floor in millimetres (1000 mm = 100 cm). */
export const HANDLE_HEIGHT_MM = 1000;

/**
 * Cabinet handles (bar handle, knob, edge pull, recessed pull, profile pull, full-height bar).
 * All dimensions in millimetres (mm).
 */
export const HANDLE_ENTRY: HardwareEntry = {
  key: 'handle',
  category: 'handle',
  name: 'Handle',
  unit: 'pc',
  mountsOn: ['door', 'front'],
  sizesMm: CENTRES,
  defaultVariant: 'bar',
  variants: [
    { key: 'bar', name: 'Bar handle', sizeLabel: '128 mm', sizesMm: CENTRES, fixing: 'through', projectionMm: 30 },
    { key: 'knob', name: 'Knob', sizeLabel: 'single', sizesMm: [], fixing: 'single', projectionMm: 28 },
    { key: 'edge', name: 'Edge pull', sizeLabel: '128 mm', sizesMm: CENTRES, fixing: 'back', projectionMm: 15 },
    { key: 'recessed', name: 'Recessed pull', sizeLabel: '128 mm', sizesMm: [96, 128, 160, 192], fixing: 'none', projectionMm: 0 },
    { key: 'profile', name: 'Profile pull', sizeLabel: 'full', sizesMm: [], fullSpan: true, fixing: 'none', projectionMm: 0 },
    { key: 'full', name: 'Full-height bar', sizeLabel: 'full', sizesMm: [], fullSpan: true, fixing: 'through', projectionMm: 30 },
  ],
  rules: {
    clearanceMm: {
      side: 40,
      topDrop: 60,
      endCutShort: 100,
    },
    boardThicknessMm: { min: 16, max: 28, standard: [16, 18, 19, 22] },
    edgeInsetMm: 40,
    exclusions: [
      {
        material: 'glass',
        forbidsHoles: true,
        reason: 'Do not drill handle screw holes through tempered glass leaves.',
      },
    ],
    costEur: 6,
  },
  drilling: [
    {
      reference: 'centre',
      lineMm: 40,
      face: 'front',
      kind: 'handle',
      dMm: 5,
      depthMm: 0,
      through: true,
    },
    {
      reference: 'front-edge',
      lineMm: 10,
      face: 'back',
      kind: 'handle',
      dMm: 4,
      depthMm: 10,
    },
  ],
  fixings: [
    {
      target: 'door',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: 'M4 × 25',
      qtyPerUnit: 2,
      pilotHole: { kind: 'handle', dMm: 5, depthMm: 0 },
    },
    {
      target: 'front',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '3.5 × 15',
      qtyPerUnit: 2,
      pilotHole: { kind: 'handle', dMm: 4, depthMm: 10 },
    },
  ],
  assembly: {
    stage: 'doors',
    requires: ['fronts', 'doors'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Fit the handles',
      summary: 'Fasten each handle through its Ø5 mm clearance holes or screw edge pulls into the back of the front.',
      drill: 'Drill Ø5 mm through-holes at the handle centre-to-centre spacing (or Ø4 × 10 mm back pilot holes for edge pulls).',
      place: 'Align the handle posts on the front face or top/side edge.',
      fix: 'Drive the M4 handle machine screws from the inside face of the door or drawer front.',
    },
  },
  display: {
    model3d: {
      family: 'handle',
      primitives: [
        { shape: 'cylinder', sizeMm: [12, 160, 12], offsetMm: [0, 0, 24], axis: 'y', lod: 'all' },
        { shape: 'cylinder', sizeMm: [8.4, 24, 8.4], offsetMm: [0, -64, 12], axis: 'z', lod: 'all' },
        { shape: 'cylinder', sizeMm: [8.4, 24, 8.4], offsetMm: [0, 64, 12], axis: 'z', lod: 'all' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'handle-bar',
      label: 'Handle',
    },
    listLine: {
      label: 'Handle',
      unit: 'pc',
      defaultSpec: 'Bar handle 128 mm · brushed brass',
    },
  },
  source: 'common practice; check the maker\'s template',
};

/**
 * Push-to-open latch for handleless fronts (`handleless_tip_on`).
 */
export const PUSH_TO_OPEN_ENTRY: HardwareEntry = {
  key: 'pushLatch',
  category: 'handle',
  name: 'Push-to-open mechanism',
  unit: 'pc',
  mountsOn: ['side', 'partition', 'top', 'base'],
  sizesMm: [10],
  rules: {
    clearanceMm: { reveal: 2, standoff: 3 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    costEur: 10,
  },
  drilling: [],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '3.5 × 15',
      qtyPerUnit: 2,
    },
  ],
  assembly: {
    stage: 'doors',
    requires: ['carcass'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount push-to-open latches',
      summary: 'Fix the push latch on the opening side opposite the hinges with a 2 mm trigger gap.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [{ shape: 'cylinder', sizeMm: [10, 50, 10], offsetMm: [0, 0, 0], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'handle-bar',
      label: 'Tip-on',
    },
    listLine: {
      label: 'Push-to-open mechanism',
      unit: 'pc',
      defaultSpec: 'compatible with hinge/runner; 2mm shadow gaps',
    },
  },
  source: HANDLE_ENTRY.source,
};
