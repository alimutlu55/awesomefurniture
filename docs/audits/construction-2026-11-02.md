# Construction audit — 2 November 2026

## Physical rules (written before regression fixes)

1. Width closes: outer width = two sides + bay clear widths + intervening partitions. The 18 mm boards occupy their allocated intervals exactly.
2. Height closes: floor = plinth + 18 mm base; interior ends at the actual underside of the roof. Wall units have zero plinth. Rail centre is 60 mm below its fitting top.
3. Depth closes: rear lip + 6 mm back + usable depth + front setback = outer depth. Partition setback is 5 mm; fitting setback is 14 mm plus inset-door intrusion.
4. Boards have positive dimensions; rectangular cut dimensions equal their physical extents. Shaped boards retain the actual polygon, including door tops.
5. Doors respect the specified reveal and roof profile; drawer boxes have 12.5 mm runner clearance on each side and remain behind their fronts.
6. Shared boards occur once. Parts cover every board once; only geometrically and operationally identical boards share a part number. Blind drilling depth is part of identity.
7. Cut placement preserves the actual cut dimensions, including fractions of a millimetre; every board occurs once, inside trim, with the specified kerf and grain constraints.
8. A hole must start on material, remain in material for its depth, and avoid other drilling except intentional intersecting connector bores. Hardware must connect to real supporting material.
9. Back rebates/grooves require positive engagement in the surrounding material; a zero-volume touching rectangle is not machining.
10. Presentation and exports must consume the same construction dimensions and operations.

These are required properties, not a claim that every property has been verified. Results and unresolved scope are recorded below as the audit proceeds.

## Result

**Construction audit with fixes; not a complete fabrication certification.** The continuation resolves the back engagement, complete cutting inventory, modeled hardware schedule, sub-tenth machining identity, runner-depth and banded-packing defects identified in the first pass. The remaining limits below are still material: compound depth shapes, full solid/bore verification, manufacturer templates and complete presentation parity.

Work started on `fix/construction-precision-audit` on 2 November. The repository subsequently incorporated that work and other assembly/cargo changes; final continuation uses `fix/construction-audit-followup` on 3 November.

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

## Continuation defects and corrections

| Defect | Expected versus previous actual | Source and correction |
|---|---|---|
| Back had no engagement | 1000 × 2200 × 600 cabinet: previous top groove 964 × 0 × 6 mm; side grooves 0 × 2102 × 6 mm; base intersection 964 × 18 × 0 mm. All have zero volume. | `back-construction.ts` establishes an explicit nominal 6 mm engagement. Back is now 976 × 2096 × 6 mm, x=12..988 and y=92..2188 mm. Top machining is 976 × 6 × 6 mm. Nailed rebate occupies z=0..6; captured groove z=6..12 with a 6 mm rear lip. These are application construction choices, not a manufacturer specification. |
| Base did not support back engagement | Base stock previously began at z=6 mm (589 mm depth); required stock begins at z=0 (595 mm depth), with the overlapping back volume machined away | `cabinetBoards` applies explicit machining polygons. Physical overlap tests subtract only the recorded removed volume, not an arbitrary exemption for back boards. Grooved partitions reach the rear to capture split-back seams. |
| Technical list omitted drawer boxes and merged rounded sizes | A drawer needs five box boards in addition to its front; technical cutting rows contained none of these. Fractional sizes such as 241.5 mm became 242 mm | `cutting-list.ts` consumes `makePlacedPiece.parts`, including box boards and machining identities. Row quantities, dimensions and total board count are checked against the construction. |
| Hardware quantities had independent derivations | Modeled connectors/nails were missing from the technical list; sloped hinge test permitted inequality | Modeled hardware now comes from `makePlacedPiece.buy`. Sloped hinges must be exactly equal. Supplementary proprietary kits remain separately specified. |
| Sub-tenth drill coordinates merged | Holes at 100.01 and 100.04 mm need distinct machining, previously both rounded to 100.0 mm | Full-precision flat coordinates and drilling signatures replace the 0.1 mm grid; operation depth, position and back machining participate in part identity. Decimal normalization removes binary noise only. |
| Different grooves merged | Same stock with z=0..6 and z=6..12 mm removed volumes must be different parts | `makeParts` includes localized machining geometry. Handed rebated side panels are now separate parts. |
| Blind edge depth was not checked | A 501 mm blind hole in a 500 mm board must report 1 mm breakout | `bore-material.ts` validates named-board bounds, blind endpoints and front-elevation polygon material. A Ø35 cup inside the bounding rectangle but crossing a slope is rejected. |
| Edge-bore diameter was not checked | Ø8 centred 1 mm from a face leaves −3 mm material; the old check accepted it | Transverse radius bounds now report an edge finding of −3 mm. Duplicate findings from the existing flat-face check are suppressed without suppressing the defect. |
| Connector mouths missed sloped material | Welcome attic example: connector mouth roughly 4.67 mm above the outer upright; split plinth connector centre on its boundary let Ø4 extend 2 mm outside | Joint axes use the actual shared interval. Where a sloped upright lacks a through face, the modeled connection uses an inside Ø6 × 30 mm dowel with 10/22 mm drilling and a lower axis. This is a generic joint choice, not a structural certification. |
| Runner too long behind inner front | 380 mm grooved wardrobe selected 350 mm runner despite inadequate available depth; longest supported fit is 300 mm | `runnerForSpace` receives actual space behind the front minus the rear clearance. Hardware and drawer travel use the resulting box depth. |
| Cut layout ignored selected banding | 500 × 400 mm finished panel, 1 mm on four edges: required blank 498 × 398 mm; layout packed 500 × 400 | Packing and CSV use `cutWithBand`; changing banding invalidates cached packing. |
| Export omitted machining volumes | Model contained 6 mm grooves, CSV contained only hole counts | CSV now appends `Local machining mm`: domain-produced local XYZ outline, extrusion range, drill mouth/axis/sign/diameter/depth and removed polygon volumes. Coordinates use the assembled axes from the board's minimum XYZ corner. This is an interchange record, not a CNC toolpath. |

