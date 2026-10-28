# Studio language support

The studio and design library offer English, German, French, Spanish, Polish, Portuguese and Turkish.
Choose a language only in the studio’s three-dot menu under Preferences. There is no floating
selector or selector in the design library. The chosen language still applies throughout the app.
A choice takes effect without remounting the editor,
changing a design, losing Undo history or navigating away. It is remembered in this browser.

A public site's studio links carry `?lang=xx`; the studio consumes that preference while preserving
all other URL parameters and the design fragment. Precedence: explicit link, saved choice, first
supported browser language, English. Storage errors and unavailable translation chunks fall back
to English so they cannot block opening a design. Translation files load only as needed.

## Ownership and safety

`src/presentation/i18n/` owns the language state, dictionaries, exact-message interpolation,
native language selector and the legacy DOM presentation adapter. Each mounted studio or library
owns and disposes its observer and subscription. The adapter translates only visible text and
accessibility copy. It never changes IDs, command keys, input values, event listeners or project data.
It updates newly inserted panels and messages, including during a language change.

Mark user-authored text `translate="no"` or `data-user-content`; this includes library design names,
wardrobe names, breadcrumbs and account-adoption lists. Inputs and textareas are never rewritten.
For mixed user-data attributes, `data-i18n-preserve-attributes` lists attributes the adapter must
leave alone. Do not derive program logic from localized text; use canonical data attributes.

The JSON files have identical English-source keys. `{0}` keeps an interpolated value verbatim;
`{0:n}` matches a number only, and `{0:ui}` translates another known UI label. Translations are
plain text, never HTML. Unit tests check key parity, nonempty values and placeholder preservation.
New messages must be added to every locale; unknown messages safely retain their English source.

## Current scope

The dictionaries cover the primary studio controls, furniture and room settings, storage selection,
welcome flow, design library, account forms, credit controls and drawing/image viewer controls.
Manufacturer product names and user names keep their original spelling. Technical drawing sheets,
manufacturing validation content, specialist diagnostic explanations and exported PDFs currently
retain English. Do not claim localized manufacturing documentation. Language and measurement units
are independent preferences. Native review of translated terminology is welcome before expanding
into further markets.

## Verification

Run `npm run check`, and the existing mobile regression suite with Vite on port 4173.
In a browser, run `/tests/fixtures/language-ui.html` to verify dynamic text and attributes, language
switching, user-content protection, root isolation and disposal. Inspect actual studio and library
views at 375px and desktop widths. Switch all seven languages, compare design reports before and
after, refresh to check persistence and follow a translated marketing-page link into the studio.
