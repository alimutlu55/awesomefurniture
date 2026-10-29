import { homePath, languages } from './translations';
import type { MarketingCopy } from './copy';
import type { Guide } from './guides';

export const siteOrigin = 'https://furnidraw.com';
export const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;');
export const jsonLd = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function seoHead(copy: MarketingCopy, guide?: Guide, indexable = true): string {
  const path = guide ? `/${guide.slug}/` : homePath(copy.lang), url = siteOrigin + path;
  const title = guide?.title ?? copy.title, description = guide?.description ?? copy.description;
  const graph: object[] = [
    { '@type': 'Organization', '@id': `${siteOrigin}/#organization`, name: 'FurniDraw', url: siteOrigin,
      logo: { '@type': 'ImageObject', url: `${siteOrigin}/assets/furnidraw-mark.png`, width: 512, height: 512 } },
    { '@type': 'WebSite', '@id': `${siteOrigin}/#website`, name: 'FurniDraw', alternateName: 'furnidraw.com', url: siteOrigin + '/',
      inLanguage: languages.map(c => c.lang), publisher: { '@id': `${siteOrigin}/#organization` } },
    { '@type': 'WebPage', '@id': url, url, name: title, description, inLanguage: copy.lang,
      isPartOf: { '@id': `${siteOrigin}/#website` }, about: { '@id': `${siteOrigin}/#app` },
      ...(guide ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}) },
    { '@type': 'WebApplication', '@id': `${siteOrigin}/#app`, name: 'FurniDraw', url: `${siteOrigin}/editor/`,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web browser',
      browserRequirements: 'Modern browser with JavaScript and WebGL enabled',
      description: 'Browser-based 3D design for fitted wardrobes and modular kitchen cabinets, with AI visualisations and dimensioned technical drawings.',
      inLanguage: languages.map(c => c.lang), offers: { '@type': 'Offer', name: 'Browser design workspace', price: 0, priceCurrency: 'USD',
        url: `${siteOrigin}/editor/`, description: 'Begin designing without buying credits. AI images and drawing exports use the in-app credit system.' },
      featureList: ['3D furniture design', 'Fitted wardrobes', 'Modular kitchen cabinets',
        'AI design images', 'Dimensioned technical drawings'], publisher: { '@id': `${siteOrigin}/#organization` } },
  ];
  if (guide) graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'FurniDraw', item: siteOrigin + '/' },
    { '@type': 'ListItem', position: 2, name: guide.label, item: url },
  ] });
  const alternates = guide ? '' : languages.map(c =>
    `<link rel="alternate" hreflang="${c.lang}" href="${siteOrigin + homePath(c.lang)}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${siteOrigin}/">`;
  return `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
    <link rel="canonical" href="${url}">
    ${alternates}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="FurniDraw">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:locale" content="${socialLocales[copy.lang]}">
    ${guide ? '' : languages.filter(c => c.lang !== copy.lang).map(c =>
      `<meta property="og:locale:alternate" content="${socialLocales[c.lang]}">`).join('\n')}
    <meta property="og:image" content="${siteOrigin}/assets/furnidraw-design-social.png">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(copy.lang === 'en' ? 'FurniDraw — 3D furniture design with precise plans' : copy.title)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${siteOrigin}/assets/furnidraw-design-social.png">
    <meta name="twitter:image:alt" content="${escapeHtml(copy.title)}">
    <meta name="theme-color" content="#292c25">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/manifest.json">
    <link rel="help" type="text/markdown" href="/llms.txt" title="Guide for AI agents">
    <script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

const socialLocales: Readonly<Record<string, string>> = {
  en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', pl: 'pl_PL', pt: 'pt_BR', tr: 'tr_TR',
};
