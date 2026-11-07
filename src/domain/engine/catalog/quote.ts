import type { CreditCurrency } from '../../credits/credit-catalog';
import { STOCK } from '../../make/make-cut-layout';
import { getDecor } from '../../materials/decor-catalog';
import type { BuildModel } from '../build-model';
import { type Passport, passport } from '../passport';
import type { BuilderProfile } from './builder-profiles';
import { EDGE_BAND_EUR_M, OFFCUT, PRICES_AS_OF, SERVICES_EUR, WHOLE_SHEET, WORKSHOP, boardEurM2, hardwareEur, perEuro } from './price-list';

/**
 * A quote: what a design costs to have built under one builder profile, line by line, from the build model lowered with
 * that profile. Boards are charged by the stock sheets the cut layout uses (WHOLE_SHEET, OFFCUT in price-list.ts), so a
 * change that saves a sheet saves its price. Prices before VAT, in the visitor's currency, from the price list (an estimate, dated).
 */

export type QuoteGroup = 'boards' | 'edging' | 'hardware' | 'services' | 'labour';
export const QUOTE_GROUPS: readonly QuoteGroup[] = ['boards', 'edging', 'hardware', 'services', 'labour'];

export interface QuoteLine {
  readonly group: QuoteGroup;
  readonly label: string;
  readonly qty: number;
  readonly unit: string;
  /** In the quote's currency. */
  readonly unitPrice: number;
  readonly total: number;
}

export interface Quote {
  readonly profile: BuilderProfile;
  readonly currency: CreditCurrency;
  readonly lines: readonly QuoteLine[];
  readonly groups: Readonly<Record<QuoteGroup, number>>;
  readonly total: number;
  /** The person's own time to build it under this profile (drilling by hand, assembly), minutes; 0 when a workshop builds it. */
  readonly ownMinutes: number;
  readonly asOf: string;
  readonly passport: Passport;
}

const SHEET_M2 = STOCK.length * STOCK.width / 1e6;
const money = (v: number) => Math.round(v * 100) / 100;
/** A decor by its maker's name and code, or its id when the catalogue does not know it. */
const decorName = (id: string) => { try { const d = getDecor(id); return d.name + ' (' + d.manufacturer + ' ' + d.code + ')'; } catch { return id; } };

function boardLines(p: Passport, fx: number): QuoteLine[] {
  const decors = new Map<string, { label: string; m2: number; sheets: number; unitPrice: number }>();
  for (const s of p.layout.sheets) {
    const key = s.decorId + '|' + s.thickness, line = decors.get(key);
    const m2 = (s.used >= WHOLE_SHEET ? 1 : s.used * (1 + OFFCUT)) * SHEET_M2;
    decors.set(key, { label: decorName(s.decorId) + ', ' + s.thickness + ' mm', m2: (line?.m2 ?? 0) + m2, sheets: (line?.sheets ?? 0) + 1,
      unitPrice: money(boardEurM2(s.decorId, s.thickness / 10) * fx) });
  }
  return [...decors.values()].map(l => ({ group: 'boards', label: l.label + ' (' + l.sheets + (l.sheets === 1 ? ' sheet)' : ' sheets)'),
    qty: Math.round(l.m2 * 100) / 100, unit: 'm²', unitPrice: l.unitPrice, total: money(l.m2 * l.unitPrice) }));
}

function hardwareLinesOf(p: Passport, fx: number): QuoteLine[] {
  return p.hardware.map(h => {
    const size = h.size && /^\d+$/.test(h.size) ? Number(h.size) : undefined, unitPrice = money(hardwareEur(h.key, size) * fx);
    return { group: 'hardware', label: h.name + (h.size ? ' ' + h.size : ''), qty: h.qty, unit: h.unit, unitPrice, total: money(h.qty * unitPrice) };
  });
}

/** Metres of saw cut: a rip and a cross-cut for every board. */
const cutMetres = (model: BuildModel) => model.pieces.reduce((s, p) => s + p.make.parts.reduce((t, part) => t + part.boards.length * (part.cut.length + part.cut.width), 0), 0) / 100;
/** Metres of groove routed for backs. */
const grooveMetres = (model: BuildModel) => model.pieces.reduce((s, p) => s + p.make.grooves.reduce((t, g) => t + Math.max(...g.hi.map((v, k) => v - g.lo[k]!)), 0), 0) / 100;

function serviceLines(model: BuildModel, p: Passport, profile: BuilderProfile, fx: number): QuoteLine[] {
  const line = (label: string, qty: number, unit: string, eur: number): QuoteLine =>
    ({ group: 'services', label, qty: Math.round(qty * 10) / 10, unit, unitPrice: money(eur * fx), total: money(qty * eur * fx) });
  const out = [line('Cutting', cutMetres(model), 'm', SERVICES_EUR.cutM), line('Edge banding applied', p.edgeBandingM, 'm', SERVICES_EUR.edgeM)];
  if (profile.services.drill) out.push(line('CNC drilling', p.holes, 'hole', SERVICES_EUR.hole));
  const grooves = grooveMetres(model);
  if (profile.services.groove && grooves > 0) out.push(line('Grooves for backs', grooves, 'm', SERVICES_EUR.grooveM));
  return out;
}

function labourLines(p: Passport, profile: BuilderProfile, fx: number): QuoteLine[] {
  const out: QuoteLine[] = [], hour = money(WORKSHOP.hourEur * fx);
  const hours = (profile.labour.assembly ? p.assemblyMinutes / 60 : 0) + profile.labour.installHoursPerPiece * p.pieces;
  if (hours > 0) out.push({ group: 'labour', label: 'Assembly and fitting', qty: Math.round(hours * 10) / 10, unit: 'h', unitPrice: hour, total: money(hours * hour) });
  return out;
}

/** The quote for `model` built under `profile`. The model should be lowered with the profile's construction. */
export function quote(model: BuildModel, profile: BuilderProfile, currency: CreditCurrency): Quote {
  const p = passport(model), fx = perEuro(currency);
  const lines = [...boardLines(p, fx),
    { group: 'edging' as const, label: 'Edge banding 1 mm', qty: p.edgeBandingM, unit: 'm', unitPrice: money(EDGE_BAND_EUR_M * fx), total: money(p.edgeBandingM * EDGE_BAND_EUR_M * fx) },
    ...hardwareLinesOf(p, fx), ...serviceLines(model, p, profile, fx), ...labourLines(p, profile, fx)];
  if (profile.labour.margin) {
    const base = lines.reduce((s, l) => s + l.total, 0);
    lines.push({ group: 'labour', label: 'Workshop margin', qty: 1, unit: Math.round(WORKSHOP.margin * 100) + '%', unitPrice: money(base * WORKSHOP.margin), total: money(base * WORKSHOP.margin) });
  }
  const groups = { boards: 0, edging: 0, hardware: 0, services: 0, labour: 0 };
  for (const l of lines) groups[l.group] = money(groups[l.group] + l.total);
  const ownMinutes = profile.labour.assembly ? 0 : Math.round(p.assemblyMinutes + p.holes * profile.handDrillMinutes);
  return { profile, currency, lines, groups, total: money(lines.reduce((s, l) => s + l.total, 0)), ownMinutes, asOf: PRICES_AS_OF, passport: p };
}
