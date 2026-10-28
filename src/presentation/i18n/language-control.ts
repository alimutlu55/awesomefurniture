import { APP_LANGUAGES, currentLanguage, onLanguageChange, setLanguage, translate } from './language';
/** Native language select for the three-dot menu, with keyboard and touch support. */
export function createLanguageControl(doc: Document): { element: HTMLLabelElement; dispose(): void } {
  const element = doc.createElement('label'); element.className = 'mi language-control';
  const icon = doc.createElement('span'); icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">'
    + '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
  const caption = doc.createElement('span'); caption.className = 'language-caption'; caption.textContent = 'Language';
  const select = doc.createElement('select'); select.setAttribute('aria-label', translate('Language'));
  select.setAttribute('translate', 'no');
  for (const language of APP_LANGUAGES) {
    const option = doc.createElement('option'); option.value = language.code; option.textContent = language.name;
    option.lang = language.code; select.append(option);
  }
  const status = doc.createElement('span'); status.className = 'language-status'; status.setAttribute('role', 'status');
  const refresh = () => { select.value = currentLanguage(); select.setAttribute('aria-label', translate('Language')); };
  refresh();
  const change = async () => {
    select.disabled = true; status.textContent = '';
    try { await setLanguage(select.value as typeof APP_LANGUAGES[number]['code']); }
    catch { refresh(); status.textContent = translate('Language could not be loaded. Try again.'); }
    finally { select.disabled = false; }
  };
  select.addEventListener('change', change); const unsubscribe = onLanguageChange(refresh);
  element.append(icon, caption, select, status);
  return { element, dispose() { select.removeEventListener('change', change); unsubscribe(); element.remove(); } };
}
