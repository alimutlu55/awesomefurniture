# Studio fixtures

Studio → **Fixtures** opens a searchable catalog. A selected wall's Add menu also has a Fixtures tab. Items are placed on a free compatible part of the selected/viewed wall, or on a compatible support. Their installation panel opens after insertion. Floor items can also stand in an open Studio.

## Included

- Toilet: wall-hung, back-to-wall, and floor-standing with visible cistern.
- Basin: wall-hung, vessel, and pedestal; separate deck/wall-mounted faucet.
- Floating/floor-standing reference vanity; rectangular/round mirror.
- Raised/flush shower area, fixed/handed hinged screen, exposed/concealed shower set.
- Freestanding/built-in bath, floor/wall-mounted bidet.
- Towel rail, toilet-roll holder, washing machine, dryer, hydronic/electric towel radiator.
- Independent installation enclosures, including shared boxing and per-face finishes.
- Complete presets: toilet with enclosure, vanity/basin/tap/mirror, and walk-in shower.

These are generic planning objects. Reference vanities have editable outside dimensions and appearance, not cabinet internals, storage calculations, or manufacturing parts.

## Editing

Select an item on the canvas. **Type**, **Size**, **Installation**, and **Finish** open its properties. The sheet has the same tabs on phones, plus Done, Undo and Redo. Fields follow the chosen display unit; scene data remains centimetres.

Drag a selected fixture to reposition it. Wall-mounted items slide along their host, with wall-end/centre and neighbour alignment. Shift releases snapping. Items attached to a basin or vanity retain local positions on that support. Rulers use the shared measurement controls for exact width editing.

More → **Select assembly** highlights a preset's members. Dragging then moves its roots together; supported children follow once. More also offers item/assembly duplication and removal. Independent supports cannot be removed while another item still depends on them. Duplicates get fresh IDs and unconfirmed service connections.

For a concealed toilet, Installation offers:

- Existing concealed installation, with no additional enclosure.
- New partial-height enclosure.
- New full-height lining.
- Factory-finished cistern module.
- A shared enclosure already in the scene.

Enclosure outside width, height, depth and lining are independent of bowl size. Increasing depth carries attached fixtures forward. The editor shows the total projection into the room. Front, side and ledge finishes can differ; the front can be painted, tiled or panelled. A shared enclosure survives deletion of one fixture.

Installation also records a generic reserved cistern/support volume and front/top access. Service fields associate required connections with existing wall utility items. Combined water symbols do not define precise pipe locations. Generic products and unresolved construction remain review findings.

## Scene behavior and persistence

Physical solids participate in cabinet collisions in both directions. Radiators now contribute their physical wall projection. Use/access areas remain advisory. Wall edits carry explicit attachments; wall splits rebind them to the corresponding segment. Host deletion and room replacement refuse unresolved mounted dependencies rather than losing them. Free-standing fixtures can remain when room walls are removed.

Fixture documents use **schema version 3**. Existing version-1 projects retain their shape; version 2 remains reserved for a retired ceiling format. Older application versions cannot open fixture documents. Undo, reopening, project export/import, and dirty comparisons include fixture data.

Technical drawings include fixture footprints, attached items in wall elevations, and a separate **Fixture & installation schedule** with setting-out coordinates and review findings. Fixtures stay outside cabinet cutting lists and wardrobe Auto design.

## Code and verification

Definitions and rules live in `src/domain/studio/fixtures/`. Commands are in `src/application/commands/fixture-commands.ts`. The editor, catalog and sheet are in `src/presentation/editor/fixture-*.ts`; geometry and scene resources are in `src/presentation/viewport/fixture-*.ts`. The strict codec uses `src/infrastructure/serialization/fixture-schema.ts`.

Run `npm run check`, then `npm run check:mobile` with Vite on port 4173. The fixture browser flow can also run independently with `node scripts/check-studio-fixtures.mjs`; it verifies desktop and 375 px layouts and writes screenshots to `docs/verification/studio-fixtures/`.

The wider [feature proposal](studio-interior-fixtures-plan.md) remains the roadmap. Cursor placement previews, manufacturer catalogs, editable bathroom cabinetry, cut-outs/niches, pipe routes, detailed door sweeps, complete regional rules, surface-region finish editing, lighting, and wider movable furnishings remain subsequent work.
