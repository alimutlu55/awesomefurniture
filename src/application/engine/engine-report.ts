import type { CreditCurrency } from '../../domain/credits/credit-catalog';
import type { DrawingInput } from '../../domain/drawings/room-pieces';
import { inspect } from '../../domain/engine/inspect';
import type { Severity } from '../../domain/engine/rules/engine-rules';

/**
 * The engine's answer as plain JSON, for agents and other programs (the agent API's `inspect`, a server, an export):
 * whether the design can be built, every finding, the passport's numbers and the price under each builder profile.
 * Versioned like the design spec's report; fields are only ever added.
 */
export interface EngineReport {
  readonly reportVersion: 1;
  readonly ready: boolean;
  readonly counts: Readonly<Record<Severity, number>>;
  readonly findings: readonly { readonly severity: Severity; readonly area: string; readonly title: string; readonly why: string;
    readonly measured?: string; readonly limit?: string; readonly fixes: readonly string[] }[];
  readonly passport: { readonly parts: number; readonly boards: number; readonly sheets: number; readonly yieldPercent: number; readonly edgeBandingM: number;
    readonly holes: number; readonly hardwareItems: number; readonly emptyKg: number; readonly contentsKg: number; readonly assemblyHours: number };
  readonly prices: readonly { readonly profile: string; readonly label: string; readonly currency: CreditCurrency; readonly total: number;
    readonly ownHours: number; readonly groups: Readonly<Record<string, number>> }[];
  readonly pricesAsOf: string;
}

const hours = (minutes: number) => Math.round(minutes / 6) / 10;

export function engineReport(input: DrawingInput, currency: CreditCurrency = 'eur'): EngineReport {
  const { evaluation, passport: p, quotes } = inspect(input, { currency });
  return {
    reportVersion: 1, ready: evaluation.ready, counts: evaluation.counts,
    findings: evaluation.findings.map(f => ({ severity: f.severity, area: f.pack, title: f.title, why: f.why,
      ...(f.measured ? { measured: f.measured.value + ' ' + f.measured.unit } : {}), ...(f.limit ? { limit: f.limit.value + ' ' + f.limit.unit } : {}),
      fixes: f.fixes.filter(x => x.action.kind !== 'select-piece').map(x => x.label) })),
    passport: { parts: p.parts, boards: p.boards, sheets: p.sheets, yieldPercent: Math.round(p.yield * 100), edgeBandingM: p.edgeBandingM, holes: p.holes,
      hardwareItems: p.hardwareCount, emptyKg: Math.round(p.kg), contentsKg: Math.round(p.contentsKg), assemblyHours: hours(p.assemblyMinutes) },
    prices: quotes.map(q => ({ profile: q.profile.key, label: q.profile.label, currency: q.currency, total: Math.round(q.total), ownHours: hours(q.ownMinutes),
      groups: Object.fromEntries(Object.entries(q.groups).map(([k, v]) => [k, Math.round(v)])) })),
    pricesAsOf: quotes[0]?.asOf ?? '',
  };
}
