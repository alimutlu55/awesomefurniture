import { CREDIT_PACKS, packCredits, type CreditFeature, type CreditPack } from './credit-catalog';

/** Pack prices are in zloty and include Polish VAT at 23%: of every 39.99 zł paid, 39.99 / 1.23 is ours.
 * docs/credits.md explains every figure; change them here when the seller's tax status or a contract changes. */
export const VAT_RATE = 0.23;

/** Google bills Gemini in US dollars: zloty per dollar (NBP, autumn 2026; about 3.80 in September). */
export const USD_PLN = 3.90;

/** Stripe's fee on the amount charged (VAT included): 3% plus a fixed 1 zł per payment. Paid out in zloty, so no
 * currency conversion. */
export const PAYMENT_FEE = { percent: 0.03, fixed: 1.00 } as const;

/** Payments that come back, as a share of all payments. A chargeback costs Stripe's dispute fee (about 65 zł) and the
 * whole payment; a refund costs the processing fee Stripe keeps (the credits come back unused, so no Gemini cost). */
export const PAYMENT_LOSSES = { disputeRate: 0.005, disputeFee: 65, refundRate: 0.02 } as const;

/** Polish sole trader on the flat 19% income tax, with the 4.9% health contribution on income. Used for the report
 * only: tax scales with profit, so it never changes which price is profitable. */
export const INCOME_TAX = { incomeTax: 0.19, healthContribution: 0.049 } as const;

/** Share of what an image earns that every pack keeps, at the usual and at the worst provider cost. */
export const MINIMUM_MARGIN = { typical: 0.65, worst: 0.40 } as const;

/** Where a pack's price goes before anything is spent, in zloty. */
export function packBreakdown(pack: CreditPack) {
  const gross = pack.price / 100;
  const vat = gross - gross / (1 + VAT_RATE);
  const stripe = gross * PAYMENT_FEE.percent + PAYMENT_FEE.fixed;
  const losses = PAYMENT_LOSSES.disputeRate * (PAYMENT_LOSSES.disputeFee + gross) + PAYMENT_LOSSES.refundRate * stripe;
  return { gross, vat, stripe, losses, left: gross - vat - stripe - losses };
}

/** Zloty a pack leaves after VAT, Stripe and the expected refunds and chargebacks. */
export const packRevenue = (pack: CreditPack) => packBreakdown(pack).left;

/** Zloty one credit leaves, for one pack. */
export const netPerCredit = (pack: CreditPack) => packRevenue(pack) / packCredits(pack);

/** What one use costs at the provider, in zloty. */
export const providerCostPln = (feature: CreditFeature) => ({ typical: feature.providerCost.typical * USD_PLN, worst: feature.providerCost.worst * USD_PLN });

/** What a profit leaves after income tax and the health contribution. */
export const afterIncomeTax = (profit: number) => profit * (1 - INCOME_TAX.incomeTax - INCOME_TAX.healthContribution);

/** What one use earns per pack, in zloty: the price paid (VAT included), what is left after VAT and payment costs, the
 * profit, and the share kept. */
export function featureMargins(feature: CreditFeature) {
  const { typical, worst } = providerCostPln(feature);
  return CREDIT_PACKS.map(pack => {
    const revenue = netPerCredit(pack) * feature.cost, price = pack.price / 100 / packCredits(pack) * feature.cost;
    return {
      pack: pack.id, price, revenue,
      profit: { typical: revenue - typical, worst: revenue - worst },
      typical: (revenue - typical) / revenue,
      worst: (revenue - worst) / revenue,
    };
  });
}

/** Running costs that do not grow per sale, US dollars a month: Supabase Pro ($25) and Cloudflare Workers Paid ($5)
 * once the free tiers run out, and a sending service for sign-in emails (about $20). ZUS is the person's, not the app's. */
export const MONTHLY_COSTS = { hosting: 30, email: 20 } as const;

/** Packs a month, all credits spent on AI images at the usual cost, that pay the running costs. */
export function breakEvenPacks(pack: CreditPack, image: CreditFeature) {
  const profit = packRevenue(pack) - Math.floor(packCredits(pack) / image.cost) * providerCostPln(image).typical;
  return Math.ceil((MONTHLY_COSTS.hosting + MONTHLY_COSTS.email) * USD_PLN / profit);
}
