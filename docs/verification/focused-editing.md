# Focused size and shape editing

Size and Shape panels hide the Studio/Wardrobe switch, Storage, global Menu, action bar, zoom/help,
internal Add item prompts and transient feedback. The model, editing handles and relevant panel remain.
Item/divider sizing and room sizing use the same rule. Direct item resize gestures also hide chrome
until the gesture ends. Closing a panel, swiping it away or pressing Escape restores normal controls.
On phones the compact Size/Shape drawer uses 25% of the editor height and the model uses 75%.
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

Screenshots: [desktop](focused-editing-desktop.jpg), [375px phone](focused-editing-mobile.jpg).
