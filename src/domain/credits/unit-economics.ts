import { CREDIT_PACKS, packCredits, type CreditFeature, type CreditPack } from './credit-catalog';

/** Pack prices include Polish VAT at 23%: of every $9.99 paid, $9.99 / 1.23 is ours and the rest goes to the tax office.
 * docs/credits.md explains the figures; change them here when the seller's VAT status or the provider contract changes. */
export const VAT_RATE = 0.23;

/** Stripe's fee on the amount charged (VAT included): 3% plus a fixed $0.30 per payment. */
export const PAYMENT_FEE = { percent: 0.03, fixed: 0.30 } as const;

/** Share of what an image earns that every pack keeps, at the usual and at the worst provider cost. */
export const MINIMUM_MARGIN = { typical: 0.65, worst: 0.40 } as const;

/** Dollars a pack leaves after VAT and the payment fee. */
export function packRevenue(pack: CreditPack, fee = PAYMENT_FEE, vat = VAT_RATE) {
  const gross = pack.price / 100;
  return gross / (1 + vat) - gross * fee.percent - fee.fixed;
}

/** Dollars one credit leaves after VAT and the payment fee, for one pack. */
export const netPerCredit = (pack: CreditPack) => packRevenue(pack) / packCredits(pack);

/** What one use earns per pack: the price paid (VAT included), what is left after VAT and fees, the profit, and the share kept. */
export function featureMargins(feature: CreditFeature) {
  return CREDIT_PACKS.map(pack => {
    const revenue = netPerCredit(pack) * feature.cost, price = pack.price / 100 / packCredits(pack) * feature.cost;
    const { typical, worst } = feature.providerCost;
    return {
      pack: pack.id, price, revenue,
      profit: { typical: revenue - typical, worst: revenue - worst },
      typical: (revenue - typical) / revenue,
      worst: (revenue - worst) / revenue,
    };
  });
}
