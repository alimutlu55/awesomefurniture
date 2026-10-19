# Multiple-design implementation verification

Actual application captures, not the earlier design prototypes:

- [Mobile editor](mobile-editor.png)
- [Mobile collection](mobile-library.png)
- [Mobile management](mobile-manage.png)
- [Mobile naming](mobile-rename.png)
- [Desktop editor](desktop-editor.png)
- [Desktop collection](desktop-library.png)

## Passed

Rechecked after integrating the latest `develop` mobile camera changes before deployment.

- `npm run check`: architecture boundaries/rules, editor and application type checks,
  **850 tests**, and production build.
- `MOBILE_TEST_URL=http://127.0.0.1:4175 npm run check:designs`: full design workflow
  against the production build, with external cloud calls blocked in an isolated
  browser context. Includes names, validation, duplicates, delete/cancel, reload,
  browser history, independent Undo, local quota failure, cross-tab deletion,
  previews, and top-control overlap with Storage warning badges at 320–430 px.
  Main layout checks also cover 768 and 1440 px.
- Existing contextual toolbar regression passed in isolated runs at 320 × 568,
  390 × 844 and 768 × 1024. The tablet debug run confirmed the focused input,
  keyboard attribute, visible model and correct panel background.
- Existing adaptive toolbar layout checks passed from 320 to 1440 px.
- `git diff --check`.

The cloud repository pagination test uses the real Supabase query builder against
controlled responses for 205 owner-scoped records. No live user cloud records are
used for these checks. This implementation requires no database migration.

## Broader suite limitations

`check:mobile` is not fully green. Its aggregate run intermittently failed the
768 px item-resize keyboard-background assertion; that case passed when run alone.
The remaining standalone checks exposed older fixture assumptions:

- `check-mobile-sheets.cjs` opens the empty initial design, then waits for a selected
  wardrobe's Resize action without first creating a wardrobe.
- `check-desktop-regression.cjs` similarly expects the initial canvas to select a
  wardrobe. The pre-change `startingScene()` and `projectToScene()` already start
  an empty project without wardrobes.

Those unrelated scripts were not rewritten or weakened. The dedicated new feature
check explicitly exercises the real empty-start behavior and seeds furniture when
needed. Physical-device software-keyboard, safe-area and touch behavior remain to
be checked on actual iOS/Android hardware.
