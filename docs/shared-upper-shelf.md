# Shared upper shelf planning

The planner now chooses a cabinet-wide upper storage boundary before searching for daily fittings. Previously each bay could consume its height independently, and finishing could lower a seasonal compartment to close the gap beneath it. This produced staggered upper shelves.

The boundary is measured from the internal floor. It accounts for the floor/plinth offset, user reach, rail-to-shelf clearance, required long-garment clearance, measured box height and removal clearance. For the reported 230 cm cabinet and 180 cm reach, the shared boundary is 176.2 cm internally (186 cm from the floor). Daily rails remain subject to their reach checks. The upper seasonal band is occasional storage.

Search, recovery and finishing share that boundary. They cannot place a fitting across it or lower a seasonal column independently. Remaining space below it is distributed among physically valid fittings and adjustable storage. Where an existing fitting does not supply a top board beneath the upper band, a horizontal support board is added. Manual fixed layouts are preserved. If the required shared band cannot fit, the planner reports that limitation rather than shortening required garment clearance.

## Inventory presentation

Recommendation cards now explain the saved growth allowance, label the aggregate figure as overall coverage, and show the least-covered category beside it. Their quantity table explicitly identifies reachable capacity and the planning target. Growth uses ceiling rounding: with 15%, 24 shirts becomes 28 and 30 folded items becomes 35.

This is not proof of globally optimal packing. The reported mixed inventory at 180 cm reach still returns a partial recommendation: 14/28 short hanging, 7/7 long hanging, 20/14 trousers, 36/35 folded, 10/10 shoes and 36/35 small items. Aggregate coverage is 90.4%; short hanging coverage is only 50%. Excess capacity is clipped in the coverage calculation and does not count toward another category. Alternative bay-width experiments did not resolve the shortage; the bounded search still cannot establish infeasibility or global optimality.

## Verification

- `npm run check`: 189 tests pass, editor typecheck, boundaries, production typecheck and build pass.
- `npm run review:planner`: 33 cases, 47 recommendations, zero audit errors. 35 review findings remain as quality/partial-fit observations, not a claim that every inventory is fully served.
- Regression checks cover preserved upper alignment, measured box constraints, low reach with a lift, non-crossing fittings and physical support beneath the shared band.
- Applied the mixed inventory at 180 cm reach in the isolated editor verification page. No browser errors. Visual evidence: `verification/aligned-upper-shelves.jpg`.
