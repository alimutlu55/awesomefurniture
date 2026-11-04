import type { MarketingCopy } from './copy';
import { homePath, languages } from './translations';
import { escapeHtml as e } from './seo';

export function languageMenu(c: MarketingCopy): string {
  return `<details class="site-language"><summary aria-label="${e(c.language)}: ${e(c.name)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>
    </svg><span>${e(c.lang.toUpperCase())}</span><span class="language-caret" aria-hidden="true">⌄</span>
    </summary><nav class="site-language-options" aria-label="${e(c.language)}">
      <span class="site-language-heading">${e(c.language)}</span>
      ${languages.map(l => `<a href="${homePath(l.lang)}" lang="${l.lang}" hreflang="${l.lang}" data-site-language="${l.lang}"
        ${l.lang === c.lang ? 'aria-current="page"' : ''}><span translate="no">${e(l.name)}</span><span aria-hidden="true">${l.lang === c.lang ? '✓' : l.lang.toUpperCase()}</span></a>`).join('')}
    </nav></details>`;
}
