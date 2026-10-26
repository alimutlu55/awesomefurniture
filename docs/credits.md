# Credits

People buy credits (in-app coins) in packs and spend them on paid features: AI images and technical
drawings today, anything else later. The balance is the first item of the editor menu (⋮), with a coin;
clicking it opens the wallet with the packs, what credits buy, and the activity list.

## What a person sees

- **Menu item**: *Credits* with the coin and the balance, first in the ⋮ menu (the toolbar has no room on
  phones). The balance counts up when credits arrive; at zero it says "Get credits".
- **Wallet**: the balance and what it buys ("≈ 30 AI images or 12 drawing sets"), four packs (Popular is
  preselected and marked), what each feature costs, and the Activity tab (every purchase, spend and refund).
- **AI image**: the price sits on Generate image and Try again (4 ◉). With too few credits the wallet opens
  on the packs and says what is missing. After the purchase, the success screen offers "Create your AI image".
- **Technical drawings**: the menu item shows *Free*, *10 ◉* or *Open* (a pass is running). The first set is
  free and opens a 24-hour pass for that design; later designs ask on a small card before taking credits.
- **Buying**: Continue → (a guest) sign up or sign in → the provider's hosted checkout → back in the editor,
  "Confirming your payment" → the celebration with the credits added. Every ending says whether money was taken:
  not completed ("you were not charged"), paid but not credited (a reference to quote, see Operations), refunded or
  disputed. A reload while confirming picks the confirmation up again; after two minutes it carries on quietly for
  half an hour; the balance in the menu counts up when they land (no message).

Credits belong to an account: buying them and using them (the free first drawing set too) needs one
(`CREDITS_REQUIRE_ACCOUNT`, on by default; the server refuses with `ACCOUNT_REQUIRED`). A guest still sees the
balance, the packs and the prices; the sign-in sheet opens when they would buy or use credits, and the wallet
reopens on the chosen pack afterwards. Designing never needs an account. Signing in offers to add the guest's work
and credits to the account (the person decides), so paid credits survive a cleared browser and reach every device: see
[accounts.md](accounts.md).

## Pricing

Prices live in one place, `src/domain/credits/credit-catalog.ts`; the image cost is worked out from Google's token
prices in `image-generation-cost.ts`; VAT, payment costs, tax, the exchange rate and running costs are in
`unit-economics.ts`. The database stores what each use cost, so a price change never rewrites history.

Packs are sold **in zloty** (Stripe pays out in zloty, so there is no 2% currency conversion, and Polish customers
can pay with BLIK and Przelewy24 once they are turned on in the Stripe dashboard). Assumptions, each one constant:

| Cost | Figure | Why |
| --- | --- | --- |
| VAT | 23%, included in the price | Polish VAT on a digital service |
| Stripe | 3% + 1 zł per payment | card processing |
| Chargebacks | 0.5% of payments lose the payment and a ~65 zł fee | cautious for a new shop (Stripe flags 0.75%) |
| Refunds | 2% of payments; the processing fee is lost, the credits come back unused | |
| Exchange rate | 3.90 zł per dollar | Google bills Gemini in dollars (about 3.80 in September 2026) |
| Income tax and health | 19% flat tax + 4.9% health contribution on profit | sole trader on *podatek liniowy* |
| Running costs | $50 a month: Supabase Pro $25, Cloudflare Workers $5, email sending ~$20 | once free tiers run out |

**AI image: 10 credits. Technical drawings: 20 credits**, the first set free. Credit amounts stay round.

| Pack | Price (VAT incl.) | VAT | Stripe | Refunds and chargebacks | Left | Credits | AI images | Per image |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Starter | 19.99 zł | 3.74 | 1.60 | 0.46 | 14.20 zł | 80 | 8 | 2.50 zł |
| Popular | 39.99 zł | 7.48 | 2.20 | 0.57 | 29.74 zł | 150 + 30 bonus | 18 | 2.22 zł (−11%) |
| Pro | 99.99 zł | 18.70 | 4.00 | 0.90 | 76.39 zł | 400 + 80 bonus | 48 | 2.08 zł (−17%) |
| Studio | 199.99 zł | 37.40 | 7.00 | 1.46 | 154.13 zł | 800 + 200 bonus | 100 | 2.00 zł (−20%) |

