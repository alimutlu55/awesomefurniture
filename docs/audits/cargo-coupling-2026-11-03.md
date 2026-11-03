# Cargo physical coupling correction — 3 November 2026

The previous cargo fix was incomplete. The user's open-cargo screenshot exposed a disconnected door. Prior tests checked smoothness and parenting but did not check physical attachment.

## Reproduced defects

- At cabinet depth 580 mm, the door used the generic drawer travel of 390 mm; the 500 mm cargo runner capped the frame at 350 mm. The resulting separation was 40 mm. Cargo front motion now uses its mechanism's runner length: both move 350 mm.
- Make reconstructed frame/baskets using decorative-front dimensions. Its starting height was 81.5 mm instead of the actual internal opening's 98 mm, shifting the frame's connector centres by 16.5 mm relative to the brackets. Cargo fittings now carry the construction geometry; Make and runner rendering consume it directly.
- The old receiver was shown as a solid block narrower than the tongue. It is now an open receiver with a 46 × 22 mm aperture for a 44 × 20 mm tongue. Tall and base tongues share those dimensions.
- Basket installation was shown after cabinet insertion. The revised generic assembly prepares the frame and loads baskets outside, with every basket rear edge at least 50 mm ahead of the cabinet opening. The loaded mechanism then moves axially from 600 mm ahead of its installed position to home, before door attachment and the travel test.
- Basket undersides now rest on front/rear tier bridges connected to the chassis. These are construction geometry, rather than floating renderer decorations.

## Verification

`cargo-coupling.test.ts` has four regressions covering base and tall cargo. It asserts the literal 350 mm travel, matching tongue/receiver centre heights, basket access outside the cabinet, front/rear tier support datums, and actual Three.js receiver/frame contact closed and open. Existing rendered tests verify continuous placement and exact insertion offsets of [0,0,600], [0,0,300] and [0,0,0] mm.

The old basket-after-door expectation was replaced because the intended assembly procedure changed. It was not relaxed to permit geometric error. No golden fixture was re-recorded.

This is a generic mechanism illustration, not a manufacturer-specific installation certification. The earlier report's claim that the reference sequence alone established realism was insufficient. The geometry and connection invariants are now checked directly.

Browser captures: `artifacts/cargo-assembly/`, including `drawer-test-mid-1280.png` and `drawer-test-mid-375.png` for the reported open-door state. Run `node scripts/check-cargo-assembly.mjs`; `CARGO_SHOT=drawer-test-mid` selects that checkpoint.

Final validation: `npm run check` exited 0 with 2,247 tests passing. Desktop/375 px browser checks passed, and an additional desktop side view of the open mechanism was inspected. `git diff --check` passed. No goldens were re-recorded. The result is local on `fix/cargo-physical-coupling`.
