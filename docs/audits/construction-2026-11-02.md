# Construction audit — 2 November 2026

## Physical rules (written before regression fixes)

1. Width closes: outer width = two sides + bay clear widths + intervening partitions. The 18 mm boards occupy their allocated intervals exactly.
2. Height closes: floor = plinth + 18 mm base; interior ends at the actual underside of the roof. Wall units have zero plinth. Rail centre is 60 mm below its fitting top.
3. Depth closes: 6 mm back + usable depth + front setback = outer depth. Partition setback is 5 mm; fitting setback is 14 mm plus inset-door intrusion.
4. Boards have positive dimensions; rectangular cut dimensions equal their physical extents. Shaped boards retain the actual polygon, including door tops.
5. Doors respect the specified reveal and roof profile; drawer boxes have 12.5 mm runner clearance on each side and remain behind their fronts.
6. Shared boards occur once. Parts cover every board once; only geometrically and operationally identical boards share a part number. Blind drilling depth is part of identity.
7. Cut placement preserves the actual cut dimensions, including fractions of a millimetre; every board occurs once, inside trim, with the specified kerf and grain constraints.
8. A hole must start on material, remain in material for its depth, and avoid other drilling except intentional intersecting connector bores. Hardware must connect to real supporting material.
9. Back rebates/grooves require positive engagement in the surrounding material; a zero-volume touching rectangle is not machining.
10. Presentation and exports must consume the same construction dimensions and operations.

These are required properties, not a claim that every property has been verified. Results and unresolved scope are recorded below as the audit proceeds.

## Result

**Not yet a build-ready construction model.** This change fixes eight demonstrated defects and adds executable coverage, but the back attachment model and several other machining/presentation paths remain incomplete. Passing the application checks is not certification that this furniture can be manufactured from the current exports.

Branch: `fix/construction-precision-audit`. Work started 2 November; final validation continued 3 November.

## Reproduced defects and changes

| Defect | Expected versus previous actual | Source and correction |
|---|---|---|
| Cut layout changed panel sizes | Tall/fridge: 1404.6 → 1405 mm; drawer panel: 241.5 → 242 mm; oven-under: 86.5 → 87 mm; tall fridge: 1234.6 → 1235 mm; oven tower: 242.5 → 243 mm; golden sloped part: 2280.261009020485 → 2280 mm | `make-cut-layout.ts` rounded lengths and widths before packing. Packing now preserves their dimensional values. |
| Different cut sizes shared a part number | 500.1 and 500.4 mm boards require two parts; previous result was one | `make-parts.ts` used whole-mm drawing labels as identity. Uses dimensional values instead. Binary arithmetic noise is normalized for identity only; stock dimensions are not rounded to a cutting grid. |
| Different blind drill depths shared a part number | Same Ø8 hole at depths 10 and 12 mm requires two machining specifications; previous result was one | `drillingSignature` omitted depth. Depth now participates in identity. |
| Sloped doors were rectangular boards | First test leaf roof endpoints: 2197.4 and 1898.6 mm; previous board was 2197.4 mm across its width, 298.8 mm too tall at the low end | `cabinetBoards` retained only a maximum height and a note. It now carries the actual clipped door polygon. The second leaf has roof endpoints 1897.4 and 1598.6 mm. |
| Sloped upright did not meet the top exactly | Pilot mouth 1384.3114590204848 mm; material ended at 1384.3112340204848 mm: 0.000225 mm gap | `ceilingPolyline` sampled an interval beside x instead of evaluating the one-sided limit at x. It now evaluates the limit exactly. Extracted to `ceiling-polyline.ts` to respect the architecture file-size guard. |
| Shaped part sheets omitted drilling and used different axes | First sloped door has seven modeled bores, including Ø35 × 13 mm cups at u=100, v=22.5 mm; the sheet returned zero bores | `partDrilling` discarded all drilling for shaped fronts/backs. It now keeps it. Domain `flatOutline` aligns SVG and PDF polygons with the drilling length/width axes. Shaped sheets retain their original face instead of flipping the bores without flipping the polygon. |
| Under-stairs handle hole missed material | Bore centre y=1025.4305555555557 mm where the door ended at y=1016.7083333333334 mm: 8.7222222222223 mm outside | `handlePlacement` used maximum door height. It now accepts the physical outline and evaluates roof height at the screw line; Make, editor door rendering, and door facts supply that outline. |

| Wall brackets floated above shaped roofs | Under-stairs left bracket: expected roof underside 774.8052662052542 mm, actual 2280 mm (1505.194733794746 mm too high); regular roof expected 2282 mm, actual 2280 mm | `frontHardware` used `design.h - 2` and no board reference. Brackets now sit on the local roof underside and reference that roof board. This fixes placement, not the still-unspecified bracket screw template. |

The initial regression run failed 10 of 40 tests. Subsequent hole, sheet, shape and wall-bracket sweeps independently exposed the additional failures before their fixes. The existing cut-layout test was changed from asserting **rounded area** to asserting **both actual side lengths**; this strengthens the physical contract. No expected size was rounded to make a regression pass. Tolerances of 1e-8 mm in geometric assertions admit floating-point arithmetic noise only.

## Rule-by-rule coverage

