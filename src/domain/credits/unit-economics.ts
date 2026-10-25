import { CREDIT_PACKS, packCredits, type CreditFeature, type CreditPack } from './credit-catalog';

/** Card processing in the worst common case: an international card on Stripe (2.9% + 1.5% + $0.30).
 * docs/credits.md explains the figures; change them here when the provider or the contract changes. */
export const PAYMENT_FEE = { percent: 0.044, fixed: 0.30 } as const;

/** Margin every paid feature keeps at the cheapest credit (the largest pack) when the provider costs the most. */
export const MINIMUM_WORST_CASE_MARGIN = 0.35;

/** Dollars a credit brings in after the payment fee, for one pack. */
export function netPerCredit(pack: CreditPack, fee = PAYMENT_FEE) {
  const gross = pack.price / 100;
  return (gross - gross * fee.percent - fee.fixed) / packCredits(pack);
}

/** What one use earns per pack: revenue after fees, provider cost and the share kept. */
export function featureMargins(feature: CreditFeature) {
  return CREDIT_PACKS.map(pack => {
    const revenue = netPerCredit(pack) * feature.cost, price = pack.price / 100 / packCredits(pack) * feature.cost;
    return {
      pack: pack.id, price, revenue,
      typical: (revenue - feature.providerCost.typical) / revenue,
      worst: (revenue - feature.providerCost.worst) / revenue,
    };
  });
}
