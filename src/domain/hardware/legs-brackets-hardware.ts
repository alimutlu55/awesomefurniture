import type { HardwareEntry } from './hardware-types';

/**
 * Adjustable cabinet/kitchen plinth leg (80–150 mm height, 50 mm corner inset, 60 mm kitchen plinth setback).
 * All dimensions in millimetres (mm).
 */
export const LEG_ENTRY: HardwareEntry = {
  key: 'leg',
  category: 'leg',
  name: 'Adjustable leg',
  unit: 'pc',
  mountsOn: ['base', 'plinth', 'floor'],
  sizesMm: [80, 100, 140, 150],
  rules: {
    clearanceMm: {
      frontSetback: 60,
      bottomGap: 80,
    },
    boardThicknessMm: { min: 16, max: 25, standard: [16, 18] },
    edgeInsetMm: 50,
    costEur: 3,
  },
  drilling: [],
  fixings: [
    {
      target: 'base',
      fromFace: 'bottom',
      fastenerKind: 'screw',
      size: '4 × 16',
      qtyPerUnit: 4,
    },
  ],
  assembly: {
    stage: 'plinth',
    tools: ['hand', 'level'],
    cue: 'Clip on, turn to level',
    requires: [],
    phase: 'after-place',
    approachFrom: [0, -1, 0],
    instructions: {
      title: 'Fit and level the adjustable legs',
      summary: 'Stand the four adjustable plinth legs 50 mm in from each corner under the base board and level the cabinet.',
      place: 'Position the four adjustable legs under the base corners and wind the feet until level.',
    },
  },
  display: {
    model3d: {
      family: 'cabinet-leg',
      primitives: [{ shape: 'cylinder', sizeMm: [44, 140, 44], offsetMm: [0, 70, 0], axis: 'y', lod: 'all' }],
      approachVector: [0, -1, 0],
    },
    drawingMark: { symbol: 'leg-foot', label: 'Leg' },
    listLine: { label: 'Adjustable leg', unit: 'pc', defaultSpec: '140' },
  },
  source: 'Adjustable kitchen plinth leg (80–150 mm height, ±15 mm levelling thread, 50 mm corner inset, 60 mm plinth setback) — generic European kitchen cabinet practice.',
};

/**
 * Snap-on plinth clip attaching the continuous kickboard to the front adjustable legs.
 */
export const PLINTH_CLIP_ENTRY: HardwareEntry = {
  key: 'plinthClip',
  category: 'plinth',
  name: 'Plinth clip',
  unit: 'pc',
  mountsOn: ['plinth'],
  sizesMm: [80, 100, 140, 150],
  rules: {
    clearanceMm: {
      frontSetback: 60,
      bottomGap: 80,
    },
    boardThicknessMm: { min: 16, max: 19, standard: [16, 18] },
    costEur: 1.5,
  },
  drilling: [],
  fixings: [
    {
      target: 'plinth',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '3.5 × 16',
      qtyPerUnit: 2,
    },
  ],
  assembly: {
    stage: 'plinth',
    tools: ['hand'],
    cue: 'Clip the plinth onto the legs',
    requires: [],
    phase: 'after-place',
    approachFrom: [0, 0, 1],
    instructions: {
      title: 'Clip the plinth board onto the legs',
      summary: 'Screw the spring clips to the back of the plinth board and snap them onto the front adjustable legs 60 mm back from the front.',
      fix: 'Press the plinth board home until each clip snaps onto its leg.',
    },
  },
  display: {
    model3d: {
      family: 'cabinet-leg',
      primitives: [{ shape: 'box', sizeMm: [36, 45, 28], offsetMm: [0, 0, 0], axis: 'z', lod: 'make' }],
      approachVector: [0, 0, 1],
    },
    drawingMark: { symbol: 'leg-foot', label: 'Plinth clip' },
    listLine: { label: 'Plinth clip', unit: 'pc', defaultSpec: 'snap-on leg clip' },
  },
  source: LEG_ENTRY.source,
};

/**
 * Concealed adjustable wall cabinet hanger pair (vertical and depth adjustment screws).
 */
