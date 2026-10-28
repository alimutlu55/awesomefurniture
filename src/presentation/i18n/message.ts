import type { Messages } from './languages';
interface Pattern { expression: RegExp; target: string; slots: { id: string; ui: boolean }[] }
const compiled = new WeakMap<Messages, readonly Pattern[]>();
function patterns(messages: Messages) {
  let result = compiled.get(messages);
  if (result) return result;
  result = Object.entries(messages).filter(([source]) => /\{\d+(?::n|:ui)?\}/.test(source)).map(([source, target]) => {
    const slots: Pattern['slots'] = [];
    const expression = source.split(/(\{\d+(?::n|:ui)?\})/).map(part => {
      const slot = part.match(/^\{(\d+)(?::(n|ui))?\}$/);
      if (!slot) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      slots.push({ id: slot[1]!, ui: slot[2] === 'ui' });
      return slot[2] === 'n' ? '(\\d+(?:[\\s,.]\\d+)*)' : '(.+?)';
    }).join('');
    return { expression: new RegExp('^' + expression + '$', 'u'), target, slots };
  });
  compiled.set(messages, result); return result;
}
/** Exact UI messages only. Values are plain text; never evaluate or inject translated markup.
 * Numeric slots avoid matching prose ("Get credits"). Only :ui slots translate their contents;
 * free-text slots preserve project names, email addresses and other user data verbatim. */
export function translateMessage(source: string, messages: Messages): string {
  const text = source.trim();
  if (!text) return source;
  let translated = Object.hasOwn(messages, text) ? messages[text] : undefined;
  if (translated === undefined) for (const pattern of patterns(messages)) {
    const match = text.match(pattern.expression);
    if (!match) continue;
    const values = new Map(pattern.slots.map((slot, index) => {
      const raw = match[index + 1] ?? '';
      const key = slot.ui ? Object.keys(messages).find(key => key.toLowerCase() === raw.toLowerCase()) : undefined;
      return [slot.id, key ? messages[key]! : raw];
    }));
    translated = pattern.target.replace(/\{(\d+)\}/g, (_, n: string) => values.get(n) ?? ''); break;
  }
  if (translated === undefined) return source;
  return source.slice(0, source.indexOf(text)) + translated + source.slice(source.indexOf(text) + text.length);
}
