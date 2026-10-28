import { APP_LANGUAGES, LANGUAGE_KEY, chooseLanguage, type AppLanguage, type Messages } from './languages';
import { translateMessage } from './message';
export { APP_LANGUAGES } from './languages';
export type { AppLanguage } from './languages';
const loaders = {
  de: () => import('./locales/de.json'), fr: () => import('./locales/fr.json'), es: () => import('./locales/es.json'),
  pl: () => import('./locales/pl.json'), pt: () => import('./locales/pt.json'), tr: () => import('./locales/tr.json'),
};
let language: AppLanguage = 'en', messages: Messages = {}, request = 0;
const listeners = new Set<() => void>();
export const currentLanguage = () => language;
export const translate = (source: string) => translateMessage(source, messages);
export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
/** A display preference: changing it never remounts an editor or writes a project. */
export async function setLanguage(next: AppLanguage): Promise<void> {
  if (!APP_LANGUAGES.some(item => item.code === next)) throw new Error('Unsupported language');
  const token = ++request;
  const loaded = next === 'en' ? {} : (await loaders[next]()).default;
  if (token !== request) return;
  messages = loaded; language = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.title = translate('FurniDraw Studio — Furniture Designer');
  }
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Preferences can be unavailable in private mode. */ }
  for (const listener of listeners) listener();
}
export async function initializeLanguage(): Promise<void> {
  let stored: string | null = null;
  try { stored = localStorage.getItem(LANGUAGE_KEY); } catch { /* Use the URL or browser preference. */ }
  const query = new URL(location.href).searchParams.get('lang');
  try { await setLanguage(chooseLanguage(query, stored, navigator.languages ?? [navigator.language])); }
  catch { await setLanguage('en'); }
  // A URL-selected language is now a preference; a later in-app choice must survive refresh.
  if (query !== null) {
    const url = new URL(location.href); url.searchParams.delete('lang'); history.replaceState(history.state, '', url);
  }
}
