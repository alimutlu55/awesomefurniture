# Shared measurement badges

The reusable control lives in `src/presentation/components/measurement-badge.ts`, with its own CSS. It has no model, editor, Three.js or storage dependencies. `decorateMeasurementBadge` supplies accessible slider semantics; `bindMeasurementBadges` owns pointer capture, frame batching, keyboard input, inline numeric entry, cancellation and feedback. An editor lifetime owns its listeners and cleanup.

Each feature supplies a stable ID/selector, orientation, accessible limits, `read`, `begin`, `preview(delta)`, `finish(cancel)` and `refresh` callbacks. Binding to the stable label layer keeps a gesture alive while the viewport rebuilds individual badges. Feature adapters retain responsibility for validation and undo; feedback receives actual accepted values. No change produces no checkpoint or spring animation.

All editable measurement badges use the same interaction:

- Drag horizontally for width/depth, vertically for heights and vertical gaps, with a 5 px threshold and 0.35 cm per pixel; Shift gives finer pointer control.
- Tap, Enter or Space to type an exact value. Enter/blur commits; Escape cancels.
- A tap retains its pressed label until the native click and synchronously focuses the field inside that click. Pointerdown does not cancel WebKit's native click. Pointer release alone never focuses the number field; drags do not open it.
- Arrow keys change 1 cm; Shift changes 5 cm; Home/End request the accessible limits. Domain constraints determine the accepted result.
- A drag produces one undo checkpoint. Escape, pointer cancellation, a second contact, window blur or editor disposal restores its initial design.
- Optional ticking haptics and the 2% badge spring use the existing reduced-motion-aware feedback adapter.

`dimension-scrubbers.ts` connects cabinet dimensions and the shared scene measurement adapter. `scene-measurements.ts` maps item sizes/gaps, shelf and divider sizes/gaps, reach height, Studio wall length, opening widths/end clearances and ceiling heights to domain commands. `measurement-preview.ts` owns reversible previews and a single checkpoint. Item/board depth is inherited from the cabinet, so its depth badge changes the owning cabinet depth; its contents and studio constraints are checked by the cabinet command. Cabinet numeric entry now retains tenths of a centimetre rather than rounding them away.

Derived free-space dimensions, hover readouts and temporary shape/movement feedback remain informational because they have no independent value to edit. Shape points retain their two-axis manipulation. Fixed accessible-profile reach remains informational.

Verification:

- Component tests cover batching, accessibility, dragging, keyboard limits, inline entry, cancellation, disposal, and feedback only after accepted changes.
- Application tests cover single-step undo/redo, reversible previews, fitting limits, shelf geometry, empty Studio wall editing, openings, ceilings, and reach limits.
- `scripts/check-measurement-badges.cjs` exercises real cabinet/item/gap/Studio interactions at 375 px and 1440 px. It is included in `npm run check:mobile`.
- `scripts/check-label-entry.cjs` repeats six width/depth/height taps at each width, types values gradually and verifies one-step undo. The phone case shrinks the viewport to simulate the keyboard and checks that the same inline field stays visible and focused. Inline editing keeps the canvas visible under the keyboard; hiding it would blur and immediately dismiss the field. Numeric editor text is 16 px to avoid Safari's automatic small-input zoom.
- Existing tactile regressions exercise touch at 375×812 and 844×390, desktop mouse at 1440×900, shelf gestures, and prepared Studio constraints.

`LABEL_BROWSER=webkit node scripts/check-label-entry.cjs` runs the same repeated-entry check with WebKit. The test records the input's focus call inside a trusted click; simulated viewport resizing alone cannot prove that iOS presented a keyboard.

Native verification on 2026-10-16 used Safari in the iPhone 17 Pro / iOS 26.2 simulator, with the simulator hardware keyboard disconnected: tapping Height opened the software numeric keyboard, typing 200 and pressing Done updated the wardrobe to H 200 cm, and reopening after reload showed the keyboard again. [Native keyboard screenshot](ios-dimension-keyboard.png).

Physical iPhone Safari and hardware vibration still require device verification.

Screenshots: [phone fitting](shared-measurement-badges-mobile.png), [desktop fitting](shared-measurement-badges-desktop.png), [phone Studio](shared-measurement-badges-studio.png).