What one image costs at Google with `gemini-nano-banana-2.1` (standard paid tier, October 2026): input $1.50, text
and thinking output $7.50, image output $30.00 per million tokens. Images are made with `thinking_level: medium`,
about a fifth cheaper than high; raise it in `generate-design-image.ts` if photographs suffer. Token counts were
measured on the current prompts: an ordinary wardrobe sends 3 views and 1 swatch (1,120 tokens each) and about
1,700 tokens of instructions and design summary.

| Part | Typical | Worst |
| --- | --- | --- |
| Input images: 3 views + swatches (1 typical, 8 at most) × 1,120 | 4,480 tokens | 12,320 tokens |
| Input text: instructions, view labels, design summary | 1,700 tokens | 5,000 tokens |
| Input cost (× $1.50 / M) | $0.0093 | $0.0260 |
| Thinking at `medium` (unpublished; estimate) | 1,000 tokens | 6,000 tokens |
| Answer text | 200 tokens | 500 tokens |
| Text output cost (× $7.50 / M) | $0.0090 | $0.0488 |
| The 2K image: 1,680 tokens (× $30 / M) | $0.0504 | $0.0504 |
| One image | $0.0687 | $0.1252 |
| Failed attempts Google bills but we refund | +10% | +20% |
| **Cost per delivered image** | **$0.076 = 0.29 zł** | **$0.150 = 0.59 zł** |

What a pack earns when every credit goes on AI images (the least profitable use):

| Pack | Left | Gemini (usual / worst) | Profit before tax | After 19% + 4.9% | Share of the price kept |
| --- | --- | --- | --- | --- | --- |
| Starter | 14.20 zł | 2.36 / 4.68 | 11.84 / 9.51 | **9.01 / 7.24 zł** | 45% / 36% |
| Popular | 29.74 zł | 5.30 / 10.54 | 24.44 / 19.20 | **18.60 / 14.61 zł** | 47% / 37% |
| Pro | 76.39 zł | 14.14 / 28.11 | 62.25 / 48.28 | **47.37 / 36.74 zł** | 47% / 37% |
| Studio | 154.13 zł | 29.46 / 58.56 | 124.67 / 95.57 | **94.87 / 72.73 zł** | 47% / 36% |

Per image that is 81–83% of what is left usually and 62–67% at worst. `tests/architecture/credits.test.ts` fails if
any pack keeps less than 65% usually or 40% at worst (`MINIMUM_MARGIN`), so a bigger bonus, a price cut or a dearer
model shows up in CI. Income tax is left out of that test: it scales with profit, so it never changes which price is
profitable. Credits spent on drawings, or never spent, add to all of the above.

**Technical drawings** cost nothing per use (they are made in the browser): 4.00 to 5.00 zł to the person, 3.08 to
3.55 zł left after VAT and payment costs. A use opens a 24-hour pass for that design, so fixing something and opening
the drawings again is never charged twice.

**Running costs and ZUS.** About 8 Popular packs a month pay the $50 of hosting and email (`breakEvenPacks`). ZUS
social contributions are owed by the sole trader whatever the app sells (reduced in the first years), so they are not
charged to each pack; count them against the business as a whole.

**Measure the real cost.** Each captured image keeps Google's token counts in `credit_spends.metadata`. The
thinking figure is the least certain one; compare it with real usage after launch and update
`IMAGE_REQUEST_TOKENS` if it differs:

```sql
select count(*), avg((metadata->>'total_tokens')::int) from credit_spends
where feature = 'ai-image' and status = 'captured' and created_at > now() - interval '7 days';
```

Prices include VAT. If Stripe Tax is turned on later, set the prices' tax behaviour to *inclusive*; otherwise
Stripe adds VAT on top and the person pays 23% more than the pack shows. VAT-exempt (Polish small-business exemption,
see the accountant)? Then the VAT column is profit, until cross-border EU consumer sales pass €10,000 a year. On
*ryczałt* or the tax scale instead of the flat tax, change `INCOME_TAX`. Customers paying from abroad see zloty and
their card converts it.

