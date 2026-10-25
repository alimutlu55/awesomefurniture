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
- **Buying**: Continue → (once) the email step → the provider's hosted checkout → back in the editor,
  "Confirming your payment" → the celebration with the credits added.

Buying needs a verified email (`CREDITS_REQUIRE_ACCOUNT`, on by default). Visitors start as anonymous
Supabase identities; adding an email keeps the same identity (designs and credits included), so paid
credits survive a cleared browser and reach the person's other devices. An email that already has an
account signs in to it instead; the open design is copied into that account.

## Pricing

Prices live in one place, `src/domain/credits/credit-catalog.ts`. The database stores what each use cost,
so a price change never rewrites history.

| Pack | Price | Credits | Per credit | AI images | Drawing sets |
| --- | --- | --- | --- | --- | --- |
| Starter | $4.99 | 50 | $0.100 | 12 | 5 |
| Popular | $9.99 | 100 + 20 bonus | $0.083 (−17%) | 30 | 12 |
| Pro | $24.99 | 250 + 100 bonus | $0.071 (−28%) | 87 | 35 |
| Studio | $49.99 | 500 + 300 bonus | $0.063 (−37%) | 200 | 80 |

**AI image: 4 credits** ($0.25 to $0.40 to the person, depending on the pack).

What one image costs us with Nano Banana 2.1 (`gemini-nano-banana-2.1`, standard paid tier, October 2026:
input $1.50 per million tokens, text and thinking output $7.50, image output $30.00):

| Part | Typical | Worst |
| --- | --- | --- |
| Input: 3 reference views × 1,120 tokens, decor swatches (2 typical, 8 at most) × 1,120, ~3,000 to 5,000 text | 8,600 tokens = $0.013 | 17,300 tokens = $0.026 |
| Thinking at `thinking_level: high` (not published; measure it, see below) | 3,000 tokens = $0.023 | 8,000 tokens = $0.060 |
| Text answer | 200 tokens = $0.002 | 400 tokens = $0.003 |
| The 2K image: 1,680 tokens | $0.050 | $0.050 |
| **One image** | **$0.087** | **$0.139** |
| Plus 10% for failed attempts Google bills but we refund | **$0.096** | **$0.153** |

Card fees in the worst common case (an international card on Stripe): 2.9% + 1.5% + $0.30 per payment
(`PAYMENT_FEE` in `unit-economics.ts`). What an image earns after fees and Gemini:

| Pack | Person pays | We keep after fees | Margin (typical) | Margin (worst) |
| --- | --- | --- | --- | --- |
| Starter | $0.40 | $0.358 | 73% | 57% |
| Popular | $0.33 | $0.308 | 69% | 50% |
| Pro | $0.29 | $0.270 | 64% | 43% |
| Studio | $0.25 | $0.237 | 60% | 36% |

`tests/architecture/credits.test.ts` fails if any feature drops below 35% at the cheapest credit with the
worst provider cost (`MINIMUM_WORST_CASE_MARGIN`). So a price cut, a bigger bonus or a dearer model shows up
in CI. Credits that are bought and never used add to the margin; nothing above counts on them.

**Technical drawings: 10 credits**, with the first set free. The drawings are made in the browser and cost
us nothing per use, so this is a value price: $0.63 to $1.00 for a full A3 set with cutting and hardware
lists, against tens of dollars for drafting by hand. A use opens a 24-hour pass for that design, so fixing
something and opening the drawings again is never charged twice.

**Measure the real cost.** Each captured image keeps Google's token counts in `credit_spends.metadata`.
Check the thinking estimate against them after launch:

```sql
select count(*), avg((metadata->>'total_tokens')::int) from credit_spends
where feature = 'ai-image' and status = 'captured' and created_at > now() - interval '7 days';
```

Prices are in US dollars, without tax. With Stripe Tax on, tax is added at checkout and the amount check
compares the pre-tax subtotal.

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
  from a signed webhook, or from asking the provider directly when the person returns before the webhook
  does. The paid amount and currency must equal the order's (made from the catalog on the server).
  Otherwise the order is `rejected`.
- **Refunds and chargebacks** take credits back in proportion to the amount refunded. A chargeback takes
  them all until the dispute is won. The balance can go below zero when the credits were already spent;
  spending then waits until it is positive.
- **Server only.** The ledger functions are granted to `service_role` alone. People can read their own
  account, ledger, spends and orders through RLS, and change nothing.
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
| Token, email step, checkout return | `src/app/credit-platform.ts` |

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
4. Supabase Auth: set up custom SMTP (the built-in sender allows only a few emails an hour). Put
   `{{ .Token }}` in the *Change email address* and *Magic link* templates so the email carries the
   code the wallet asks for.
5. Optional: Stripe Tax, and Stripe Radar rules against card testing.

Support grants or corrections: `select credits_grant('<user id>', 20, 'ticket-123', 'Support: failed image');`
(once per key; negative to take credits). A refund made in the Stripe dashboard reaches the ledger by
webhook on its own.

## Local development

Without `SUPABASE_SECRET_KEY`, `npm run dev` runs credits in **test mode**: the ledger is in memory (gone on
restart), and Continue opens a pretend checkout on this server, whose Pay goes through the same signed
webhook path as Stripe. `CREDITS_REQUIRE_ACCOUNT=false` skips the email step. `AI_MOCK_DELAY_MS` with
`LOG_LEVEL=debug` makes mock images quick. With the secret and Stripe test keys in `.env.local`, the dev
server uses the real ledger instead (`stripe listen --forward-to localhost:5173/api/payments/stripe/webhook`
for webhooks).

## Known limits

- Technical drawings are made in the browser, so their charge is a gate in the editor, not enforced on the
  server. The pass's design id comes from the browser too.
- The first free drawing set is per identity; someone clearing their browser gets a new guest identity and
  another free set. A CAPTCHA on guest sign-in (Supabase supports Cloudflare Turnstile) would close that.
- Free uses and passes are not in the Activity list: it lists balance changes only.
- One currency (USD). Prices in other currencies are more `CREDIT_PACKS` entries with a currency each.
- The email step's sending and verifying of codes was not run against a real inbox during development.
- The debug image mock can be turned on by any browser (`X-Debug-Mode`, older than credits). With a live
  ledger it refunds itself, so nobody is charged for it, but it should be limited to development.
