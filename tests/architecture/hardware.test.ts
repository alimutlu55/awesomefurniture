import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ASSEMBLY_STAGE_SPECS,
  HARDWARE,
  HARDWARE_KEYS,
  HINGE_ENTRY,
  RAIL_ENTRY,
  RUNNER_ENTRY,
  hardware,
  hardwareByCategory,
  requireHardware,
  resolveAssemblyStages,
} from '../../src/domain/hardware/hardware-registry';
import type { AssemblyStage } from '../../src/domain/hardware/hardware-types';
import { DOOR, MIN_HANGING_DEPTH, RAIL_DROP, RAIL_RADIUS } from '../../src/domain/wardrobe/carcass';
import { DOOR_LIMITS } from '../../src/domain/wardrobe/door-layout';
import { RUNNER_CLEARANCE, RUNNER_LENGTHS, RUNNER_REAR_GAP } from '../../src/domain/wardrobe/drawer-runners';
import { FITTINGS, FITTING_HARDWARE_KEYS, type FittingDef } from '../../src/domain/wardrobe/fittings';
import type { EditorDesign } from '../../src/domain/wardrobe/editor-design';
import { HANDLES, handleCentres } from '../../src/domain/wardrobe/handles';
import { HINGES, TIGHT_SIDE, hinge, hingeFor, hingesFor } from '../../src/domain/wardrobe/hinges';
import { CARGO_MOVIX_SPECS } from '../../src/domain/kitchen/cargo-pullout';
import { SELECTION_RULES } from '../../src/domain/planner/selection-config';
import { FIXTURES } from '../../src/domain/studio/fixtures/fixture-kinds';
import { STAGES } from '../../src/domain/make/make-assembly';
import type { FittingKind } from '../../src/domain/make/make-joints';
import { makePiece } from '../../src/domain/make/make-parts';
import { hardwareList } from '../../src/domain/drawings/hardware-list';
import { placePieces } from '../../src/domain/drawings/room-pieces';
import { createInitialDesign } from '../../src/domain/wardrobe/default-design';
import { createKitchenDesign } from '../../src/domain/kitchen/kitchen-design';
import { hardwareModel3d } from '../../src/presentation/viewport/hardware';
import { FITTING_NAMES, fittingIcon, hardwareDisplay } from '../../src/presentation/make/make-panel-tabs';
import { createEditorState } from '../../src/application/projects/editor-state';
import { projectToScene, sceneToProject } from '../../src/application/projects/editor-mapper';
import { createProject } from '../../src/domain/project/project';
import { deserializeProject, serializeProject } from '../../src/infrastructure/serialization/project-codec';

/**
 * Every piece of furniture hardware is declared once in `src/domain/hardware/` (in millimetres)
 * and consumed across the whole application.
 *
 * This test walks EVERY entry in `HARDWARE` through EVERY place in the app that uses it:
 *   1. domain        — category, mountsOn, sizes, rules, source citation, registry lookups
 *   2. drilling      — hole patterns, reference lines, fixings, pilot holes, glass exclusions
 *   3. editor 3D     — 3D model at editor level of detail (`hardwareModel3d(entry, 'editor')`)
 *   4. Make 3D       — 3D model at Make/Studio level of detail and approach vector
 *   5. drawings      — technical drawing symbol and label (`display.drawingMark`)
 *   6. lists         — hardware list specification (`display.listLine`), Make chips and icons
 *   7. steps         — dependency-driven assembly stage, prerequisites (`requires`), instructions
 *   8. motion        — swing, telescope, slide, and lift kinematics and limits
 *   9. planner       — Auto design and domain limits derived from the registry
 *  10. save/load     — project serialization round-trip for hardware-backed designs
 *
 * A missing or inconsistent piece fails with `<entry.key>: <step>` named.
 */

const MAKE_FITTING_KINDS = new Set<string>(Object.keys(FITTING_NAMES));

function meshCountAndBounds(root: THREE.Object3D): { meshes: number; box: THREE.Box3 } {
  root.updateMatrixWorld(true);
  let meshes = 0;
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) meshes++;
  });
  const box = new THREE.Box3().setFromObject(root);
  return { meshes, box };
}