## How it stays correct

- **One ledger.** `credit_ledger` is append-only (a trigger refuses updates and deletes). Every balance
  change is one ledger row, written in the same transaction as the account row, under that row's lock.
  `credits_audit()` lists any account whose balance differs from its ledger; it must always be empty.
- **Idempotent everywhere.** A spend takes a key (one per attempt), an order credits once, a provider event
  is recorded once (`payment_events`). A retried request, a replayed webhook or two tabs at once never
  charge or credit twice. `supabase/tests/credits_ledger.sql` covers this, and 20 parallel spends against
  one balance were run on Postgres: exactly the affordable ones went through.
- **Reserve, then settle.** An AI image reserves its credits before Gemini is called. The image arriving
  captures them; any failure, timeout or cancellation gives them back. If a Worker dies in between, the
  15-minute schedule (`triggers.crons` in `wrangler.jsonc`) releases the reservation.
- **Credits only from the provider.** Returning to the success page credits nothing. The order is credited
  from a signed webhook, from asking the provider directly when the person returns before the webhook
  does, or from the schedule, which asks about checkouts still pending after ten minutes (up to 50 a run, two days
  back), so a lost webhook or a wrong signing secret never leaves a payment uncredited. The paid amount and currency must equal the order's (made from the catalog on the server).
  Otherwise the order is `rejected`.
