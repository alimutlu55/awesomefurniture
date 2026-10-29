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
      logo: `${siteOrigin}/favicon.svg` },
    { '@type': 'WebSite', '@id': `${siteOrigin}/#website`, name: 'FurniDraw', url: siteOrigin,
      inLanguage: languages.map(c => c.lang), publisher: { '@id': `${siteOrigin}/#organization` } },
    { '@type': 'WebPage', '@id': url, url, name: title, description, inLanguage: copy.lang,
      isPartOf: { '@id': `${siteOrigin}/#website` }, about: { '@id': `${siteOrigin}/#app` } },
    { '@type': 'WebApplication', '@id': `${siteOrigin}/#app`, name: 'FurniDraw', url: `${siteOrigin}/editor/`,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web browser',
      browserRequirements: 'Modern browser with JavaScript and WebGL enabled',
      description: 'Browser-based 3D design for fitted wardrobes and modular kitchen cabinets, with AI visualisations and dimensioned technical drawings.',
      inLanguage: 'en', featureList: ['3D furniture design', 'Fitted wardrobes', 'Modular kitchen cabinets',
        'AI design images', 'Dimensioned technical drawings'], publisher: { '@id': `${siteOrigin}/#organization` } },
  ];
  if (guide) graph.push({ '@type': 'BreadcrumbList', itemListElement: [
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
    <meta property="og:locale" content="${({ en: 'en_US', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', pl: 'pl_PL', pt: 'pt_BR', tr: 'tr_TR' })[copy.lang]}">
    <meta property="og:image" content="${siteOrigin}/assets/furnidraw-social.png">
    <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="FurniDraw — an idea, a perfect fit, something you made">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${siteOrigin}/assets/furnidraw-social.png">
    <meta name="theme-color" content="#f7f6f2">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="help" type="text/markdown" href="/llms.txt" title="Guide for AI agents">
    <script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}
