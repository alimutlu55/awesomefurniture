import {
  BOLT_ENTRY,
  CAM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  NAIL_ENTRY,
  SCREW_ENTRY,
} from './connectors-hardware';
import { HANDLE_ENTRY, PUSH_TO_OPEN_ENTRY } from './handles-hardware';
import type {
  AssemblyStage,
  AssemblyStageSpec,
  HardwareCategory,
  HardwareEntry,
} from './hardware-types';
import { HINGE_ENTRY, PLATE_ENTRY } from './hinges-hardware';
import {
  PULL_DOWN_RAIL_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SHELF_PIN_ENTRY,
  TROUSER_RACK_ENTRY,
  WIRE_BASKET_ENTRY,
} from './rails-supports-hardware';

export {
  BOLT_ENTRY,
  CAM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  HANDLE_ENTRY,
  HINGE_ENTRY,
  NAIL_ENTRY,
  PLATE_ENTRY,
  PULL_DOWN_RAIL_ENTRY,
  PUSH_TO_OPEN_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SCREW_ENTRY,
  SHELF_PIN_ENTRY,
  TROUSER_RACK_ENTRY,
  WIRE_BASKET_ENTRY,
};

/**
 * Dependency graph of assembly stages.
 * The assembly order is resolved topologically from what each stage and hardware entry declares
 * in `requires`, rather than from a fixed stage array.
 */
export const ASSEMBLY_STAGE_SPECS: readonly AssemblyStageSpec[] = [
  {
    stage: 'plinth',
    requires: [],
    title: 'Build the plinth',
    summary: 'Join the plinth rails and bearers flat and square so the base has a level frame to stand on.',
  },
  {
    stage: 'carcass',
    requires: ['plinth'],
    title: 'Stand the carcass',
    summary: 'Join the sides to the base so the outer shell stands square.',
  },
  {
    stage: 'partitions',
    requires: ['carcass'],
    title: 'Stand the partitions and fixed shelves',
    summary: 'Fix the upright partitions and structural shelves to divide the carcass into bays.',
  },
  {
    stage: 'top',
    requires: ['carcass', 'partitions'],
    title: 'Fit the top',
    summary: 'Set the top board onto the sides and partitions and lock the joints.',
  },
  {
    stage: 'back',
    requires: ['top'],
    title: 'Square the carcass and fit the back',
    summary: 'Check the two diagonals are equal, then fix the back panel into the rear rebates.',
  },
  {
    stage: 'inside',
    requires: ['back'],
    title: 'Fit the interior shelves and rails',
    summary: 'Push the shelf support pins into their 5 mm holes, rest the adjustable shelves, and hang the rails.',
  },
  {
    stage: 'drawer-boxes',
    requires: ['inside'],
    title: 'Assemble the drawer boxes',
    summary: 'Join the box sides and ends on the bench and fix the 6 mm drawer bottoms square.',
  },
  {
    stage: 'drawer-runners',
    requires: ['carcass', 'partitions', 'drawer-boxes'],
    title: 'Mount the drawer runners',
    summary: 'Screw the cabinet runner members on the 37 mm System 32 line and the drawer members to the box sides.',
  },
  {
    stage: 'cargo-frame',
    requires: ['drawer-runners'],
    title: 'Prepare the pull-out chassis frame',
    summary: 'Stage the steel pull-out frame ready to receive its baskets and engage the slides.',
  },
  {
    stage: 'cargo-baskets',
    requires: ['cargo-frame'],
    title: 'Hang the pull-out baskets',
    summary: 'Clip the wire or solid trays onto the chassis uprights at the chosen tier heights.',
  },
  {
    stage: 'drawers',
    requires: ['drawer-runners', 'cargo-baskets'],
    title: 'Engage the drawers on their runners',
    summary: 'Slide each drawer box or pull-out chassis onto the telescoping cabinet runners until the latches click.',
  },
  {
    stage: 'fronts',
    requires: ['drawers'],
    title: 'Fix and align the drawer fronts',
    summary: 'Fasten the decorative fronts from inside the drawer boxes and align the reveals.',
  },
  {
    stage: 'drawer-test',
    requires: ['fronts'],
    title: 'Test drawer travel',
    summary: 'Open and close each drawer in turn to check full extension, parallel reveals, and soft close.',
  },
  {
    stage: 'doors',
    requires: ['inside', 'drawer-test'],
    title: 'Hang and adjust the doors',
    summary: 'Press the hinge cups into the doors, screw the mounting plates on the 37 mm line, clip on, and adjust 3-way.',
  },
  {
    stage: 'wall',
    requires: ['doors'],
    title: 'Secure to the wall',
    summary: 'Level the unit in place and anchor the top anti-tip brackets or wall hangers into solid masonry or studs.',
  },
];

const STAGE_SPEC_MAP = new Map<AssemblyStage, AssemblyStageSpec>(
  ASSEMBLY_STAGE_SPECS.map(s => [s.stage, s]),
);

/**
 * Resolves the topological build sequence from the dependency graph (`requires`) for the active stages present
 * in a piece (wardrobe or kitchen unit alike).
 */
export function resolveAssemblyStages(activeStages?: ReadonlySet<AssemblyStage>): AssemblyStage[] {
  const visited = new Set<AssemblyStage>();
  const ordered: AssemblyStage[] = [];
  function visit(stage: AssemblyStage) {
    if (visited.has(stage)) return;
    visited.add(stage);
    const spec = STAGE_SPEC_MAP.get(stage);
    if (spec) {
      for (const req of spec.requires) visit(req);
    }
    if (!activeStages || activeStages.has(stage)) ordered.push(stage);
  }
  for (const spec of ASSEMBLY_STAGE_SPECS) visit(spec.stage);
  return ordered;
}

export function assemblyStageSpec(stage: AssemblyStage): AssemblyStageSpec | undefined {
  return STAGE_SPEC_MAP.get(stage);
}

/**
 * Side-mounted full-extension telescopic ball-bearing drawer runners (System 32).
 * Every dimension is in millimetres (mm).
 */
export const RUNNER_ENTRY: HardwareEntry = {
  key: 'runner',
  category: 'runner',
  name: 'Drawer runners',
  unit: 'pair',
  mountsOn: ['side', 'partition', 'drawer-box'],
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
    costEur: 35,
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

/**
 * The single domain hardware registry.
 * Every piece of furniture hardware is declared here in millimetres and read across the whole app.
 */
export const HARDWARE: readonly HardwareEntry[] = [
  RUNNER_ENTRY,
  HINGE_ENTRY,
  PLATE_ENTRY,
  HANDLE_ENTRY,
  PUSH_TO_OPEN_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SHELF_PIN_ENTRY,
  PULL_DOWN_RAIL_ENTRY,
  TROUSER_RACK_ENTRY,
  WIRE_BASKET_ENTRY,
  CONFIRMAT_ENTRY,
  CAM_ENTRY,
  BOLT_ENTRY,
  DOWEL_ENTRY,
  SCREW_ENTRY,
  NAIL_ENTRY,
];

const BY_KEY = new Map<string, HardwareEntry>(HARDWARE.map(h => [h.key, h]));

export const HARDWARE_KEYS = HARDWARE.map(h => h.key);

export function hardware(key: string): HardwareEntry | undefined {
  return BY_KEY.get(key);
}

export function requireHardware(key: string): HardwareEntry {
  const entry = BY_KEY.get(key);
  if (!entry) throw new Error(`Unknown hardware entry "${key}"`);
  return entry;
}

export function hardwareByCategory(category: HardwareCategory): HardwareEntry[] {
  return HARDWARE.filter(h => h.category === category);
}
