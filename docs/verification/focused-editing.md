# Focused size and shape editing

Size and Shape panels hide the Studio/Wardrobe switch, Storage, global Menu, action bar, zoom/help,
internal Add item prompts and transient feedback. The model, editing handles and relevant panel remain.
Item/divider sizing and room sizing use the same rule. Direct item resize gestures also hide chrome
until the gesture ends. Closing a panel, swiping it away or pressing Escape restores normal controls.
On phones compact Shape uses 75% model / 25% drawer. Resize uses 50% model / 50% drawer.
Safe-area padding is included in that drawer height. Dragging/tapping the existing handle still expands
it for more controls, and the keyboard retains its existing accessible layout.
The CSS derives this from existing visible-panel and gesture state, without another UI mode to reset.

Escape now closes settings before navigating out of the current selection. On phones the existing
sheet drag affordance still expands, lowers and dismisses the editing panel.

Automatic startup/save failures no longer emit notifications. Browser draft recovery and periodic /
online retries continue; explicit Share failures still return feedback when Share is requested.

Validation: `npm run check`; `npm run check:mobile` at portrait, landscape and desktop widths;
`node scripts/check-startup.cjs` with mocked unavailable auth confirms silent offline startup.
The background saving regression verifies draft retention and successful retry without a notification.
Physical iPhone Safari was not available for testing.

Screenshots: [desktop](focused-editing-desktop.jpg), [Shape 75:25](shape-mobile.png), [Resize 50:50](resize-mobile.png).

## Shape-editing regression

A real mobile pointer release bubbled from the on-model shape handle to the view's generic settings
dismissal handler. The geometry committed, but the Shape sheet closed immediately. Releases on
shape/room handles and item resize grips now remain within the editing session. Generic canvas taps,
Escape, Close and sheet dismissal retain their existing exit behavior. Returning to Regular also keeps
the active shape session instead of disabling its handles.

Changing the drawer height also exposed a stale camera aspect ratio: the renderer resized its buffer
but read an old canvas rectangle for its projection. The resize callback now supplies the known new
width/height to the camera so handles remain on-screen.

`npm run check:mobile` now includes `scripts/check-shape-editing.cjs`. This reproduced the original
first-release failure before the fix. It exercises a populated wardrobe with real CDP touch input and
mouse drags at 375×812, touch at 844×390, and mouse at 1440×900. It verifies Resize → Shape uses
the distinct 50/50 and 75/25 ratios, then checks two consecutive drags,
cancellation, undo/redo, tapping a break-point marker, repeated numeric edits, Sloped → Regular →
Custom, another drag and explicit exit. Geometry changes and panel/focus visibility are asserted after
each operation. Separate unit regressions cover projection dimensions and the Regular shape session.
