# Adding a piece of hardware

Every piece of furniture hardware is declared once in `src/domain/hardware/` (plain data,
millimetres) and exported in `HARDWARE` (`src/domain/hardware/hardware-registry.ts`).
Editor 3D, Make and Assembly Studio 3D, domain rules, fittings and studio fixtures,
technical drawings, hardware and buy lists, drilling checks, Auto design limits, and
project save/load all read from that entry.

Never copy hardware kinds, dimensions, or hole patterns into another file: the
architecture check (`npm run check:architecture`) fails on hand-written lists of
hardware keys outside `src/domain/hardware/`.

| Family | File | Entries |
|---|---|---|
| Registry & stages | `hardware-registry.ts` | `ASSEMBLY_STAGE_SPECS`, `HARDWARE` |
| Drawer runners | `drawer-hardware.ts` | `RUNNER_ENTRY` |
| Hinges, plates & door tracks | `hinges-hardware.ts` | `HINGE_ENTRY`, `PLATE_ENTRY`, `SLIDING_TRACK_ENTRY` |
| Handles & push latches | `handles-hardware.ts` | `HANDLE_ENTRY`, `PUSH_TO_OPEN_ENTRY` |
| Rails, pins & pull-out racks | `rails-supports-hardware.ts` | `RAIL_ENTRY`, `RAIL_SUPPORT_ENTRY`, `SHELF_PIN_ENTRY`, `PULL_DOWN_RAIL_ENTRY`, `TROUSER_RACK_ENTRY`, `WIRE_BASKET_ENTRY` |
| Carcass & back connectors | `connectors-hardware.ts` | `CONFIRMAT_ENTRY`, `CAM_ENTRY`, `BOLT_ENTRY`, `DOWEL_ENTRY`, `SCREW_ENTRY`, `NAIL_ENTRY` |
| Legs, plinths & wall brackets | `legs-brackets-hardware.ts` | `LEG_ENTRY`, `PLINTH_CLIP_ENTRY`, `CABINET_HANGER_ENTRY`, `WALL_BRACKET_ENTRY`, `SHELF_BRACKET_ENTRY` |
| Kitchen mechanisms & services | `kitchen-hardware.ts` | `CARGO_MECHANISM_ENTRY`, `CORNER_MECHANISM_ENTRY`, `LIFT_FITTING_ENTRY`, `CABINET_LED_ENTRY`, `APPLIANCE_KIT_ENTRY`, `VENT_GRILLE_ENTRY` |

## Recipe

1. Add a `HardwareEntry` in the matching family file in `src/domain/hardware/` and append it
   to `HARDWARE` in `src/domain/hardware/hardware-registry.ts`:
   - **What it is**: `key`, `category`, `name`, `unit`, `mountsOn`, `sizesMm`, and optional
     `variants` / `defaultVariant`.
   - **Rules (`rules`)**: `clearanceMm` (side, frontSetback, rearGap, bottomGap, topDrop,
     standoff, reveal), `boardThicknessMm` (`min`, `max`, `standard`), and optional
     `minCarcassDepthMm`, `quantityByHeightMm`, `edgeInsetMm`, `maxSpacingMm`, `maxSpanMm`,
     `maxLeafMm`, `systemLineMm`, `pitchMm`, and `exclusions` (such as `material: 'glass',
     forbidsHoles: true`).
   - **Drilling (`drilling`)**: hole patterns referenced to `system32`, `front-edge`,
     `rear-edge`, `joint-line`, `centre`, or `rebate`, with `face`, `kind`, `dMm`, and `depthMm`.
   - **Fixings (`fixings`)**: which fasteners go into which `target` board (must be in
     `mountsOn`), from which face (`fromFace`), `size`, `qtyPerUnit`, and `pilotHole`.
   - **Motion (`motion`, optional)**: `swing`, `telescope`, `slide`, or `lift`, with its
     pivot/travel `axis`, limits, and intermediate member ratios (`members`).
   - **Assembly (`assembly`)**: `stage`, `requires` (the stages that must be in place first;
     `resolveAssemblyStages()` derives the build sequence from these dependencies), `phase`,
     `approachFrom`, and `instructions` (`title`, `summary`, `drill`, `place`, `fix`).
   - **Display (`display`)**:
     - `model3d`: `family`, `primitives` (in mm, tagged with `lod: 'editor' | 'make' | 'studio' | 'all'`),
       and `approachVector`. Shared 3D builders live in `src/presentation/viewport/hardware.ts`
       and `hardware-models.ts`.
     - `drawingMark`: technical drawing `symbol`, optional `strokeDash`, and `label`.
     - `listLine`: `label`, `unit`, and `defaultSpec` for the hardware and buy lists.
   - **Source (`source`)**: cite the generic millwork standard or trade rule.
2. If a wardrobe/kitchen fitting or a Studio room fixture is held by the new hardware,
   reference its key in `FITTINGS` (`src/domain/wardrobe/fittings.ts`) or `FIXTURES`
   (`src/domain/studio/fixtures/fixture-kinds.ts`).
3. Run `npm test` and `npm run check:architecture`. `tests/architecture/hardware.test.ts`
   walks every entry in `HARDWARE` through `domain`, `drilling`, `editor 3D`, `Make 3D`,
   `drawings`, `lists`, `steps`, `motion`, `planner`, and `save/load`, naming the entry and
   step if anything is missing.

## Where we simplify

- **Generic System 32 millwork, not brand templates**: hole patterns follow generic System 32
  practice (37 mm front setback, 32 mm vertical pitch, 12.5 mm side clearance per telescopic
  runner member, Ø35 × 13 mm hinge cup centred 22.5 mm from the door edge, 50 mm connector
  end inset and ≤ 300 mm spacing). Always check the hardware maker's drilling template before
  boring production stock.
- **Sloped-top joints**: a sloped top is drilled and screwed straight down into the uprights
  below rather than mitre-bored normal to the sloped face.
- **Procedural 3D levels of detail**: 3D models are built from shared procedural primitives
  in `src/presentation/viewport/hardware.ts` (`editor` keeps silhouette-Defining parts;
  `make` and `studio` include telescoping intermediate rails, fasteners, cam housings, and
  adjustment screws) rather than external CAD meshes.