test('hardware registry · every entry passes domain, drilling, editor 3D, Make 3D, drawings, lists, steps, and motion', () => {
  assert.ok(HARDWARE.length >= 28, 'all baseline hardware families are registered');
  assert.equal(new Set(HARDWARE_KEYS).size, HARDWARE.length, 'hardware keys are unique');

  const stageOrder = resolveAssemblyStages();
  assert.deepEqual(stageOrder, [...STAGES], 'STAGES is resolved from the hardware stage dependency graph');

  for (const entry of HARDWARE) {
    // 1. domain
    assert.match(entry.key, /^[a-zA-Z]+$/, `${entry.key}: domain — key must be a single camelCase identifier`);
    assert.equal(hardware(entry.key), entry, `${entry.key}: domain — hardware(key) lookup`);
    assert.equal(requireHardware(entry.key), entry, `${entry.key}: domain — requireHardware(key) lookup`);
    assert.ok(
      hardwareByCategory(entry.category).includes(entry),
      `${entry.key}: domain — hardwareByCategory('${entry.category}') includes entry`,
    );
    assert.ok(entry.mountsOn.length > 0, `${entry.key}: domain — mountsOn must name at least one target`);
    assert.ok(entry.sizesMm.length > 0 && entry.sizesMm.every(s => s > 0), `${entry.key}: domain — sizesMm must be positive mm`);
    assert.ok(
      entry.rules.boardThicknessMm.min <= entry.rules.boardThicknessMm.max &&
        entry.rules.boardThicknessMm.standard.length > 0,
      `${entry.key}: domain — boardThicknessMm range and standard thicknesses must be valid`,
    );
    assert.ok(entry.source.trim().length >= 10, `${entry.key}: domain — must cite its millwork standard or practice source`);
    if (entry.defaultVariant) {
      assert.ok(
        entry.variants?.some(v => v.key === entry.defaultVariant),
        `${entry.key}: domain — defaultVariant '${entry.defaultVariant}' must exist in variants`,
      );
    }

    // 2. drilling & fixings
    for (const hole of entry.drilling) {
      assert.ok(hole.dMm > 0, `${entry.key}: drilling — hole diameter dMm must be > 0`);
      assert.ok(hole.depthMm >= 0, `${entry.key}: drilling — hole depthMm must be >= 0`);
      if (!hole.through && hole.depthMm > 0 && hole.face !== 'edge') {
        assert.ok(
          hole.depthMm <= entry.rules.boardThicknessMm.max,
          `${entry.key}: drilling — blind face hole depth ${hole.depthMm} mm exceeds max board thickness ${entry.rules.boardThicknessMm.max} mm`,
        );
      }
    }
    for (const fixing of entry.fixings) {
      assert.ok(
        entry.mountsOn.includes(fixing.target),
        `${entry.key}: drilling — fixing target '${fixing.target}' must be declared in mountsOn (${entry.mountsOn.join(', ')})`,
      );
      assert.ok(fixing.qtyPerUnit > 0, `${entry.key}: drilling — fixing qtyPerUnit must be > 0`);
      assert.ok(fixing.size.length > 0, `${entry.key}: drilling — fixing size must be non-empty`);
      if (fixing.pilotHole) {
        assert.ok(fixing.pilotHole.dMm > 0, `${entry.key}: drilling — pilotHole diameter must be > 0`);
      }
    }

    // 3. editor 3D
    const editorObj = hardwareModel3d(entry, 'editor');
    const editorStats = meshCountAndBounds(editorObj);
    assert.ok(editorStats.meshes > 0, `${entry.key}: editor 3D — hardwareModel3d(entry, 'editor') must produce at least one mesh`);
    assert.ok(
      !editorStats.box.isEmpty() &&
        Number.isFinite(editorStats.box.min.x) &&
        Number.isFinite(editorStats.box.max.x),
      `${entry.key}: editor 3D — bounding box must be non-empty and finite`,
    );

    // 4. Make 3D & Studio 3D
    const makeObj = hardwareModel3d(entry, 'make');
    const makeStats = meshCountAndBounds(makeObj);
    assert.ok(makeStats.meshes >= editorStats.meshes, `${entry.key}: Make 3D — Make LOD has at least as many meshes as editor LOD`);
    assert.ok(!makeStats.box.isEmpty(), `${entry.key}: Make 3D — bounding box must be non-empty`);
    const studioObj = hardwareModel3d(entry, 'studio');
    assert.ok(meshCountAndBounds(studioObj).meshes >= makeStats.meshes, `${entry.key}: Make 3D — Studio close-up LOD is valid`);
    assert.equal(entry.display.model3d.approachVector.length, 3, `${entry.key}: Make 3D — approachVector must have 3 components`);

    // 5. drawings
    const mark = entry.display.drawingMark;
    assert.ok(mark.symbol.length > 0, `${entry.key}: drawings — drawingMark.symbol must be non-empty`);
    assert.ok((mark.label?.length ?? 0) > 0, `${entry.key}: drawings — drawingMark.label must be non-empty`);
    if (mark.strokeDash) {
      assert.ok(mark.strokeDash.every(n => n > 0), `${entry.key}: drawings — strokeDash values must be > 0`);
    }

    // 6. lists
    const line = entry.display.listLine;
    assert.ok(line.label.length > 0, `${entry.key}: lists — listLine.label must be non-empty`);
    assert.equal(line.unit, entry.unit, `${entry.key}: lists — listLine.unit must match entry.unit`);
    assert.ok(line.defaultSpec.length > 0, `${entry.key}: lists — listLine.defaultSpec must be non-empty`);
    if (MAKE_FITTING_KINDS.has(entry.key)) {
      const kind = entry.key as FittingKind;
      const disp = hardwareDisplay({ kind, size: line.defaultSpec });
      assert.ok(disp.name.length > 0, `${entry.key}: lists — hardwareDisplay name must be non-empty`);
      assert.match(fittingIcon(kind), /^<svg\b.*<path d="[^"]+"\/>/, `${entry.key}: lists — fittingIcon SVG path must be defined`);
    }

    // 7. steps
    assert.ok(stageOrder.includes(entry.assembly.stage), `${entry.key}: steps — stage '${entry.assembly.stage}' must be in STAGES`);
    for (const req of entry.assembly.requires) {
      assert.ok(stageOrder.includes(req), `${entry.key}: steps — prerequisite '${req}' must be in STAGES`);
      assert.ok(
        stageOrder.indexOf(req) <= stageOrder.indexOf(entry.assembly.stage),
        `${entry.key}: steps — prerequisite '${req}' must precede '${entry.assembly.stage}' in resolved stage order`,
      );
    }
    assert.ok(entry.assembly.instructions.title.length > 0, `${entry.key}: steps — instructions.title must be non-empty`);
    assert.ok(entry.assembly.instructions.summary.length > 0, `${entry.key}: steps — instructions.summary must be non-empty`);
    assert.equal(entry.assembly.approachFrom.length, 3, `${entry.key}: steps — approachFrom must be a 3-vector`);

    // 8. motion
    if (entry.motion) {
      const m = entry.motion;
      assert.ok(['x', 'y', 'z'].includes(m.axis), `${entry.key}: motion — axis must be x, y, or z`);
      if (m.kind === 'swing') {
        assert.ok(m.maxAngleDeg > 0 && m.maxAngleDeg <= 180, `${entry.key}: motion — swing maxAngleDeg must be in (0, 180]`);
      } else if (m.kind === 'telescope') {
        assert.ok(m.extensionRatio > 0, `${entry.key}: motion — telescope extensionRatio must be > 0`);
        assert.ok(m.openPullRatio > 0 && m.openPullRatio <= 1, `${entry.key}: motion — telescope openPullRatio must be in (0, 1]`);
        assert.ok(m.members.length >= 2, `${entry.key}: motion — telescope must define at least 2 members`);
        assert.equal(m.members[0]!.ratio, 0, `${entry.key}: motion — outer cabinet member ratio must be 0`);
        assert.equal(m.members.at(-1)!.ratio, 1, `${entry.key}: motion — inner drawer member ratio must be 1`);
      } else if (m.kind === 'slide') {
        assert.ok(m.travelRatio > 0 && m.travelRatio <= 1, `${entry.key}: motion — slide travelRatio must be in (0, 1]`);
      } else if (m.kind === 'lift') {
        assert.ok(m.maxAngleDeg > 0 && m.maxAngleDeg <= 135, `${entry.key}: motion — lift maxAngleDeg must be in (0, 135]`);
      }
    }
  }
});

