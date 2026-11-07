import type { HardwareEntry } from './hardware-types';

/**
 * Side-mounted full-extension telescopic ball-bearing drawer runners (System 32).
 * Every dimension is in millimetres (mm).
 */
export const RUNNER_ENTRY: HardwareEntry = {
  key: 'runner',
  category: 'runner',
  name: 'Drawer runners',
  unit: 'pair',
  mountsOn: ['side', 'partition', 'drawer-box', 'front'],
  sizesMm: [250, 270, 300, 350, 400, 450, 500, 550, 600],
  rules: {
    clearanceMm: {
      side: 12.5,
      frontSetback: 37,
      rearGap: 10,
      bottomGap: 15,
      topDrop: 40,
      standoff: 2,
    },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    minCarcassDepthMm: 266,
    systemLineMm: 37,
    pitchMm: 32,
    costEur: 25,
    // Ball-bearing and concealed soft-close runners for wardrobe and kitchen drawers are commonly rated 30 kg a pair.
    ratedLoadKg: 30,
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
      stationsMm: [0, 224, 448],
    },
    {
      reference: 'front-edge',
      lineMm: 50,
      face: 'outside',
      kind: 'runner',
      dMm: 2.5,
      depthMm: 12,
      stationsMm: [50, 350],
    },
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
      target: 'drawer-box',
      fromFace: 'outside',
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
      { role: 'cabinet', ratio: 0, heightMm: 45, lengthRatio: 1, xOffsetMm: 1.6 },
      { role: 'intermediate', ratio: 0.5, heightMm: 34, lengthRatio: 0.96, xOffsetMm: 5.8 },
      { role: 'drawer', ratio: 1, heightMm: 24, lengthRatio: 0.94, xOffsetMm: 10.5 },
    ],
  },
  assembly: {
    stage: 'drawer-runners',
    requires: ['carcass', 'partitions', 'drawer-boxes'],
    phase: 'after-place',
    testsTravel: true,
    approachFrom: [0, 0, 0],
    instructions: {
      title: 'Mount the drawer runners',
      summary: 'Screw the cabinet runner channels on the 37 mm System 32 line and fix the drawer members to the box sides.',
      drill: 'Drill 5 × 12 mm System 32 holes on the uprights and 2.5 × 12 mm pilot holes on the box sides.',
      place: 'Position the outer runner channels level on each upright and the inner members along the box sides.',
      fix: 'Drive the 4 × 12 mm pan-head screws from inside the cabinet and outside each drawer box side.',
    },
  },
  display: {
    model3d: {
      family: 'runner-telescope',
      primitives: [
        { shape: 'channel', sizeMm: [12.5, 45, 450], offsetMm: [1.6, 0, 0], axis: 'z', lod: 'all' },
        { shape: 'channel', sizeMm: [12.5, 34, 432], offsetMm: [5.8, 0, 0], axis: 'z', lod: 'make' },
        { shape: 'channel', sizeMm: [12.5, 24, 423], offsetMm: [10.5, 0, 0], axis: 'z', lod: 'make' },
      ],
      approachVector: [0, 0, 0],
    },
    drawingMark: {
      symbol: 'runner-dashed',
      strokeDash: [4, 3],
      label: 'Runner',
    },
    listLine: {
      label: 'Drawer runners',
      unit: 'pair',
      defaultSpec: '450 mm full-extension, soft-close',
    },
  },
  source: 'System 32 (37 mm front setback, 32 mm pitch, 12.5 mm side clearance per member; 250–600 mm nominal lengths) — common practice; check the maker\'s template before drilling.',
};
