export const APP_LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'de', name: 'Deutsch' }, { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' }, { code: 'pl', name: 'Polski' }, { code: 'pt', name: 'Português' }, { code: 'tr', name: 'Türkçe' },
] as const;
export type AppLanguage = typeof APP_LANGUAGES[number]['code'];
export type Messages = Readonly<Record<string, string>>;
export const LANGUAGE_KEY = 'furnidraw.language';
export function supportedLanguage(value: string | null | undefined): AppLanguage | null {
  const code = value?.toLowerCase().split(/[-_]/)[0];
  return APP_LANGUAGES.find(language => language.code === code)?.code ?? null;
}
export function chooseLanguage(query: string | null, stored: string | null, preferred: readonly string[]): AppLanguage {
  return supportedLanguage(query) ?? supportedLanguage(stored) ?? preferred.map(supportedLanguage).find(Boolean) ?? 'en';
}
