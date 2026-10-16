# Focused size and shape editing

Size and Shape panels hide the Studio/Wardrobe switch, Storage, global Menu, action bar, zoom/help,
internal Add item prompts and transient feedback. The model, editing handles and relevant panel remain.
Item/divider sizing and room sizing use the same rule. Direct item resize gestures also hide chrome
until the gesture ends. Closing a panel, swiping it away or pressing Escape restores normal controls.
Shape keeps its drawer open while orbiting the model to reach rear handles.
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
shape/room handles and item resize grips now remain within the editing session. Canvas releases keep
Shape open so orbiting reaches the rear edge. Escape, Close and sheet dismissal still end panel editing;
canvas taps dismiss other settings as before. Returning to Regular also keeps
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


## Rear handles and horizontal shaping

Shape exposes filled front-edge dots and outlined rear-edge dots. Both edges have independent heights;
upward front height/angle/rise edits raise the matching rear where there is clearance, stopping at the physical ceiling. Downward front edits lower a higher matching rear edge too; a rear already below the edited front stays at its existing height. The existing panel list also offers rear heights
for side corners and interior break points. Adding a break point creates its paired rear handle.
Joins share x positions through the cabinet depth so the boards stay connected.

All dots accept horizontal dragging and arrow keys. Interior joins slide along the top. Outer corners
change width, anchored at the opposite side; interior joins stay in world space. The cabinet centre
moves along its local width axis, including when rotated. The camera reframes after a width commit
to keep the next corner reachable, preserving its angle and remaining still during the drag.
Width, position and both profiles commit in one undo step. Live previews skip refitting fittings; commit refits once, and cancel restores the full scene.
Width limits, minimum module widths, panel lengths/slopes, room ceilings, walls and neighbouring
wardrobes constrain the same candidate before either preview or commit.

Shaping preserves the viewing angle when opened. The model body or background can be dragged to
orbit while Shape stays open. Expanded touch targets resolve the nearest dot when front/rear targets
overlap in projection. Rear drags intersect the rear plane; rulers follow the active edge.

Validation adds real touch/mouse rear drags, rear undo/redo and cancellation, horizontal outer-corner
width changes and interior-join movement, orbiting in Shape and editing from that angle. Unit cases
cover both edges at 0°, 37° and 90°, fixed opposite corners, stationary-pointer drift, cancellation,
serialization, rear ceiling clearance, neighbours and width limits. Physical iPhone Safari remains unverified.

Screenshots: [rear shaping on phone](rear-shaping-mobile.jpg), [desktop](rear-shaping-desktop.png).
