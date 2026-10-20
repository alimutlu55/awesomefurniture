# Restored simple drawing viewer

The user rejected the controls-heavy viewer. This restores the previous scrolling document layout:
zoom out/in, direct Save as PDF, and close. No purpose tabs, panels, sheet browser, fit controls,
interactive label editor, or export preview. Automatic drawing readability improvements remain.

Run Vite on port 5177 and `npm run check:drawings` to reproduce:

- Desktop and 375 px screenshots, all cabinet and room sheets accessible by scrolling.
- Exactly four buttons; no inputs, selectors, navigation or inspectors.
- At least 75% of mobile height available for drawings; initial sheet width fills the viewport.
- Zoom, native scrolling, two-finger pinch, reopening at the plan, Escape and close.
- `drawings.pdf`: complete set downloaded directly through the viewer.

Domain annotation/clearance/pagination tests remain in `professional-drawings.test.ts`.
The `professional-drawings/` screenshots document the superseded interface.
