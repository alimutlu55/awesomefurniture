import { POSSESSIONS, possession } from './possessions';
import { MAX_REACH, MIN_REACH } from './max-reach';
import type { EditorProfile } from './editor-design';

/** Room to grow, as a percentage over what someone owns today: Auto design plans up to 30% more. */
export const MAX_GROWTH_PERCENT = 30;
/** How far long garments hang below the rail, in centimetres: a short coat to a full-length gown. */
export const LONG_DROP = Object.freeze({ min: 130, max: 185 });

const whole = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : fallback;
const tenth = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10 : fallback;

/** An Auto design profile with every figure brought inside what a person can own and reach: no negative or
 * fractional counts, no more of a thing than its possession allows, jackets among the shirts and jackets, coats among
 * the dresses and coats, a reach a person has. Figures that are not numbers keep the profile's earlier value. */
export function boundedProfile(next: EditorProfile, before: EditorProfile = next): EditorProfile {
  const needs = { ...next.needs };
  for (const p of POSSESSIONS) {
    const key = p.key as keyof typeof needs;
    if (needs[key] !== undefined || p.engine === 'bespoke') needs[key] = whole(needs[key], 0, p.need.max, before.needs[key] ?? 0) as never;
  }
  const short = (needs as Record<string, number>)[possession('short')!.key] ?? 0, long = (needs as Record<string, number>)[possession('long')!.key] ?? 0;
  const reachStd = next.reachStd === undefined ? undefined : tenth(next.reachStd, MIN_REACH, MAX_REACH, before.reachStd ?? MIN_REACH);
  return {
    ...next, needs,
    jackets: whole(next.jackets, 0, short, Math.min(short, before.jackets)),
    coats: whole(next.coats, 0, long, Math.min(long, before.coats)),
    growth: whole(next.growth, 0, MAX_GROWTH_PERCENT, before.growth),
    longDrop: tenth(next.longDrop, LONG_DROP.min, LONG_DROP.max, before.longDrop),
    reach: tenth(next.reach, MIN_REACH, MAX_REACH, before.reach),
    ...(reachStd === undefined ? {} : { reachStd }),
  };
}
