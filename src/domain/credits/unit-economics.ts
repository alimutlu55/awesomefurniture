import { CREDIT_CURRENCIES, CREDIT_PACKS, packCredits, type CreditCurrency, type CreditFeature, type CreditPack } from './credit-catalog';

/**
 * What a sale costs, per currency. docs/credits.md explains every figure; change them here when the seller's tax status,
 * a contract or the exchange rate changes. The seller is a Polish sole trader paid out in zloty.
 *
 * - vat: the share of the price that is VAT, usually and at worst. Poland: 23%. Other EU: 23% while cross-border EU
 *   consumer sales stay under €10,000 a year, the buyer's country's rate above it (up to 27%, Hungary). Outside the EU:
 *   usually none, but some countries tax digital sales from the first one (UK 20%, Norway 25%).
 * - fixed: Stripe's fixed fee per payment, on top of its 3%.
 * - conversion: Stripe converting the currency into zloty for the payout.
 * - disputeFee: Stripe's fee for a chargeback.
 * - perUsd: units of the currency per US dollar, for the Gemini bill (about 3.80 zł in September 2026; 3.90 assumed).
 */
export const CURRENCY_COSTS = {
  pln: { vat: { typical: 0.23, worst: 0.23 }, fixed: 1.00, conversion: 0, disputeFee: 65, perUsd: 3.90 },
  eur: { vat: { typical: 0.23, worst: 0.27 }, fixed: 0.25, conversion: 0.02, disputeFee: 15, perUsd: 0.92 },
  usd: { vat: { typical: 0, worst: 0.25 }, fixed: 0.30, conversion: 0.02, disputeFee: 15, perUsd: 1 },
} as const satisfies Record<CreditCurrency, unknown>;

/** Stripe's fee on the amount charged (VAT included), on top of the fixed fee. */
export const PAYMENT_PERCENT = 0.03;

/** Payments that come back, as a share of all payments. A chargeback costs Stripe's dispute fee and the whole payment;
 * a refund costs the processing fees Stripe keeps (the credits come back unused, so no Gemini cost). */
export const PAYMENT_LOSSES = { disputeRate: 0.005, refundRate: 0.02 } as const;

/** Polish sole trader on the flat 19% income tax, with the 4.9% health contribution on income. Used for the report
 * only: tax scales with profit, so it never changes which price is profitable. */
export const INCOME_TAX = { incomeTax: 0.19, healthContribution: 0.049 } as const;

/** Share of what an image earns that every pack keeps, in every currency, at the usual and at the worst costs. */
export const MINIMUM_MARGIN = { typical: 0.65, worst: 0.40 } as const;

type Case = 'typical' | 'worst';

/** Where a pack's price goes before anything is spent, in the pack's currency. */
export function packBreakdown(pack: CreditPack, currency: CreditCurrency, vatCase: Case = 'typical') {
  const costs = CURRENCY_COSTS[currency], gross = pack.prices[currency] / 100;
  const vat = gross - gross / (1 + costs.vat[vatCase]);
  const stripe = gross * PAYMENT_PERCENT + costs.fixed;
  const conversion = gross * costs.conversion;
  const losses = PAYMENT_LOSSES.disputeRate * (costs.disputeFee + gross) + PAYMENT_LOSSES.refundRate * (stripe + conversion);
  return { gross, vat, stripe, conversion, losses, left: gross - vat - stripe - conversion - losses };
}

/** What a pack leaves after VAT, Stripe, conversion and the expected refunds and chargebacks, in its currency. */
export const packRevenue = (pack: CreditPack, currency: CreditCurrency, vatCase: Case = 'typical') => packBreakdown(pack, currency, vatCase).left;

/** What one use costs at the provider (billed in dollars), in a currency. */
export const providerCostIn = (feature: CreditFeature, currency: CreditCurrency) => ({
  typical: feature.providerCost.typical * CURRENCY_COSTS[currency].perUsd,
  worst: feature.providerCost.worst * CURRENCY_COSTS[currency].perUsd,
});

/** What a profit leaves after income tax and the health contribution. */
export const afterIncomeTax = (profit: number) => profit * (1 - INCOME_TAX.incomeTax - INCOME_TAX.healthContribution);

/** What one use earns, per currency and pack: the price paid, what is left after VAT and payment costs, the profit, and
 * the share kept. The worst case takes the worst VAT and the worst provider cost together. */
export function featureMargins(feature: CreditFeature) {
  return CREDIT_CURRENCIES.flatMap(currency => {
    const cost = providerCostIn(feature, currency);
    return CREDIT_PACKS.map(pack => {
      const credits = packCredits(pack), price = pack.prices[currency] / 100 / credits * feature.cost;
      const revenue = packRevenue(pack, currency) / credits * feature.cost;
      const worstRevenue = packRevenue(pack, currency, 'worst') / credits * feature.cost;
      return {
        currency, pack: pack.id, price, revenue,
        profit: { typical: revenue - cost.typical, worst: worstRevenue - cost.worst },
        typical: (revenue - cost.typical) / revenue,
        worst: (worstRevenue - cost.worst) / worstRevenue,
      };
    });
  });
}

/** Running costs that do not grow per sale, US dollars a month: Supabase Pro ($25) and Cloudflare Workers Paid ($5)
 * once the free tiers run out, and a sending service for sign-in emails (about $20). ZUS is the person's, not the app's. */
export const MONTHLY_COSTS = { hosting: 30, email: 20 } as const;

/** Packs a month in one currency, all credits spent on AI images at the usual cost, that pay the running costs. */
export function breakEvenPacks(pack: CreditPack, image: CreditFeature, currency: CreditCurrency) {
  const profit = packRevenue(pack, currency) - Math.floor(packCredits(pack) / image.cost) * providerCostIn(image, currency).typical;
  return Math.ceil((MONTHLY_COSTS.hosting + MONTHLY_COSTS.email) * CURRENCY_COSTS[currency].perUsd / profit);
}
