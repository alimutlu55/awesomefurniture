import type { CreditCurrency } from '../../domain/credits/credit-catalog';
import { buildModel } from '../../domain/engine/build-model';
import { BUILDER_PROFILES } from '../../domain/engine/catalog/builder-profiles';
import { type Quote, quote } from '../../domain/engine/catalog/quote';
import type { EditorScene } from '../projects/editor-scene';
import { designInput } from './engine-service';

/**
 * What one piece costs to have built, under every builder profile: the same quote as Design check's Price tab, for that
 * piece alone (with what stands on it), so Make can say what the piece in front of the person costs. Worked out again
 * only when the piece or the currency changed.
 */
export function createPieceQuotes() {
  let last: { key: string; quotes: readonly Quote[] } | null = null;
  return (scene: EditorScene, piece: number, currency: CreditCurrency): readonly Quote[] => {
    const input = designInput(scene), only = input.pieces.filter(p => p.id === piece || p.attachedTo === piece);
    if (!only.length) return [];
    const one = { ...input, pieces: only }, key = JSON.stringify(one) + '|' + currency;
    if (last?.key !== key) {
      last = { key, quotes: BUILDER_PROFILES.map(profile => quote(buildModel(one, { construction: profile.construction }), profile, currency)) };
    }
    return last.quotes;
  };
}
