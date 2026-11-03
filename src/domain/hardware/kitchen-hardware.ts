import type { HardwareEntry } from './hardware-types';

/**
 * Kitchen cargo pull-out system (chassis frame, wire/solid Arena baskets, separators, 3D front fixing brackets,
 * and slide locking screws). All dimensions in millimetres (mm).
 */
export const CARGO_MECHANISM_ENTRY: HardwareEntry = {
  key: 'cargoMechanism',
  category: 'mechanism',
  name: 'Cargo pull-out system with baskets, frame, runners and door brackets',
  unit: 'set',
  mountsOn: ['side', 'base', 'top', 'front'],
  sizesMm: [450, 500],
  defaultVariant: 'frame',
  variants: [
    { key: 'frame', name: 'Cargo pull-out frame', sizeLabel: 'vertical steel chassis + 4 slide brackets (2–3 pręt)', loadKg: 15 },
    { key: 'wire-basket', name: 'Cargo storage basket, wire', sizeLabel: 'clip-on basket + wire separator (Separatory)', loadKg: 15 },
    { key: 'solid-basket', name: 'Cargo storage basket, solid Arena', sizeLabel: 'clip-on basket + wire separator (Separatory)', loadKg: 15 },
    { key: 'front-bracket', name: 'Cargo front fixing bracket', sizeLabel: '103.5 × 36.5 mm 3D mount + GTV move cover', loadKg: 15 },
    { key: 'locking-screw', name: 'Cargo slide locking screw', sizeLabel: 'M4 × 6 mm machine screw' },
  ],
  rules: {
    clearanceMm: { frontSetback: 45, rearGap: 35, bottomGap: 50, topDrop: 40 },
    boardThicknessMm: { min: 16, max: 25, standard: [16, 18] },
    minCarcassDepthMm: 480,
    systemLineMm: 45,
    pitchMm: 374,
    maxSpacingMm: 192,
    edgeInsetMm: 142,
    costEur: 145,
  },
  drilling: [
    { reference: 'front-edge', lineMm: 45, pitchMm: 374, face: 'inside', kind: 'runner', dMm: 2.5, depthMm: 12, stationsMm: [45, 400] },
    { reference: 'centre', lineMm: 142, pitchMm: 78, face: 'back', kind: 'pilot', dMm: 2.5, depthMm: 10, stationsMm: [-39, 39] },
  ],
  fixings: [
    {
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 14',
      qtyPerUnit: 8,
      purpose: 'runner-mount',
      pilotHole: { kind: 'runner', dMm: 2.5, depthMm: 12 },
    },
    { target: 'front', fromFace: 'top', fastenerKind: 'screw', size: 'M4 × 6', qtyPerUnit: 4, purpose: 'cargo-lock' },
    {
      target: 'front',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '4 × 14',
      qtyPerUnit: 4,
      purpose: 'drawer-front',
      pilotHole: { kind: 'pilot', dMm: 2.5, depthMm: 10 },
    },
  ],
  motion: {
    kind: 'telescope',
    axis: 'z',
    extensionRatio: 430 / 450,
    openPullRatio: 0.7,
    members: [
      { role: 'cabinet', ratio: 0, heightMm: 32, lengthRatio: 1, xOffsetMm: 5 },
      { role: 'intermediate', ratio: 0.5, heightMm: 32, lengthRatio: 0.97, xOffsetMm: 9.5 },
      { role: 'drawer', ratio: 1, heightMm: 32, lengthRatio: 0.94, xOffsetMm: 14 },
    ],
  },
  assembly: {
    stage: 'cargo-frame',
    requires: ['drawer-runners'],
    phase: 'place',
    adjustAxes: ['side', 'height', 'depth'],
    testsTravel: true,
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Assemble and align the cargo pull-out',
      summary: 'Mount the upper and lower slides 374 mm apart, hang the baskets on the chassis, lock the slide brackets with M4 × 6 screws, and fix the 3D front brackets.',
      drill: 'Drill Ø2.5 × 12 mm slide pilot holes 45 mm from the front edge and Ø2.5 × 10 mm front bracket holes at 78 mm centres.',
      place: 'Slide the steel chassis onto the runners and clip the baskets and wire separators onto the uprights.',
      fix: 'Drive the four M4 × 6 locking screws into the slide brackets, fasten the 103.5 × 36.5 mm front mounts with 4 × 14 mm screws, and adjust 3-way.',
    },
  },
  display: {
    model3d: {
      family: 'cargo-pullout',
      primitives: [
        { shape: 'box', sizeMm: [103.5, 36.5, 3.5], offsetMm: [0, 0, -1.8], axis: 'z', lod: 'all' },
        { shape: 'box', sizeMm: [24, 650, 20], offsetMm: [0, 0, 0], axis: 'y', lod: 'all' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'runner-dashed', strokeDash: [4, 3], label: 'Cargo pull-out' },
    listLine: {
      label: 'Cargo pull-out system with baskets, frame, runners and door brackets',
      unit: 'set',
      defaultSpec: '450 mm full-extension',
    },
  },
  source:
    'Side- and bottom-mounted cargo pull-out system (374 mm slide & bracket vertical spacing, 45 mm front setback, ' +
    '192 mm bracket span, 78 mm front screw centres, 103.5 × 36.5 mm 3D front mount, 15 kg rated load) — GTV Cargo Movix 150/200 manual.',
};

/**
 * Blind-corner swing-out kidney tray mechanism (vertical pivot post on the blind side + two gallery trays).
 */
export const CORNER_MECHANISM_ENTRY: HardwareEntry = {
  key: 'cornerMechanism',
  category: 'mechanism',
  name: 'Corner pull-out mechanism, two swing trays',
  unit: 'set',
  mountsOn: ['base', 'top', 'partition'],
  sizesMm: [800, 900, 1000],
  rules: {
    clearanceMm: { side: 60, rearGap: 60, topDrop: 40 },
    boardThicknessMm: { min: 16, max: 25, standard: [16, 18] },
    minCarcassDepthMm: 450,
    costEur: 185,
  },
  drilling: [],
  fixings: [
    { target: 'base', fromFace: 'top', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 8 },
  ],
  motion: { kind: 'swing', axis: 'y', maxAngleDeg: 95 },
  assembly: {
    stage: 'inside',
    requires: ['back'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Mount the blind-corner swing-out mechanism',
      summary: 'Anchor the vertical pivot post 60 mm inside the blind opening and hang the two kidney swing trays at 28% and 66% height.',
      place: 'Stand the telescopic pivot post plumb between the base and top boards and lock the upper and lower collars.',
      fix: 'Clip the two gallery trays onto the pivot sleeves and set their height collars.',
    },
  },
  display: {
    model3d: {
      family: 'corner-carousel',
      primitives: [
        { shape: 'box', sizeMm: [22, 680, 22], offsetMm: [0, 0, 0], axis: 'y', lod: 'all' },
        { shape: 'box', sizeMm: [540, 38, 460], offsetMm: [0, 0, 0], axis: 'y', lod: 'all' },
      ],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'hinge-pivot', strokeDash: [6, 3], label: 'Corner mechanism' },
    listLine: {
      label: 'Corner pull-out mechanism, two swing trays',
      unit: 'set',
      defaultSpec: 'two kidney swing trays on pivot post',
    },
  },
  source:
    'Blind-corner swing-out kidney tray mechanism (Ø22 mm vertical pivot post inset 60 mm on blind side, two height-adjustable gallery trays at 28% and 66% clear height) — generic kitchen corner fitting practice.',
};

/**
 * Concealed stay-lift flap mechanism for upward-opening wall cabinet fronts.
 */
export const LIFT_FITTING_ENTRY: HardwareEntry = {
  key: 'liftFitting',
  category: 'lift',
  name: 'Lift-up flap fitting',
  unit: 'set',
  mountsOn: ['side', 'partition', 'front'],
  sizesMm: [250, 360, 450, 600],
  rules: {
    clearanceMm: { side: 20, frontSetback: 37, reveal: 3 },
    boardThicknessMm: { min: 16, max: 25, standard: [16, 18, 19] },
    minCarcassDepthMm: 240,
    maxLeafMm: { width: 1800, height: 600 },
    systemLineMm: 37,
    pitchMm: 32,
    costEur: 55,
  },
  drilling: [
    { reference: 'system32', lineMm: 37, pitchMm: 32, face: 'inside', kind: 'screw', dMm: 5, depthMm: 12, stationsMm: [0, 32] },
  ],
  fixings: [
    { target: 'side', fromFace: 'inside', fastenerKind: 'screw', size: '5 × 12', qtyPerUnit: 4 },
    { target: 'front', fromFace: 'back', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 4 },
  ],
  motion: { kind: 'lift', axis: 'x', maxAngleDeg: 105 },
  assembly: {
    stage: 'doors',
    requires: ['inside'],
    phase: 'after-place',
    adjustAxes: ['side', 'height', 'depth'],
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Fit and balance the lift-up flap stays',
      summary: 'Screw the left and right spring stay housings on the 37 mm System 32 line, clip the flap front onto the lever arms, and balance the spring tension.',
      drill: 'Drill Ø5 × 12 mm System 32 locator holes on the cabinet sides and pilot holes on the back of the flap.',
      place: 'Clip the flap front onto the telescopic stay arms.',
      fix: 'Adjust the spring counterbalance screw until the flap stays open at any height without rising or dropping.',
    },
  },
  display: {
    model3d: {
      family: 'lift-stay',
      primitives: [{ shape: 'box', sizeMm: [22, 140, 180], offsetMm: [0, -70, -90], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'lift-arc', strokeDash: [5, 3], label: 'Lift stay' },
    listLine: { label: 'Lift-up flap fitting', unit: 'set', defaultSpec: 'damped stay lift, pair' },
  },
  source: 'Concealed spring-assisted stay-lift flap mechanism on System 32 side drillings (105° opening angle, variable torque adjustment) — generic wall-cabinet flap practice.',
};

/**
 * Linear recessed aluminium LED lighting profile (60 mm back from front edge, 4 mm diffuser drop).
 */
export const CABINET_LED_ENTRY: HardwareEntry = {
  key: 'cabinetLed',
  category: 'lighting',
  name: 'Recessed LED profile',
  unit: 'm',
  mountsOn: ['top', 'base', 'shelf'],
  sizesMm: [400, 600, 800, 1000, 1200],
  rules: {
    clearanceMm: { frontSetback: 60, topDrop: 4 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    costEur: 28,
  },
  drilling: [],
  fixings: [],
  assembly: {
    stage: 'inside',
    requires: ['top'],
    phase: 'after-place',
    approachFrom: [0, -1, 0],
    instructions: {
      title: 'Press in the recessed LED profile',
      summary: 'Press the aluminium LED channel and opal diffuser into the groove 60 mm behind the front edge.',
      place: 'Seat the LED extrusion flush along the underside groove and lead the low-voltage tail to the driver.',
    },
  },
  display: {
    model3d: {
      family: 'led-strip',
      primitives: [{ shape: 'box', sizeMm: [600, 4, 14], offsetMm: [0, -2, -60], axis: 'x', lod: 'all' }],
      approachVector: [0, -1, 0],
    },
    drawingMark: { symbol: 'led-strip', strokeDash: [8, 3], label: 'LED' },
    listLine: { label: 'Recessed LED profile', unit: 'm', defaultSpec: '60 mm front setback' },
  },
  source: 'Linear recessed aluminium LED channel 60 mm behind front edge (4 mm diffuser projection; cable route & driver confirmed on site) — generic cabinet lighting practice.',
};

/**
 * Integrated appliance door fixing kit (fridge / dishwasher fascia coupling).
 */
export const APPLIANCE_KIT_ENTRY: HardwareEntry = {
  key: 'applianceKit',
  category: 'fixing',
  name: 'Appliance door fixing kit',
  unit: 'set',
  mountsOn: ['front', 'door'],
  sizesMm: [600],
  rules: {
    clearanceMm: { reveal: 3 },
    boardThicknessMm: { min: 16, max: 22, standard: [16, 18, 19] },
  },
  drilling: [],
  fixings: [
    { target: 'front', fromFace: 'back', fastenerKind: 'screw', size: '4 × 16', qtyPerUnit: 6 },
  ],
  assembly: {
    stage: 'fronts',
    requires: ['carcass'],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Couple the furniture front to the integrated appliance',
      summary: 'Fasten the appliance door slider or fixed-door brackets to the furniture panel using the appliance template.',
    },
  },
  display: {
    model3d: {
      family: 'mounting-plate',
      primitives: [{ shape: 'box', sizeMm: [40, 40, 8], offsetMm: [0, 0, -4], axis: 'z', lod: 'make' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'bracket-corner', label: 'Appliance kit' },
    listLine: { label: 'Appliance door fixing kit', unit: 'set', defaultSpec: 'with the appliance' },
  },
  source: 'Integrated appliance door slider / fixed-hinge coupling kit — supplied with the appliance; drill to manufacturer template.',
};

/**
 * Plinth louvred appliance ventilation grille.
 */
export const VENT_GRILLE_ENTRY: HardwareEntry = {
  key: 'ventGrille',
  category: 'plinth',
  name: 'Ventilation grille',
  unit: 'pc',
  mountsOn: ['plinth'],
  sizesMm: [450, 600],
  rules: {
    clearanceMm: { frontSetback: 60 },
    boardThicknessMm: { min: 16, max: 19, standard: [16, 18] },
    costEur: 14,
  },
  drilling: [],
  fixings: [],
  assembly: {
    stage: 'plinth',
    requires: [],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Fit the plinth ventilation grille',
      summary: 'Cut the rectangular air slot in the plinth board and press the louvred ventilation grille home.',
    },
  },
  display: {
    model3d: {
      family: 'wall-bracket',
      primitives: [{ shape: 'box', sizeMm: [450, 60, 18], offsetMm: [0, 0, 0], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'bracket-corner', label: 'Ventilation grille' },
    listLine: { label: 'Ventilation grille', unit: 'pc', defaultSpec: 'confirm cut-out/free area' },
  },
  source: 'Plinth louvred appliance ventilation grille (commonly ≥200 cm² free airflow area for integrated refrigeration/ovens) — generic kitchen installation practice.',
};
