# Product analytics

What the owner can see about how FurniDraw is used, and how it is collected. First-party only: no third-party
script, no cookie, nothing that identifies a person or reveals a design.

## Reading it

Everything is in Supabase, in the `analytics` schema (Supabase Studio → SQL editor). Only `service_role` can read it.

| View | Answers |
|---|---|
| `analytics.weekly_realized_designs` | **North Star**: designs a week that reached manufacturable drawings (passing the manufacturing check), a drawings PDF, a Make export, an AI image or a share |
| `analytics.weekly_activation_funnel` | By the week a browser first opened the editor: real edit → realized → signed in → chose a pack → paid. `meaningful_design_pct` |
| `analytics.retention_cohorts` | Day 1, 7 and 30 return, guests and accounts apart |
| `analytics.daily_events` | Every event a day, with how many browsers sent it |
| `analytics.manufacturing_check`, `analytics.blocking_rules` | Drawing sets that pass the manufacturing check, and which rules block the rest |
| `analytics.daily_revenue_funnel` | Checkouts, payments, refunds and disputes by day, currency and pack (from `payment_orders`) |
| `analytics.ai_image_unit_economics` | Images delivered and failed (and why), and Google's token counts (from `credit_spends`) |
| `analytics.drawing_trial_conversion` | Whether the free first drawing set leads to buying credits |
| `analytics.design_portfolio_stats` | What saved designs hold: wardrobes, kitchens, pieces, revisions, shares |

The last four read the existing tables, so they show history from before analytics existed. Workers Logs also carry a
line per settled payment (`payment_settled`), checkout (`checkout_started`) and delivered image (`ai_image_delivered`,
with its tokens and latency).

## The pieces

| Layer | File | Does |
|---|---|---|
| Domain | `src/domain/analytics/analytics-events.ts` | Every event once (`ANALYTICS_EVENTS`), its typed properties (`AnalyticsEventMap`), which realize a design, which only the server sends |
| Domain | `src/domain/analytics/analytics-validation.ts` | Cleans properties (flat, short, no personal keys or values) and checks a browser's event |
| Application | `src/application/analytics/analytics-port.ts` | `AnalyticsPort` (`track`, `setDesign`, `flush`) for the editor, `ServerAnalytics` for the Worker, no-op defaults |
| Infrastructure | `src/infrastructure/analytics/analytics-client.ts` | Browser queue: sends every 5 s, at 20 events, and on `pagehide` (a `keepalive` request) |
| Infrastructure | `src/infrastructure/analytics/analytics-http.ts` | `POST /api/analytics`: at most 25 events and 32 KiB; adds the verified person and the country |
| Infrastructure | `src/infrastructure/analytics/analytics-store.ts` | Writes `public.analytics_events`; the server recorder; pruning |
| App | `src/app/analytics-platform.ts` | When analytics are on, how the visitor arrived, `editor_session_started` |
| Migration | `supabase/migrations/20261108120000_analytics.sql` | The table, `analytics_prune()`, the views |

Presentation modules take an optional `track` (or, for the AI image dialog, `analytics`) in their ports and default
to doing nothing, so tests and embedded editors need no change. `editor-runtime.ts` hands the editor's `track` to
each. Scene commands that add things (pieces, shape presets, room edits) are counted by `withDesignAnalytics`
(`presentation/editor/piece-analytics.ts`), only when the command changed the design.

## Adding an event

1. Add it to `AnalyticsEventMap` with its properties, and to `ANALYTICS_EVENTS` with its pillar (TypeScript fails until
   both agree). Mark it `realizes` if it counts towards the North Star, and add it to
   `analytics.weekly_realized_designs` too (`tests/architecture/analytics.test.ts` checks they match).
2. Call `track('your_event', { ... })` where the action is committed: on release, on a checkpoint, when a panel opens.
   Never in `requestAnimationFrame`, `pointermove` or a live slider's `input`.
3. Properties are counts, sizes, registry keys and outcomes. Never an email, a name (a design's name included), a code,
   a token, a prompt or the design. `cleanProperties` drops personal-looking keys and values anyway, but do not rely on it.

Money is only ever recorded by the Worker (`server: true`): a browser cannot claim a payment.

## Privacy

- Off in automated browsers (`navigator.webdriver`; `?analytics=1` turns it on for checking the pipeline), with Do Not
  Track or Global Privacy Control, and with `?analytics=0`.
- The browser keeps one random id in `localStorage` (`furnidraw.analytics.id`) and one per tab in `sessionStorage`. They
  are not tied to the account in the browser; the Worker adds the account from the request's access token.
- The country comes from Cloudflare; no IP address is stored. A referrer is kept only as a path on this site.
- Events are removed after 13 months by the schedule (`analytics_prune`, run with the credit sweep every 15 minutes).
- Under the ePrivacy rules an identifier in `localStorage` used for audience measurement may need consent in some EU
  countries (France's CNIL exempts strictly first-party measurement like this; others do not). Decide this with
  whoever advises on privacy before launch; `analyticsAllowed` is the one place to add a consent check.

## Operating it

- Needs `SUPABASE_SECRET_KEY` on the Worker (already set for credits). Without it the endpoint accepts and drops batches.
- `ANALYTICS_ENABLED=false` (a Worker variable) turns collection off.
- Analytics requests have their own rate-limit key (`analytics:ip:…`), so they never use up what saving and paying need.
- The dev server keeps events in memory (no table needed).

## Known limits

- Not instrumented yet: shape handle drags and numeric shape edits, `make_finding_inspected`, Assembly Studio sessions,
  decor choices (`finish_decor_selected`), fittings added (`fitting_added`).
- An event sent while the page closes in its first moment may go without the access token: it is then stored as a guest.
- Marketing pages send nothing (search-discovery.md); their visits are in Cloudflare Web Analytics, and the editor records
  the marketing page someone came from (`entry_source`, `referrer_path`).
