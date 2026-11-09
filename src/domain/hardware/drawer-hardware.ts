import type { HardwareEntry } from './hardware-types';

/**
 * Bottom-mounted drawer runners (System 32), as knock-down drawers are hung: a pair of rails screwed to the cabinet
 * sides only, two screws at the front, a peg at the rear in a System 32 hole. The drawer box rests on the rails: a hook
 * at the rail's rear end engages the box's back, and a pin at its front comes up through the box's bottom, where a
 * locking plate and lever (DRAWER_LOCK_ENTRY) hold it. Nothing is screwed into the drawer box.
 * Every dimension is in millimetres (mm).
 */
export const RUNNER_ENTRY: HardwareEntry = {
  key: 'runner',
  category: 'runner',
  name: 'Drawer runners, bottom-mounted',
  unit: 'pair',
  mountsOn: ['side', 'partition', 'drawer-box', 'front'],
  sizesMm: [250, 270, 300, 350, 400, 450, 500, 550, 600],
  rules: {
    clearanceMm: {
      // Between the box side and the cabinet side, where the rail stands.
      side: 12.5,
      frontSetback: 37,
      rearGap: 10,
      // Under the box side: the rail's foot the box rests on.
      bottomGap: 15,
      topDrop: 40,
      standoff: 2,
    },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 266,
    systemLineMm: 37,
    pitchMm: 32,
    costEur: 12,
    // Bottom-mounted roller and ball runners for knock-down drawers are commonly rated about 25 kg a pair.
    ratedLoadKg: 25,
  },
  drilling: [
    // The rail's front bracket: two screws on the System 32 line, one step apart, in Ø2.5 pilot holes.
    { reference: 'system32', lineMm: 37, pitchMm: 32, face: 'inside', kind: 'runner', dMm: 2.5, depthMm: 12, stationsMm: [0, 32] },
    // The rail's rear peg: a System 32 hole this far in from the rail's rear end (to the nearest slot).
    { reference: 'rear-edge', lineMm: 37, pitchMm: 32, face: 'inside', kind: 'runner', dMm: 5, depthMm: 12, stationsMm: [20] },
    // The box back's hook hole, this far up from its lower edge, over the middle of each box side.
    { reference: 'rear-edge', lineMm: 8, face: 'back', kind: 'runner', dMm: 6, depthMm: 10 },
    // The front pin's hole through the box bottom, this far behind the box front's inner face.
    { reference: 'front-edge', lineMm: 30, face: 'bottom', kind: 'runner', dMm: 10, depthMm: 0 },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 12',
      qtyPerUnit: 4,
      purpose: 'runner-mount',
      pilotHole: { kind: 'runner', dMm: 2.5, depthMm: 12 },
    },
    {
      target: 'front',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 30',
      qtyPerUnit: 2,
      purpose: 'drawer-front',
      pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 12 },
    },
  ],
  motion: {
    kind: 'telescope',
    axis: 'z',
    extensionRatio: 1,
    openPullRatio: 0.7,
    members: [
      { role: 'cabinet', ratio: 0, heightMm: 30, lengthRatio: 1, xOffsetMm: 0 },
      { role: 'drawer', ratio: 1, heightMm: 12, lengthRatio: 0.97, xOffsetMm: 6 },
    ],
  },
  assembly: {
    stage: 'drawer-runners',
    requires: ['carcass', 'partitions', 'drawer-back'],
    phase: 'after-place',
    testsTravel: true,
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount the drawer runners',
      summary: 'Screw each runner to the cabinet side with two screws at the front; its rear peg goes into its 5 mm hole.',
      drill: 'On the 37 mm line at the runner\'s height: two Ø2.5 mm pilot holes at the front (37 and 69 mm in) for the screws, one Ø5 mm hole near the rear for the peg.',
      place: 'Hook the rear peg into its hole, rest the rail level and line its front bracket up with the two holes.',
      fix: 'Drive the two 4 × 12 mm pan-head screws through the front bracket into each cabinet side.',
    },
  },
  display: {
    model3d: {
      family: 'runner-telescope',
      primitives: [
        { shape: 'channel', sizeMm: [12.5, 30, 450], offsetMm: [0, 0, 0], axis: 'z', lod: 'all' },
        { shape: 'channel', sizeMm: [12.5, 12, 436], offsetMm: [6, 0, 0], axis: 'z', lod: 'make' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: {
      symbol: 'runner-dashed',
      strokeDash: [4, 3],
      label: 'Runner',
    },
    listLine: {
      label: 'Drawer runners',
      unit: 'pair',
      defaultSpec: '450 mm bottom-mounted, rear hook and front lock',
    },
  },
  source: 'Bottom-mounted knock-down drawer runners: screwed to the cabinet only on the System 32 37 mm line (two front screws, '
    + 'rear peg), the box hooked on at the back and locked at the front; 12.5 mm side clearance, 250–600 mm lengths. '
    + 'Common practice for flat-pack drawers; check the maker\'s template before drilling.',
};

/**
 * The front lock of a bottom-mounted runner: a locking plate under the drawer bottom over the runner's front pin, and a
 * lever screwed onto the pin and turned, so the drawer cannot lift off its runners. One plate and one lever a side.
 */
export const DRAWER_LOCK_ENTRY: HardwareEntry = {
  key: 'drawerLock',
  category: 'runner',
  name: 'Drawer front lock',
  unit: 'pc',
  mountsOn: ['drawer-box'],
  sizesMm: [35],
  variants: [
    { key: 'plate', name: 'Locking plate, laid under the drawer bottom over the runner pin', sizeLabel: 'plate', sizesMm: [60] },
    { key: 'lever', name: 'Locking lever, screwed onto the runner pin and turned', sizeLabel: 'lever', sizesMm: [35] },
  ],
  defaultVariant: 'lever',
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 3, max: 8, standard: [6] },
    costEur: 0.4,
  },
  drilling: [],
  fixings: [],
  assembly: {
    stage: 'drawer-lock',
    requires: ['drawers'],
    phase: 'after-place',
    approachFrom: [0, -1, 0],
    instructions: {
      title: 'Lock the drawers to the runners',
      summary: 'Screw a locking lever onto each front pin under the drawer and turn it to lock the drawer to its runners.',
      place: 'Lay a locking plate under the bottom over each front pin as the drawer goes on.',
      fix: 'Screw the lever up onto the pin by hand and turn it until it locks.',
    },
  },
  display: {
    model3d: {
      family: 'fastener',
      primitives: [
        { shape: 'box', sizeMm: [60, 2, 18], offsetMm: [0, 0, 0], axis: 'y', lod: 'all' },
        { shape: 'cylinder', sizeMm: [8, 12, 8], offsetMm: [0, -7, 0], axis: 'y', lod: 'make' },
      ],
      approachVector: [0, -1, 0],
    },
    drawingMark: { symbol: 'connector-cross', label: 'Lock' },
    listLine: { label: 'Drawer front lock', unit: 'pc', defaultSpec: 'locking plate and lever' },
  },
  source: 'Front locking device of bottom-mounted knock-down drawer runners: a plate over the runner\'s front pin under the drawer bottom '
    + 'and a lever screwed onto the pin — common flat-pack practice.',
};
