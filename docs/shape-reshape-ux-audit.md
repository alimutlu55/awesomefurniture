# Reshape flow audit

What a user does when reshaping a wardrobe, what was checked, and where the flow
is not yet clear or easy.

## How it was checked

- **Automated (Node):** `tests/architecture/shape-reshape-flow.test.ts`, 16 tests,
  one per step below. Every step's result, its rejection message and its undo
  behaviour are asserted.
- **In the browser (desktop, 1280×800):** chip selection, Adjust panels open and
  close, handle drag (one drag = one undo step), keyboard arrows on a handle,
  typing an invalid height, orbiting the background, undo after a drag.
- **Not yet checked in a browser:** the phone sheet end to end after the latest
  changes, and touch dragging on a real device.

## Step by step

| # | Step | Works | Friction |
|---|---|---|---|
| 1 | Pick a shape chip | Yes. Valid skeleton, height follows the tallest point, one undo step | Chips show no explanation of what each shape is until hovered |
| 2 | Open **Adjust panels** | Yes. Handles appear on the model | The section is collapsed by default, so the handles are hidden until someone finds it |
| 3 | Type a height in the list | Valid values apply on change (Enter or blur) | **Invalid values are reverted with no message on desktop** (see F1). Nothing updates while typing |
| 4 | Drag a break point | Smooth, clamped at limits, one undo step, live X/Y rulers, alignment guides | **A refused move stops the point with no reason** (F2). Heights and positions snap with no warning |
| 5 | Drag a side height | Works, vertical only | Sides cannot move sideways. Nothing says so, so a sideways drag looks broken |
| 6 | Arrow keys on a focused handle | Work in 1 cm steps, 0.5 cm with Shift | Only reachable with Tab. No live rulers while using the keys (F6) |
| 7 | Split a panel (**+** on the model or list) | Works. The marker only exists on panels at least 10 cm wide | No marker on narrow panels and no reason given (F5). The **+** is 20 px, below touch size (F7) |
| 8 | Add a step | Works from the list. Needs room for the riser | **No model control at all** for steps. Narrow panels fail silently (F5) |
| 9 | Change a step's rise | Works. Flat panels after the step stay flat | The rise field moves the next corner too, which is not visible |
| 10 | Change a panel angle | Works, pivots on the left end | The angle is in degrees with no preview of which end moves (F8) |
| 11 | Remove a break point or step | Works, one undo step | Removing a step deletes a corner pair, which the list does not explain (F9) |
| 12 | Resize the width or height | Works, the skeleton scales and keeps its slopes | Sloped tops scale silently. The user may not expect the slope to change (F10) |
| 13 | Fittings after a reshape | Fitted or cut to the angle. Nothing lost unless it cannot fit | The message "removed" shows only on phones (F1) |
| 14 | Orbit the view | Keeps the session open | Good |
| 15 | Click empty canvas | Ends the session and hides the handles | Expected, but the user must reopen Adjust panels to continue (F3) |
| 16 | Undo / redo | One step per drag, per list commit, per template | Good |

## Findings, most important first

**F1. Desktop gives no feedback for rejected or refitted changes (critical).**
`toast()` in `src/presentation/editor/editor-shell.js` returns straight away
when the editor is wider than 900 px. Every message the shape commands send
(rejections, "removed to fit", "Undo restores them") is dropped on desktop. A
typed height of 10 cm snaps back to 140 cm with no message. Fix: show these
messages on desktop too, next to the Shape section or on the canvas.

**F2. A refused drag gives no reason (critical).**
The point stops at the limit (steepness, neighbour order, minimum width) and
nothing says why. Fix: while dragging, show the reason beside the point, for
example "Slope would be steeper than 70°" or "Keep 5 cm between break points".

**F3. The shape session is easy to lose (high).**
Clicking empty canvas ends the session, and **Adjust panels** is collapsed
by default. After one click on the background the handles are gone and the user
must find the section again. Fix: keep the session open while a wardrobe stays
selected, and open **Adjust panels** by default when a shape is chosen.

**F4. Error wording is technical (high).**
"Break points must run from left to right", "Top panels must be at least 5 cm
wide", "A step must leave room for its riser board" describe the rule, not the
action. Fix: say what to do, e.g. "A break point can't pass its neighbour. Move it
or remove it first."

**F5. Missing controls with no explanation (high).**
The **+** split marker is hidden on panels under 10 cm, and steps have no model
control. A user who looks for either sees nothing and gets no reason. Fix: show
the marker with a dimmed state and a hint, and add a step control on the model.

**F6. Keyboard reshaping is hidden (medium).**
Handles are reachable with Tab, but nothing says so. Arrow keys move the point
without the live X/Y rulers that a drag shows. Fix: show the rulers while a
handle has focus, and mention the keys in the handle's tooltip.

**F7. Touch targets are small (medium).**
The **+** marker is 20 px and the dots are 26 px hit areas. Phone guidelines ask
for about 44 px. Fix: a larger invisible hit area around each marker, with the
small visible dot kept.

**F8. Panel angle has no direction cue (medium).**
Changing the angle pivots on the left end, but nothing shows which end moves.
Fix: draw a short pivot marker on the left end while the angle field has focus.

**F9. Steps are not explained (medium).**
A step is two corners. Removing it removes both, but the list shows two rows and
a remove button on each. Fix: show one row per step, with one remove button.

**F10. Width changes can change slopes silently (low).**
Widening a sloped wardrobe scales its top, which changes its angle. This is
consistent, but nothing says so. Fix: show the new angle in the message after a
resize.

**F11. Resting measurements are busy (low).**
Three or more measurement lines can sit close together on small screens. They
are hidden during a drag now; at rest they still crowd the view on a phone.
Fix: show only the selected panel's measurement at rest on phones.

**F12. Chips do not say what they are (low).**
The shape chips show pictures and names, but no description. The Add item
previews have no description either. Fix: one line under the chip row for the
hovered or selected shape.

## What works well

- Every drag is one undo step, and orbiting the view does not end the session.
- Limits clamp smoothly instead of freezing, and the drag resumes when the
  pointer comes back.
- Live X/Y rulers, alignment guides and measurement lines make the geometry
  readable while editing.
- Every rule rejects with a reason in the test suite, even though the reason is
  not always shown on screen (F1).

## Suggested order

1. F1 and F2: make feedback visible on desktop and during drags.
2. F3 and F5: keep the session, and show missing controls instead of hiding them.
3. F4 and F9: clearer wording and one row per step.
4. F6 to F12: keyboard, touch, angle cues and resting clutter.
