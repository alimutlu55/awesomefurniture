# Adaptive toolbar action layout

The empty Wardrobe view previously reserved four default-action columns even
though only Wardrobe was visible. Undo and Redo remained at the far right.
The regression reproduced the gap before the fix.

At widths up to 900 px, the toolbar now creates one equal grid column per
visible action, including history. Hidden controls reserve no space. The pill
sizes to its actions and shrinks to fit the viewport. Group wrappers preserve
their DOM semantics; the separator sits inside Undo's column.

`scripts/check-toolbar-layout.cjs` checks 320, 375, 430, 768, 844 and 1440 px:
empty Wardrobe, Studio, adding a wardrobe, undo and redo. Mobile checks also
insert and hide extra actions to verify that layout adapts without a count
update. The contextual toolbar regression now compares every action's width,
including history, and the new regression runs with `npm run check:mobile`.

Screenshots: [375 px](toolbar-layout/mobile.png),
[1440 px](toolbar-layout/desktop.png).

Physical iPhone Safari was not tested; browser verification uses Chromium.