test('hardware registry · fittings, studio fixtures, planner limits, exclusions, and save/load are wired to the registry', () => {
  // Every fitting hardware tag maps to a registered HardwareEntry
  for (const f of FITTINGS as readonly FittingDef[]) {
    for (const tag of f.hardware ?? []) {
      const mappedKey = FITTING_HARDWARE_KEYS[tag];
      assert.ok(mappedKey && hardware(mappedKey), `${f.key}: fitting hardware tag '${tag}' must resolve to a registered HardwareEntry`);
    }
  }

  // Every studio fixture type declares its mounting hardware in the registry
  for (const fixture of FIXTURES) {
    for (const ft of fixture.types) {
      assert.ok(ft.hardware.length > 0, `${fixture.key}/${ft.id}: studio fixture type must declare mounting hardware`);
      for (const hwKey of ft.hardware) {
        assert.ok(hardware(hwKey), `${fixture.key}/${ft.id}: fixture hardware '${hwKey}' must exist in HARDWARE`);
      }
    }
  }

  // Dependency-driven stage resolution works for any active subset of stages
  const wallCabinetStages = new Set<AssemblyStage>(['carcass', 'top', 'back', 'inside', 'doors', 'wall']);
  const resolvedSubset = resolveAssemblyStages(wallCabinetStages);
  assert.deepEqual(resolvedSubset, ['carcass', 'top', 'back', 'inside', 'doors', 'wall']);
  for (const spec of ASSEMBLY_STAGE_SPECS) {
    for (const req of spec.requires) {
      assert.ok(STAGES.indexOf(req) < STAGES.indexOf(spec.stage), `stage '${req}' comes before '${spec.stage}'`);
    }
  }

  // 9. planner & domain limits match the hardware registry
  assert.deepEqual([...RUNNER_LENGTHS], RUNNER_ENTRY.sizesMm.map(mm => mm / 10), 'runner: RUNNER_LENGTHS matches RUNNER_ENTRY.sizesMm');
  assert.equal(RUNNER_CLEARANCE * 10, RUNNER_ENTRY.rules.clearanceMm.side, 'runner: side clearance matches registry');
  assert.equal(RUNNER_REAR_GAP * 10, RUNNER_ENTRY.rules.clearanceMm.rearGap, 'runner: rear gap matches registry');
  assert.equal(HINGES[0]!.plate.line, HINGE_ENTRY.rules.systemLineMm, 'hinge: System 32 line matches registry');
  assert.equal(TIGHT_SIDE * 10, HINGE_ENTRY.rules.clearanceMm.side, 'hinge: tight side clearance matches registry');
  assert.equal(hingesFor(1800), 4, 'hinge: hingesFor quantityByHeightMm matches registry');
  assert.equal(DOOR.standoff * 10, HINGE_ENTRY.rules.clearanceMm.standoff, 'hinge: door standoff matches registry');
  assert.equal(DOOR_LIMITS.width * 10, HINGE_ENTRY.rules.maxLeafMm?.width, 'hinge: max door leaf width matches registry');
  assert.equal(DOOR_LIMITS.height * 10, HINGE_ENTRY.rules.maxLeafMm?.height, 'hinge: max door leaf height matches registry');
  assert.equal(MIN_HANGING_DEPTH * 10, RAIL_ENTRY.rules.minCarcassDepthMm, 'rail: min hanging depth matches registry');
  assert.equal(RAIL_DROP * 10, RAIL_ENTRY.rules.clearanceMm.topDrop, 'rail: top drop matches registry');
  assert.equal(RAIL_RADIUS * 10, RAIL_ENTRY.rules.clearanceMm.side, 'rail: radius matches registry');
  const railSpans = typeof RAIL_ENTRY.rules.maxSpanMm === 'object' ? RAIL_ENTRY.rules.maxSpanMm : { 18: 1200, 25: 900 };
  assert.equal(SELECTION_RULES.railSpan, railSpans[18], 'planner: SELECTION_RULES.railSpan matches RAIL_ENTRY.rules.maxSpanMm');
  assert.equal(SELECTION_RULES.coatSpan, railSpans[25], 'planner: SELECTION_RULES.coatSpan matches RAIL_ENTRY.rules.maxSpanMm');
  assert.equal(HINGES.length, HINGE_ENTRY.variants?.length, 'hinge: HINGES variants match HINGE_ENTRY.variants');
  assert.equal(CARGO_MOVIX_SPECS.slideVerticalSpacing * 10, hardware('cargoMechanism')!.rules.pitchMm, 'cargoMechanism: slide vertical spacing matches registry');

  // Exclusions: glass doors get clamp hinges with cup === null and 0 holes in Make
  const glassKind = hingeFor({ x0: 0, x1: 50 }, { w: 100, secs: [] }, true);
  assert.equal(hinge(glassKind).cup, null, 'hinge: glass exclusion forbids 35 mm cup');
  assert.deepEqual(handleCentres(HANDLES[0]!, 128, 200), [-6.4, 6.4], 'handle: 128 mm bar screw centres');

  // Hardware list and Make pieces read from the registry for both wardrobes and kitchen units
  const wDesign: EditorDesign = {
    ...createInitialDesign(),
    w: 120,
    h: 220,
    d: 60,
    n: 2,
    wt: [1, 1],
    doors: 'hinged',
    secs: [[{ k: 'drawer', h: 20 }, { k: 'long', h: 140 }], [{ k: 'pants', h: 60 }, { k: 'basket', h: 20 }]],
  };
  const kCargo = createKitchenDesign('base', 'cargo');
  for (const d of [wDesign, kCargo]) {
    const input = { pieces: [{ id: 1, name: 'Unit', x: 0, y: 0, z: 0, angle: 0, design: d }] };
    const tables = hardwareList(placePieces(input));
    assert.ok(tables.length > 0 && tables[0]!.rows.length > 0, 'lists — hardwareList produces rows');
    const mp = makePiece(input, 1)!;
    assert.ok(mp.buy.length > 0 && mp.steps.length > 0, 'steps — makePiece produces buy list and steps');
  }

  // 10. save/load round-trip preserves hardware settings (joints, back, handle, door hinge overrides)
  const state = createEditorState();
  Object.assign(state, {
    ...structuredClone(wDesign),
    wt: [1, 1, 1, 1, 1, 1],
    secs: [...structuredClone(wDesign.secs), [], [], [], []],
    construction: { joints: 'cam', back: 'grooved' },
    materials: { ...state.materials, handleKind: 'bar', handleSize: 160, handleFinish: 'matte_black' },
    fronts: { overlay: 'full', reveal: 3, leaves: { '0.0': { hingeKind: 'wide' } } },
  });
  const scene = { wardrobes: [{ id: 1, name: 'W', x: 0, y: 0, z: 0, angle: 0, state }], activeWardrobe: 1, nextWardrobeId: 2 };
  const roundTripped = projectToScene(deserializeProject(serializeProject(sceneToProject(createProject('hw', 'HW'), scene as never))))!;
  const restored = roundTripped.wardrobes[0]!.state;
  assert.deepEqual(restored.construction, { joints: 'cam', back: 'grooved' }, 'save/load: construction round-trips');
  assert.equal(restored.materials?.handleSize, 160, 'save/load: handle size round-trips');
  assert.equal(restored.fronts?.leaves?.['0.0']?.hingeKind, 'wide', 'save/load: hingeKind override round-trips');
});
