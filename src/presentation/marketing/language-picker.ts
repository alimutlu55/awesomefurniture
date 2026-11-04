import { LANGUAGE_KEY } from '../i18n/languages';

export function mountLanguagePicker() {
  document.querySelectorAll<HTMLDetailsElement>('.site-language').forEach(menu => {
    const summary = menu.querySelector('summary')!;
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      menu.open = false;
      summary.focus();
    });
    document.addEventListener('pointerdown', event => {
      if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    });
    menu.addEventListener('focusout', event => {
      if (event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) menu.open = false;
    });
    menu.querySelectorAll<HTMLAnchorElement>('[data-site-language]').forEach(link => {
      link.addEventListener('click', () => {
        try { localStorage.setItem(LANGUAGE_KEY, link.dataset.siteLanguage!); } catch { /* The URL carries the language. */ }
      });
    });
  });
}