## Rule-by-rule status

| Rule | Audited evidence | Remaining limit |
|---|---|---|
| Bays and boards close to outside width | 49 registry/golden cases plus existing width/weight/count precision sweeps | Multi-piece sharing keeps its existing suites; no exhaustive real installation survey. |
| Thickness, floor, setbacks, rail drop | 18 mm carcass; floor plinth +18; 5 mm base setback; 60 mm rail drop; explicit 6/12 mm back-face variants | Actual rail screw templates and load rating unspecified. |
| Boards meet, stock sizes reconcile | Rectangular extents, explicit back removed volumes, existing board-overlap tests and exact slope contact | Not a general solid intersection proof for compound shapes, bevels or mitres. |
| Doors/drawers fit | Exact slope polygons, existing reveals/12.5 mm runner-clearance tests, 380 mm depth regression | Not every front style and hardware product; unsupported shallow drawers can lack a box. |
| Back attachment | Literal 976 × 2096 × 6 back and four positive-volume operations; nailed and grooved variants | No allowance for board thickness tolerance, moisture or glue fit; nominal geometry only. |
| Board/part/hardware accounting | Every board once in parts/steps; modeled hardware schedule shared; drawer-box cut rows included | Supplemental kits, some rails/supports, legs and hangers lack complete attachment geometry. |
| Drilling lands on material | 49 cases × 2 backs × 3 systems = 294 combinations; named-board mouth, face-polygon radius, transverse box radius and blind endpoint checks | Not complete swept-cylinder checking through concavities, grooves or angled surfaces; intended cam/pilot intersections not certified. |
| Cut layout | Exact size, thickness, trim, kerf, grain, once-only accounting, edge-band deduction | Strip packing, no optimal nesting; shaped edge banding and machine toolpaths not provided. |
| Presentation equals construction | Complete cutting and modeled hardware schedules; domain flat outlines/bores; CSV operations; ordinary editor carcass consumes construction boards | Compound-depth editor path and some technical drawing derivations remain independent. PDF groove marks remain schematic rectangles, without complete operation instructions. |

## Tests and changed expectations

The audit contains 200 original matrix/regression tests and 309 continuation tests (294 material combinations plus 15 targeted regressions). Six applied golden wardrobe files participate without being rewritten. Initial failure logs and targeted red/green logs document test-first changes. The final full check also runs the repository's newer drawer/cargo tests.

Existing explicit cutting-list expectations were corrected for physical changes: back width 2376 instead of 2364 mm; a 2000 mm wardrobe back is 1976 mm wide; base depth 595 instead of 589 mm; handed rebated sides form separate rows; drawer boxes add rows/pages. PDF page assertions now use the actual table-pagination function. These are not golden re-recordings. The sloped-hinge assertion was strengthened from an inequality to equality. No golden fixture or architecture baseline was re-recorded by this audit.

## Known limits and unverified work

- Compound front-to-back roof profiles (`shape.back`) do not have a complete manufacturable solid/stock representation. A new release regression uses a 100 mm rear/front difference: `validateForManufacture` now reports a critical `compound-roof` finding (allowed difference 0 mm). The editor retains a separate path for these, and Make preview/CSV still exists; the technical manufacturing release is blocked.
- Hole checks are stronger but not a full cylinder-versus-machined-solid solver. No complete collision verification for all bore directions, countersinks, angled entries or cam hardware.
- Hardware dimensions are generic. No manufacturer drilling templates, structural/load analysis, wall anchorage design or physical cut-and-assemble trial was verified.
- Nominal grooves/back panels have no production fit tolerance. A workshop must specify machining allowance and assembly method. Captured backs also need assembly-order review.
- A very shallow or narrow drawer may be omitted by `drawerBoxes`; the model does not yet expose a complete failure-to-build contract for every unsupported fitting.
- Full presentation parity remains unfinished: technical annotation rounding, compound editor geometry, and complete PDF machining instructions. The CSV's new local coordinates are authoritative projections but are not CNC instructions and refer to finished-stock datums, not automatically offset banded blanks.
- Browser checks are smoke and visual checks, not measurements of every label. No exhaustive kitchen/front interaction sweep or rendered PDF-page review was completed in this continuation.

## Verification and artifacts

Reproduction: `npm run check`; `node scripts/check-construction-audit.cjs`; `AUDIT_SHAPE=under-stairs node scripts/check-construction-audit.cjs`. Browser server defaults to `http://127.0.0.1:5174` (`MOBILE_TEST_URL` overrides it). Screenshots cover regular and under-stairs Make and Assembly Studio at 1280 × 900 and 375 × 812 in `artifacts/construction-audit/`.

Browser refresh on 3 November passed regular and under-stairs Make/Assembly at both widths with no page errors or horizontal overflow. Screenshots were visually inspected for the regular desktop assembly, regular mobile Make, and under-stairs mobile assembly. The regular mobile check was corrected to use touch input and a stable selection point; no old screenshot is being presented as a new run.

Final validation on 3 November: `npm run check` exited 0; all **2,238 tests passed**, as did boundaries, architecture, editor/production typechecks, production build and SEO audit. Existing Vite configuration/chunk-size warnings remain. `git diff --check` passed. No golden fixtures were re-recorded. The complete check log is `artifacts/construction-audit/final-check.txt`.
