# Cargo assembly corrections — 3 November 2026

The initial scene left cargo hardware in the cabinet footprint, insertion jumped to the installed depth, and brackets did not follow the door. The installation sequence also fitted baskets before the door.

Reference: Kesseböhmer DISPENSA Pantry VVS-X installation instructions MA 4037400000, revision 005-2019-09-12, pages 4, 8, 10–13: runner mounting; frame engagement; brackets on door (bottom first); door coupling and adjustment; shelves installed front edge first and rear hooks engaged. Manufacturer-authored PDF: https://www.wurthmachinery.com/skin/common_files/files/specs/DISPENSAPantry-InstallationInstruction.pdf . Current manufacturer download entry: https://www.kesseboehmer.us/kitchen/pantry-cabinets/dispensa . FurniDraw uses a generic mechanism, not a certified product-specific template.

## Corrections

- Future mechanisms are hidden until their step. The cabinet assembly footprint is empty initially; boards remain on the floor staging area.
- The runner-motion pass no longer overwrites a mechanism's staging/insertion transform.
- Frame installation has continuous progress, with lift/alignment ahead of the opening followed by straight axial insertion. Baskets follow the door in a separate chapter and seat their front edge before lowering rear hooks.
- Door brackets and fastening screws are children of the door mesh, so they stay aligned on the floor, during transport and after coupling. The screws are fitted before moving the door; bracket entry is along the door thickness rather than across its width.
- Bottom-mounted cargo uses the base and, for tall units, the top as runner/guide hosts. Side mounting retains the chosen side. The rendered carrier/guide uses cargo geometry rather than a duplicated pair of side-mounted drawer slides. Screw holes reference the actual mounting boards and axes.
- Front connector tongues reach the door-bracket receiver. Basket rendering retains the configured tier count.
- Basket installation extends the cargo first, gives each basket six seconds, then closes it. Moving target offsets are blended into the placement path so engagement does not jump.
- The camera includes moving mechanisms, and the frame's rotated bounds determine its floor height.

## Verification

`cargo-assembly-motion.test.ts` checks the actual Three.js fitting layer: empty initial footprint for base/tall cargo, rendered positions at 10 ms samples, door parenting, chapter order and carrier mounting boards. A separate rule verifies fixed X/Y during axial insertion. Existing cargo customization, serialization, quantities and geometry tests remain.

Browser reproduction: `node scripts/check-cargo-assembly.mjs` with Vite on port 5174 (`MOBILE_TEST_URL` overrides). Captures initial, frame, door and basket checkpoints at 1280 and 375 px under `artifacts/cargo-assembly/`. The browser uses an isolated temporary cargo scene and does not open saved designs.

Limits: generic schematic hardware and fastener dimensions; no product-specific drilling certification, physical installation trial or load validation. The reference is a tall pantry mechanism; base cargo variants use the corresponding modeled mount and may have different manufacturer procedures.

Final code verification: `npm run check` passed with 2,243 tests, including five new rendered-motion regressions; boundaries, architecture, editor/production typechecks, build and SEO passed. No golden fixtures were re-recorded. `git diff --check` passed.

## Correction after reported disconnected door

The earlier verification was insufficient. It proved continuity and parenting but not attachment. The user supplied a screenshot showing the resulting gap.

Two independent defects were reproduced: the cargo door used the generic drawer's 390 mm demonstration travel, while the 500 mm cargo runner limited the frame to 350 mm (40 mm separation). Also, Make reconstructed the mechanism using the front's y=81.5 mm rather than the actual opening y=98 mm, putting bracket centres 16.5 mm apart. Fittings now carry the construction's cargo geometry, and the door uses the cargo runner's 350 mm travel. The rendered receiver/tongue intersection is tested in both closed and open positions for base and tall units.

The revised animation preassembles the mechanism: prepare frame outside → seat baskets on tier bridges outside → slide the loaded assembly 600 mm along the runner axis into the cabinet → attach door → test travel. All basket rear edges remain at least 50 mm ahead of the cabinet opening during loading. Each basket has front/rear bridges at its underside datum. This supersedes the earlier basket-after-door chapter order and related test expectation. The prior branded reference's sequence was not an adequate demonstration of the modeled generic mechanism.