- **Refunds and chargebacks** take credits back in proportion to the share of the charge refunded (the charge's
  own amounts, so tax and the customer's currency do not skew it). A chargeback, or an inquiry, takes them all until
  the dispute is won or the inquiry closes. The balance can go below zero when the credits were already spent;
  spending then waits until it is positive.
- **Server only.** The ledger functions are granted to `service_role` alone. People can read their own
  account, ledger, spends and orders through RLS, and change nothing.
- **Not ours, not retried.** Events for another integration on the same Stripe account (a reference that is not an
  order id) are recorded and skipped, instead of failing and being redelivered for days.
- **Fail closed.** Without a ledger configured, images answer 503 rather than running free. The Worker
  never runs test mode, whatever its variables say.

## Code

| Concern | Place |
| --- | --- |
| Features, packs, prices; margin guard | `src/domain/credits/credit-catalog.ts`, `unit-economics.ts` |
| Buying, spending, webhooks, confirmation | `src/application/credits/credit-service.ts`; contracts in `credit-ports.ts`, `credit-wallet.ts` |
| Ledger tables and functions | `supabase/migrations/20261025120000_credits.sql`; checks in `supabase/tests/credits_ledger.sql` |
| Store: Supabase / in memory (tests, local) | `src/infrastructure/credits/supabase-credit-store.ts`, `memory-credit-store.ts` |
| Payment providers | `src/infrastructure/credits/stripe-provider.ts`, `test-payment-provider.ts` |
| HTTP: `/api/credits/*`, `/api/payments/:provider/webhook` | `src/infrastructure/credits/credit-http.ts`, routed by `src/app/api-router.ts` |
| AI image charge | `src/infrastructure/credits/image-charge.ts`, used by `gemini/design-image-handler.ts` |
| Wallet UI, gate for paid features | `src/presentation/credits/` |
| Token, checkout return | `src/app/credit-platform.ts`; accounts in [accounts.md](accounts.md) |

### Adding a paid feature

1. One entry in `CREDIT_FEATURES`: key, label, description, unit, icon, cost, free uses, pass hours,
   settlement and provider cost. The wallet lists it, and the margin test checks it.
2. If its result can fail (`settlement: 'result'`), charge it on its server endpoint with
   `featureCharge(runtime, key)`: `begin` before the work, `commit` or `refund` after. If it is final when
   used (`'immediate'`), call `credits.charge(key)` in the browser before it opens (as the drawings do), and
   `credits.badge(menuItem, key)` for the price tag.

### Adding a payment provider

Implement `PaymentProvider` (`credit-ports.ts`): `checkout` (create a hosted checkout for an order, return
its URL and reference), `lookup` (what happened to an order, for late webhooks) and `webhook` (verify the
signature, return one `PaymentUpdate`). Register it in `credit-environment.ts` under its secrets. The route
`/api/payments/<id>/webhook` and everything after it (dedupe, crediting, refunds) is shared.

Stripe Checkout already offers cards, Apple Pay, Google Pay, Link and the local methods you turn on in the
Stripe dashboard. Stripe is not open to businesses registered in some countries (Turkey among them). There,
a merchant of record such as [Paddle](https://www.paddle.com) or [Lemon Squeezy](https://www.lemonsqueezy.com)
also files VAT and sales tax for you, and [iyzico](https://www.iyzico.com) covers Turkish cards. Each is one
more `PaymentProvider`.

## Going live

1. Apply the migration to development, run `supabase/tests/credits_ledger.sql` there, then apply it to production.
2. Worker secrets for each environment (`--env dev` for development):
   ```sh
   npx wrangler secret put SUPABASE_SECRET_KEY
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   Use a Supabase **secret** key (`sb_secret_…`) and Stripe **test-mode** keys on development.
3. Stripe dashboard → Developers → Webhooks: endpoint `https://<host>/api/payments/stripe/webhook`, API
   version `2026-09-30.endive` (the SDK's), events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`.
   Its signing secret is `STRIPE_WEBHOOK_SECRET`.
4. Supabase Auth: accounts must work first, see [accounts.md](accounts.md#setting-it-up) (SMTP, email
   templates with the code, Google, redirect URLs).
5. Stripe turns **Managed Payments** (Stripe as the seller, which needs a tax code on each product) on by default
   for new accounts. This app turns it off for its checkouts, which is how the prices were worked out: you are
   the seller. To use it instead, set `STRIPE_MANAGED_PAYMENTS=true`, add a `tax_code` to the product in
   `stripe-provider.ts` and recheck `docs/credits.md` pricing (its fees differ).
6. Optional: Stripe Tax, and Stripe Radar rules against card testing.

### Operations

Alert on these log events (JSON lines from the Worker):

| Event | Meaning | What to do |
| --- | --- | --- |
| `credits_paid_not_credited` | Money was taken but no credits were added: the amount or currency differed (`mismatch`, the order is `rejected`) or the account is gone (`unknown`). The person sees the order id as their reference. | Refund in Stripe, or credit by hand (below). |
| `credits_lookup_failed`, `credits_reconcile_failed` | Stripe did not answer a lookup. | Nothing if it passes; the next poll or run asks again. |
| `credits_released_stale_failed`, `credits_reconciled_failed` | A scheduled step failed as a whole (usually the database). | Check Supabase. |
| `credit_capture_failed`, `credit_release_failed` | An image reservation was not settled; the schedule releases it. | Nothing if it passes. |

Support grants or corrections: `select credits_grant('<user id>', 20, 'ticket-123', 'Support: failed image');`
(once per key; negative to take credits). A refund made in the Stripe dashboard reaches the ledger by
webhook on its own.

## Local development

Without `SUPABASE_SECRET_KEY`, `npm run dev` runs credits in **test mode**: the ledger is in memory (gone on
restart), and Continue opens a pretend checkout on this server, whose Pay goes through the same signed
webhook path as Stripe. `CREDITS_REQUIRE_ACCOUNT=false` lets guests buy and use credits. `AI_MOCK_DELAY_MS` with
`LOG_LEVEL=debug` makes mock images quick. With the secret and Stripe test keys in `.env.local`, the dev
server uses the real ledger instead (`stripe listen --forward-to localhost:5173/api/payments/stripe/webhook`
for webhooks).

## Known limits

- Technical drawings are made in the browser, so their charge is a gate in the editor, not enforced on the
  server. The pass's design id comes from the browser too.
- The first free drawing set is per account. Someone could create several accounts for several free sets; each
  needs a confirmed email.
- Free uses and passes are not in the Activity list: it lists balance changes only.
- One currency (USD). Prices in other currencies are more `CREDIT_PACKS` entries with a currency each.
- The debug image mock can be turned on by any browser (`X-Debug-Mode`, older than credits). With a live
  ledger it refunds itself, so nobody is charged for it, but it should be limited to development.
