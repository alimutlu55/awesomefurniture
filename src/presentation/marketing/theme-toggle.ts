import { homeCopy } from './home-copy';

/** Public-page appearance is independent of the studio's scene lighting. */
export function mountThemeToggle() {
  const button = document.querySelector<HTMLButtonElement>('.theme-toggle');
  if (!button) return;
  const root = document.documentElement;
  const copy = homeCopy(root.lang);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const key = 'furnidraw-marketing-theme';
  const isDark = () => root.dataset.theme === 'dark' || (!root.dataset.theme && system.matches);
  const sync = () => {
    const dark = isDark();
    const label = dark ? copy.switchLight : copy.switchDark;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('.theme-toggle-label')!.textContent = dark ? copy.light : copy.dark;
    button.dataset.mode = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16140f' : '#f3f0e8');
  };
  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(key, next); } catch { /* Appearance still works for this visit. */ }
    sync();
  });
  system.addEventListener('change', sync);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    if (event.newValue === 'light' || event.newValue === 'dark') root.dataset.theme = event.newValue;
    else delete root.dataset.theme;
    sync();
  });
  sync();
}