| Rule | Evidence | Scope and remaining uncertainty |
|---|---|---|
| Bay widths plus boards equal outside width | New matrix plus existing `millwork-precision.test.ts` width/count/weight sweep | All registered kitchen units/presets, six applied golden wardrobes, all six shape templates open and hinged. Multi-piece kitchen panel sharing retains existing tests; no new exhaustive installation sweep. |
| Interior floor and depth deductions | Matrix asserts base underside at plinth, top at plinth +18 mm, back face at 6 mm, front setback 5 mm; fitting depth D−20 mm, partition depth D−11 mm | Includes zero-plinth wall units. Rail constant checked at 60 mm; actual rail positions/clear openings covered by existing millwork tests, not independently measured for every fitting. |
| Positive boards and matching cutting extents | Matrix checks every board; non-polygon boards have all three cutting extents checked | Polygon roof and door tests added. No complete solid intersection test for every pair, rear-depth roof shape, bevel or mitre. |
| Exact roof contact | Golden sloped hole/material regression and exact polyline limits | Ordinary slopes and all template hole mouths checked. Compound front-to-back slopes are not certified. |
| Front fit and drawer clearance | Exact sloped door roof values; existing drawer-box tests assert 12.5 mm runners and no carcass overlap for wardrobe/kitchen drawers | Not every door style/hinge/runner/size combination. No manufacturer-specific drilling certification. |
| Board/part/assembly accounting | Matrix checks all board IDs once in parts and assembly, all fitting quantities, all hardware board references | References/counts plus a roof-contact assertion for each wall bracket; this does not prove every fitting has physically sufficient anchorage. |
| Joint systems | Matrix evaluates all three systems and asserts unchanged board geometry and valid hole references; existing construction tests verify drilling findings and connections | Hole-mouth material sweep uses the default system. No exhaustive cylindrical bore intersections across all systems. |
| Hole positions | Matrix verifies each default-system hole mouth against board bounds and polygon height | It does **not** prove the full bore diameter/path, edge-bore depth, angled-bore path, countersink, or intended cam/pilot intersection. Existing `drillingChecks` is primarily a flat-face check. |
| Cut packing | Matrix verifies exact dimensions, thickness, every board once, trim and pairwise kerf; existing tests check grain and oversize | Layout still packs finished board sizes, while CSV separately deducts selected edge banding. Shaped stock blanks/edge machining need a fuller contract. |
| Back board attachment | Direct inspection and numerical probe below | **Failed physical rule; unresolved.** |
| Presentation is a projection of construction | Shaped SVG/PDF share domain flat outline; sheet bores checked against domain holes; existing Make PDF/CSV tests pass; desktop/mobile smoke checks | **Not fully satisfied.** Technical drawings, hardware list, editor renderers and formatting still contain independent derivations. |

## Known construction defects and unverified work

1. **Back fixing is not a valid machining model.** For an empty 1000 × 2200 × 600 mm wardrobe with one bay and a grooved back, `backFixing` returns groove extents of **964 × 0 × 6 mm** (top), **0 × 2102 × 6 mm** (each side), and **964 × 18 × 0 mm** (base). Required: positive material engagement and a matching back size; actual engagement is zero. The function intersects touching boxes; it does not model a rebate/groove cut or extend the back into it. The nailed option likewise needs a verified overlap/rebate and fastener path. No arbitrary engagement depth was invented in this patch. The existing test that construction choices never change boards is insufficient for this rule.
2. **Technical cutting list differs from Make.** `pieceBoards` contains the cabinet/front boards; `makePiece` adds drawer-box boards separately. `cutting-list.ts` calls `pieceBoards`, rounds to whole-mm labels and groups on those labels. The technical list therefore is not the complete Make manufacturing bill. It has not been migrated here.
3. **Hardware is not one authoritative schedule.** `hardware-list.ts` recalculates quantities independently. Its existing sloped-hinge test even permits inequality against Make. Shelf brackets, proprietary corner/cargo systems, lift mechanisms, push-to-open devices, wall fixings and appliance kits need a complete purchased-hardware/attachment contract.
4. **Machining identity is not finished.** Depth and cutting-size grouping are fixed, but flat drilling coordinates are still quantized to 0.1 mm by `flatHoles`; groove identity is not part of `makeParts`. Sub-tenth-mm drill differences and different grooves on otherwise identical boards are not proved distinct.
5. **No fabrication trial.** No boards were cut or assembled, no manufacturer templates validated, no structural/load checks performed. The generic runner/hinge/handle assumptions should not be described as a verified branded system.
6. **Presentation rounding remains.** Make CSV/PDF format dimensions to tenths of a millimetre; technical drawings use whole-mm formatting. Exact irrational slope lengths and some fractionally distributed sizes therefore do not all appear identically across views. Editor scene geometry has not been fully replaced by construction boards.
7. **Browser coverage is visual smoke coverage.** Regular and under-stairs wardrobes were opened in Make and Assembly Studio at 1280 × 900 and 375 × 812. Checks assert no JavaScript page errors and no horizontal overflow. This does not validate every displayed label, downloaded PDF page, CSV field, door operation or kitchen configuration.

## Verification and artifacts

- `tests/architecture/construction-audit.test.ts`: 200 passing tests, registry-driven construction, hole-mouth, inventory, packing, and targeted regression tests. Uses all six applied golden fixtures without rewriting them.
- Existing manufacturing, shared-board, drawer, hinge, golden and export suites remain in `npm run check`.
- **No golden fixture re-recorded.** No baseline ratchet raised.
- Browser reproduction: `node scripts/check-construction-audit.cjs`; `AUDIT_SHAPE=under-stairs node scripts/check-construction-audit.cjs`. Default server is `http://127.0.0.1:5174`; override using `MOBILE_TEST_URL`.
- Screenshots in `artifacts/construction-audit/`: regular and under-stairs, Make and Assembly Studio, desktop and 375 px.
- Final check result recorded after completion below.

Final validation: `npm run check` exited 0 on 3 November. Boundaries, architecture, editor typecheck, **1,916 tests (all passing)**, production typecheck/build, and SEO audit passed. Build emitted its existing chunk-size/configuration warnings. The new audit file contributes **200 tests**. `git diff --check` passed. No goldens or baseline hashes changed.