export const CABINET_HANGER_ENTRY: HardwareEntry = {
  key: 'hanger',
  category: 'bracket',
  name: 'Cabinet hanger, adjustable',
  unit: 'pair',
  mountsOn: ['side', 'top', 'back', 'wall'],
  sizesMm: [60],
  rules: {
    clearanceMm: {
      topDrop: 30,
      rearGap: 16,
    },
    boardThicknessMm: { min: 16, max: 25, standard: [18] },
    costEur: 12,
  },
  drilling: [],
  fixings: [
    {
      // Two into each side through the hanger's housing: short enough to stay inside an 16 mm board.
      target: 'side',
      fromFace: 'inside',
      fastenerKind: 'screw',
      size: '4 × 16',
      qtyPerUnit: 4,
    },
    // The hanging rail on the wall: the fixing follows the wall (plug and screw in masonry, a stud screw in timber).
    { target: 'wall', fromFace: 'back', fastenerKind: 'screw', size: '5 × 60 with wall plug', qtyPerUnit: 4 },
  ],
  assembly: {
    stage: 'wall',
    tools: ['drill', 'pozidriv', 'level'],
    cue: 'Screw to the wall, hang the cabinet, level',
    requires: ['doors'],
    phase: 'after-place',
    approachFrom: [0, 0, -1],
    instructions: {
      title: 'Hang and level the wall cabinet',
      summary: 'Hook the adjustable cabinet hangers onto the wall mounting rail and turn the vertical and depth screws until level and flush.',
      fix: 'Tighten the depth clamping screws once the cabinet hangs plumb and level.',
    },
  },
  display: {
    model3d: {
      family: 'wall-bracket',
      primitives: [{ shape: 'box', sizeMm: [60, 40, 10], offsetMm: [0, 0, -5], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, -1],
    },
    drawingMark: { symbol: 'bracket-corner', label: 'Hanger' },
    listLine: { label: 'Cabinet hanger, adjustable', unit: 'pair', defaultSpec: 'pair' },
  },
  source: 'Concealed adjustable wall cabinet hanger pair (vertical & depth adjustment screws, 65 kg/pair rated on wall rail) — EN 15939 / generic cabinet hanging practice.',
};

/**
 * Anti-tip wall fixing L-bracket for tall wardrobes and larder cabinets.
 */
export const WALL_BRACKET_ENTRY: HardwareEntry = {
  key: 'bracket',
  category: 'bracket',
  name: 'Wall fixing bracket',
  unit: 'pc',
  mountsOn: ['top', 'side', 'wall'],
  sizesMm: [40],
  rules: {
    clearanceMm: { side: 100 },
    boardThicknessMm: { min: 16, max: 25, standard: [18, 25] },
    edgeInsetMm: 100,
    costEur: 4,
  },
  drilling: [],
  fixings: [
    {
      // Down into the top from above: a 30 mm screw would come out inside the wardrobe through an 18 mm board.
      target: 'top',
      fromFace: 'top',
      fastenerKind: 'screw',
      size: '4 × 16',
      qtyPerUnit: 2,
    },
    // Into the wall: the fixing follows the wall (plug and screw in masonry, a stud screw in timber).
    { target: 'wall', fromFace: 'back', fastenerKind: 'screw', size: '5 × 60 with wall plug', qtyPerUnit: 1 },
  ],
  assembly: {
    stage: 'wall',
    tools: ['drill', 'pozidriv'],
    cue: 'Screw to the cabinet and into the wall',
    requires: ['doors'],
    phase: 'after-place',
    approachFrom: [0, 0, -1],
    instructions: {
      title: 'Anchor the anti-tip wall brackets',
      summary: 'Fix the steel L-brackets 100 mm in from each side under the top board and anchor them into solid wall structure.',
      fix: 'Drive wall anchors into masonry or studs and screw the bracket arms to the top board.',
    },
  },
  display: {
    model3d: {
      family: 'wall-bracket',
      primitives: [{ shape: 'box', sizeMm: [40, 40, 10], offsetMm: [0, 0, -5], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, -1],
    },
    drawingMark: { symbol: 'bracket-corner', label: 'Wall bracket' },
    listLine: { label: 'Wall fixing bracket', unit: 'pc', defaultSpec: 'anti-tip L-bracket' },
  },
  source: 'Anti-tip cabinet wall-restraint L-bracket (40 × 40 mm steel angle, 100 mm side inset at top board) — EN 14749 furniture stability practice.',
};

/**
 * Wall shelf support bracket (one at each end and at most 800 mm apart).
 */
export const SHELF_BRACKET_ENTRY: HardwareEntry = {
  key: 'shelfBracket',
  category: 'bracket',
  name: 'Shelf bracket',
  unit: 'pc',
  mountsOn: ['shelf', 'wall'],
  sizesMm: [150, 200, 250, 300, 350, 400],
  rules: {
    clearanceMm: {},
    boardThicknessMm: { min: 18, max: 50, standard: [25, 30, 40] },
    maxSpacingMm: 800,
    costEur: 8,
  },
  drilling: [],
  fixings: [
    {
      target: 'wall',
      fromFace: 'back',
      fastenerKind: 'screw',
      size: '5 × 60',
      qtyPerUnit: 2,
    },
  ],
  assembly: {
    stage: 'wall',
    tools: ['pozidriv'],
    cue: 'Screw on under the shelf',
    requires: [],
    phase: 'after-place',
    approachFrom: [0, 0, -1],
    instructions: {
      title: 'Mount the wall shelf brackets',
      summary: 'Fix wall shelf brackets level at each end and at most 800 mm apart into wall studs or masonry.',
      fix: 'Anchor the brackets to the wall and secure the shelf board from underneath.',
    },
  },
  display: {
    model3d: {
      family: 'wall-bracket',
      primitives: [{ shape: 'box', sizeMm: [30, 120, 220], offsetMm: [0, -60, 110], axis: 'z', lod: 'all' }],
      approachVector: [0, 0, -1],
    },
    drawingMark: { symbol: 'bracket-corner', label: 'Shelf bracket' },
    listLine: { label: 'Shelf bracket', unit: 'pc', defaultSpec: 'for 250 mm deep' },
  },
  source: 'Heavy-duty wall shelf bracket (one at each end, maximum 800 mm centre spacing) — generic joinery installation practice.',
};
