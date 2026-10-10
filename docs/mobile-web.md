# Mobile browser audit and changes

## Focused action redesign (in progress)

The mobile focus controller in `mobile-focus.ts` owns one shared two-pane
layout: the model stays on the left, and the current action's controls occupy
the right. A Back button moves through the action stack and restores the
original camera, editing selection, focus and inspector scroll on final exit.
Controls move with placeholders and return to their original desktop parents.

Settings now launches individual resize, section, reach, finish, door,
placement and rotation actions. Adding filters out fittings that cannot fit
and frames the selected space. Item and divider action menus, storage, help,
and Auto design are connected to the same controller. Successful additions
return to the previous context. Action controls still call the existing domain
commands and history, including live size sliders.

`scripts/check-mobile-focus.cjs` currently checks Settings action navigation,
adding, item action navigation, storage/menu/Auto design, left/right geometry,
hidden global controls, and desktop restoration across six viewport sizes.
The redesign is not complete: verify mutations for every item/divider action,
keyboard behavior in the right pane, exact return state, wardrobe management
as separate actions, and migrate the existing bottom-sheet regression suite
to the new workflow before shipping or marking the goal achieved.

The editor uses a Three.js canvas and container-scoped controls. The mobile work
covers the editor itself, including embedded editors; the page entry also follows
`visualViewport` height to keep controls above an on-screen keyboard.

## Findings addressed

| Area | Finding | Change |
| --- | --- | --- |
| Settings and inspectors | Conflicting rules shrank the canvas and overlaid settings inconsistently | A bounded, scrolling bottom panel reserves matching canvas space; short landscape screens put panels beside the canvas |
| Navigation | Settings was an unlabeled arrow; section selection used tiny, nonsemantic elements | Visible Settings label and numbered section buttons with selected state; sections scroll horizontally when needed |
| Touch controls | Many actions and finish swatches were 22–36 px; mobile zoom controls were hidden | Main touch targets are at least 44 px; zoom buttons remain visible |
| Menus | Menus inherited a narrow toolbar anchor and extended off-screen | Mobile menus are reparented to the editor and use its available width |
| Inputs | Small numeric text can trigger automatic zoom while editing | Mobile numeric inputs and selects use 16 px text; panels remain independently scrollable |
| Gestures | Cabinet/divider hit tests intercepted a second finger before pinch registration | One finger drags the selected wardrobe body; dragging empty background orbits; a second finger rolls back pending movement and joins pinch before hit testing |
| Precise editing | Move/swap controls were hidden and depended on mouse/keyboard interaction | Mobile exposes move/swap and destination controls, divider actions, and an accessible cancel-move button |
| Feedback | Rejected edits silently did nothing | Phone-sized editors show short status messages, while Undo remains a toolbar action |
| Auto design | Nested scrolling and constrained columns made ideas cumbersome to access | A single scrolling wizard body, two-column inventory inputs and one-column idea cards |
| Browser chrome | Safari keyboard opening pans the visible area as well as shrinking it; the document remained taller than the editor | A fixed, non-scrolling page shell; visual viewport resize and scroll offsets; an expanded editing panel while the keyboard is open |

Desktop styling remains in `editor.css`; mobile overrides and section-button
styling live in `mobile.css`. Responsive DOM changes restore desktop menu and
inspector placement when the editor grows beyond 900 px.

## Verification

Run the ordinary checks with `npm run check`. The current migration hash test has
a pre-existing mismatch for the planner: the actual normalized source hash is
`055669275d09c17d3699cc9fc55430d9e5b0ab2801061e39e6258f83048bbe01`, while
its stored baseline starts `dda603d8`. The planner, original CSS, and original
markup are unchanged from the starting commit. This audit does not rewrite that
unrelated baseline.

Browser flow checks are separate from the Node regression suite:

```sh
npx playwright install chromium
npm run dev -- --host 127.0.0.1
# In another terminal:
npm run check:mobile
```

`MOBILE_TEST_URL` can select another local preview server. `CHROME_PATH` can select
an existing Chrome executable instead of downloading Playwright Chromium.

The browser script covers 320×568, 390×844, 430×932, 768×1024, 844×390 and
1440×900. It checks control bounds, canvas/panel separation, dimension and section
changes, menus, adding fittings, item settings, movement cancellation, zoom,
real multi-touch pinch/release, Auto design generation/application, Undo/Redo,
viewport shrinking and rotation, and browser errors. Pointer regressions also
exercise touch-vs-mouse behavior and second-finger priority directly.

These are Chromium touch-emulation checks, not physical-device certification.
Real iOS Safari and Android Chrome checks should still cover keyboard opening,
notches/home indicators, native numeric entry, and GPU performance.

Verified on 2026-10-10: all six browser cases passed; production build, editor
type checking and architecture boundaries passed. The Node suite passed 212 of
213 tests, with only the pre-existing planner hash mismatch described above.

## Safari keyboard follow-up

The reported size-input screenshot exposed a gap in the first verification:
shrinking the entire browser viewport did not reproduce Safari's unchanged
layout viewport plus a smaller, vertically shifted visual viewport. The page now
tracks both `visualViewport.height` and `offsetTop` on resize and scroll, without
counteracting intentional page magnification. While editing with the keyboard
open, the inspector uses the visible space and scrolls its focused input within
the panel rather than scrolling the document. Wardrobe size fields request a
numeric keyboard explicitly.

`page-viewport.test.cjs` covers viewport pan, scale tolerance, keyboard dismissal,
intentional zoom, internal input scrolling and listener cleanup. The mobile
browser checks also simulate a shrinking and panning visual viewport while the
layout viewport stays unchanged, check that the focused field stays visible,
and verify restoration when the keyboard closes. Actual iOS keyboard behavior
still requires checking the updated app on a physical device.

## Wardrobe movement follow-up

Restored one-finger body dragging at wardrobe selection level. The initial
mobile change reserved the body for camera orbit, making movement depend on
the small ground handles. Touch movement now registers its pointer, so adding
a second finger cancels the placement preview and starts pinch without saving
an accidental move. Pointer release and interrupted capture clear the gesture.
Item selection and the ground movement/rotation handles remain available.
Browser checks now exercise a real touch wardrobe drag, its single Undo entry,
and switching from a placement preview to pinch without recording a move.
On mobile, tapping the editing canvas also dismisses Settings and updates its
toggle state, so returning to the design does not require the Settings button.
Dismissal uses primary pointer release rather than a compatibility click, and
includes editing-area overlays. Browser checks cover release without a click
and the label layer as well as an actual canvas tap.

Width, height and depth also have native touch sliders beside the numeric
editing flow. The wardrobe and its measurements update live while sliding
through the existing fit and collision rules. Releasing saves one undo step;
cancelled touch gestures restore the starting design. Numeric edits,
wardrobe selection and Undo keep both controls synchronized.

Keyboard detection retains the visible height before field focus, including
browsers that shrink both innerHeight and visualViewport.height. Focus also
scrolls the chosen field inside its panel before the keyboard resize arrives.

Mobile Settings, add-item, item/divider inspectors, storage details, menu and
Auto design panels have centered grab handles. Dragging a handle down moves
the panel with the finger; a 64 px pull closes it, and shorter pulls return it
to its original position. The handle is also an accessible close button. Panel
contents retain native scrolling and sliders retain their own touch gestures.
