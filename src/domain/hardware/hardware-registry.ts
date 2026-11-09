import {
  BOLT_ENTRY,
  CAM_ENTRY,
  CONFIRMAT_ENTRY,
  DOWEL_ENTRY,
  NAIL_ENTRY,
  SCREW_ENTRY,
} from './connectors-hardware';
import { DRAWER_LOCK_ENTRY, RUNNER_ENTRY } from './drawer-hardware';
export { DRAWER_LOCK_ENTRY, RUNNER_ENTRY } from './drawer-hardware';
import { HANDLE_ENTRY, PUSH_TO_OPEN_ENTRY } from './handles-hardware';
import type {
  AssemblyStage,
  AssemblyStageSpec,
  HardwareCategory,
  HardwareEntry,
} from './hardware-types';
import { HINGE_ENTRY, PLATE_ENTRY, SLIDING_TRACK_ENTRY } from './hinges-hardware';
import {
  APPLIANCE_KIT_ENTRY,
  CABINET_LED_ENTRY,
  CARGO_MECHANISM_ENTRY,
  CORNER_MECHANISM_ENTRY,
  LIFT_FITTING_ENTRY,
  VENT_GRILLE_ENTRY,
} from './kitchen-hardware';
import {
  CABINET_HANGER_ENTRY,
  LEG_ENTRY,
  PLINTH_CLIP_ENTRY,
  SHELF_BRACKET_ENTRY,
  WALL_BRACKET_ENTRY,
} from './legs-brackets-hardware';
import {
  PULL_DOWN_RAIL_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SHELF_PIN_ENTRY,
  TROUSER_RACK_ENTRY,
  WIRE_BASKET_ENTRY,
} from './rails-supports-hardware';

export {
  APPLIANCE_KIT_ENTRY,
  BOLT_ENTRY,
  CABINET_HANGER_ENTRY,
  CABINET_LED_ENTRY,
  CAM_ENTRY,
  CARGO_MECHANISM_ENTRY,
  CONFIRMAT_ENTRY,
  CORNER_MECHANISM_ENTRY,
  DOWEL_ENTRY,
  HANDLE_ENTRY,
  HINGE_ENTRY,
  LEG_ENTRY,
  LIFT_FITTING_ENTRY,
  NAIL_ENTRY,
  PLATE_ENTRY,
  PLINTH_CLIP_ENTRY,
  PULL_DOWN_RAIL_ENTRY,
  PUSH_TO_OPEN_ENTRY,
  RAIL_ENTRY,
  RAIL_SUPPORT_ENTRY,
  SCREW_ENTRY,
  SHELF_BRACKET_ENTRY,
  SHELF_PIN_ENTRY,
  SLIDING_TRACK_ENTRY,
  TROUSER_RACK_ENTRY,
  VENT_GRILLE_ENTRY,
  WALL_BRACKET_ENTRY,
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
    title: 'Start the drawer boxes: fronts and bottoms',
    summary: 'Lay each drawer front face down on a soft mat, screw in its cam bolts, and slide the bottom into its groove, centred.',
  },
  {
    stage: 'drawer-sides',
    requires: ['drawer-boxes'],
    title: 'Fit the drawer sides',
    summary: 'Push the dowels in, set each side over the cam bolts with the bottom in its groove, and turn the cams to lock.',
  },
  {
    stage: 'drawer-back',
    requires: ['drawer-sides'],
    title: 'Fit the drawer backs',
    summary: 'Hook the back over the edge of the bottom, swing it into place, and hammer the expanding dowels through it into the sides.',
  },
  {
    stage: 'drawer-runners',
    requires: ['carcass', 'partitions', 'drawer-back'],
    title: 'Mount the drawer runners',
    summary: 'Screw each runner to the cabinet side with two screws at the front; its rear peg goes into its 5 mm hole.',
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
    title: 'Put the drawers on their runners',
    summary: 'Pull the runners out, hook each drawer back onto the rear hooks and lower the front onto the front pins through the locking plates.',
  },
  {
    stage: 'drawer-lock',
    requires: ['drawers'],
    title: 'Lock the drawers to the runners',
    summary: 'Screw a locking lever onto each front pin under the drawer and turn it to lock the drawer to its runners.',
  },
  {
    stage: 'fronts',
    requires: ['drawer-lock'],
    title: 'Fix and align the drawer fronts',
    summary: 'Fasten the decorative fronts from inside the drawer boxes and align the reveals.',
  },
  {
    stage: 'drawer-test',
    requires: ['fronts'],
    title: 'Test drawer travel',
    summary: 'Open and close each drawer in turn to check smooth travel, parallel reveals and that both locks hold.',
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
 * The single domain hardware registry.
 * Every piece of furniture hardware is declared here in millimetres and read across the whole app.
 */
export const HARDWARE: readonly HardwareEntry[] = [
  RUNNER_ENTRY,
  DRAWER_LOCK_ENTRY,
  HINGE_ENTRY,
  PLATE_ENTRY,
  SLIDING_TRACK_ENTRY,
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
  LEG_ENTRY,
  PLINTH_CLIP_ENTRY,
  CABINET_HANGER_ENTRY,
  WALL_BRACKET_ENTRY,
  SHELF_BRACKET_ENTRY,
  CARGO_MECHANISM_ENTRY,
  CORNER_MECHANISM_ENTRY,
  LIFT_FITTING_ENTRY,
  CABINET_LED_ENTRY,
  APPLIANCE_KIT_ENTRY,
  VENT_GRILLE_ENTRY,
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
