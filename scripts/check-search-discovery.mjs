import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicPaths, isIndexableBuild } from './marketing-site.ts';
import { languages, homePath } from '../src/presentation/marketing/translations.ts';
import { siteOrigin } from '../src/presentation/marketing/seo.ts';

// Audit emitted HTML rather than a client-side reconstruction. Runs after the build in CI.
const directory = resolve('dist'), routes = publicPaths(), indexable = isIndexableBuild();
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => attributes(m[0]));
const fileFor = pathname => resolve(directory, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
const pages = new Map(routes.map(path => [path, readFileSync(fileFor(path), 'utf8')]));
const titles = new Set(), descriptions = new Set(), reachable = new Set(['/']);
const connections = new Map();
let assets = 0, anchors = 0;

for (const [path, html] of pages) {
  const check = (condition, message) => assert.ok(condition, `${path}: ${message}`);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  check(title && !titles.has(title), 'missing or duplicate title'); titles.add(title);
  const meta = tags(html, 'meta'), links = tags(html, 'link');
  const description = meta.filter(m => m.name === 'description');
  check(description.length === 1 && description[0].content, 'one non-empty description required');
  check(!descriptions.has(description[0].content), 'duplicate description'); descriptions.add(description[0].content);
  check(!meta.some(m => m.name === 'keywords'), 'keyword meta tags are not an SEO strategy');
  const robots = meta.filter(m => m.name === 'robots');
  check(robots.length === 1 && robots[0].content.startsWith(indexable ? 'index,follow' : 'noindex,follow'), 'incorrect indexing directive');
  const canonical = links.filter(l => l.rel === 'canonical');
  check(canonical.length === 1 && canonical[0].href === siteOrigin + path, 'canonical must resolve to this public URL');
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  check(h1.length === 1 && h1[0][1].replace(/<[^>]+>/g, '').trim(), 'one descriptive H1 required');
  check(html.includes('<main ') && /<html lang="[a-z-]+"/.test(html), 'missing main landmark or document language');
  check(/class="fitting-room" data-nosnippet/.test(html), 'illustrative measurements must not enter search snippets');
  for (const image of tags(html, 'img')) {
    check(typeof image.alt === 'string' && image.alt.trim(), 'image missing descriptive alt text');
    check(image.width && image.height, 'image dimensions required to reserve layout space');
  }
  const schema = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  check(schema.length === 1, 'one consistent structured-data graph required');
  const data = JSON.parse(schema[0][1]);
  check(data['@context'] === 'https://schema.org', 'invalid structured-data context');
  const nodes = data['@graph'], ids = nodes.map(n => n['@id']);
  check(new Set(ids).size === ids.length, 'duplicate structured-data entity IDs');
  check(nodes.some(n => n['@type'] === 'WebSite' && n.name === 'FurniDraw'), 'missing brand/site entity');
  const app = nodes.find(n => n['@type'] === 'WebApplication');
  check(app?.offers?.price === 0 && app.offers.description.includes('credit'), 'free design and paid features must be distinguished');
  check(!JSON.stringify(data).includes('aggregateRating') && !JSON.stringify(data).includes('ratingCount'), 'do not invent review signals');
  const language = languages.find(c => homePath(c.lang) === path);
  if (language) {
    check(html.includes(`<html lang="${language.lang}"`), 'incorrect locale');
    const alternates = links.filter(l => l.rel === 'alternate' && l.hreflang);
    check(alternates.length === languages.length + 1, 'missing or duplicate language alternates');
    for (const other of languages) check(alternates.some(l => l.hreflang === other.lang && l.href === siteOrigin + homePath(other.lang)), 'incorrect language target');
    check(alternates.some(l => l.hreflang === 'x-default' && l.href === siteOrigin + '/'), 'missing default language');
  } else {
    check(nodes.some(n => n['@type'] === 'BreadcrumbList'), 'guide missing structured breadcrumbs');
    check(html.includes('aria-label="Breadcrumb"') && html.includes('aria-current="page"'), 'breadcrumbs must also be visible');
  }
  const outgoing = [];
  for (const anchor of tags(html, 'a')) {
    if (!anchor.href) continue;
    const url = new URL(anchor.href, siteOrigin + path);
    if (url.origin !== siteOrigin) continue;
    anchors++;
    check(existsSync(fileFor(url.pathname)), `broken internal link: ${anchor.href}`);
    if (pages.has(url.pathname)) outgoing.push(url.pathname);
    if (url.hash && pages.has(url.pathname) && !/^#(?:spec|design)=/.test(url.hash)) {
      const id = decodeURIComponent(url.hash.slice(1));
      check(pages.get(url.pathname).includes(`id="${id}"`), `broken section link: ${anchor.href}`);
    }
  }
  connections.set(path, outgoing);
  const resources = [...tags(html, 'script').map(t => t.src), ...tags(html, 'img').map(t => t.src),
    ...links.filter(l => l.rel === 'stylesheet' || l.rel === 'icon').map(t => t.href),
    ...meta.filter(m => ['og:image', 'twitter:image'].includes(m.property ?? m.name)).map(t => t.content)];
  for (const value of resources.filter(Boolean)) {
    const url = new URL(value, siteOrigin + path);
    if (url.origin !== siteOrigin) continue;
    check(existsSync(fileFor(url.pathname)), `missing asset: ${url.pathname}`); assets++;
    check(!/mount-editor|assets\/editor-/.test(value), 'public page eagerly loads editor resources');
  }
}
for (let pass = 0; pass < routes.length; pass++) for (const path of [...reachable]) {
  for (const target of connections.get(path) ?? []) reachable.add(target);
}
assert.equal(reachable.size, routes.length, 'every public page must be reachable through actual HTML links');
const sitemap = readFileSync(resolve(directory, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
assert.deepEqual([...locations].sort(), routes.map(p => siteOrigin + p).sort(), 'sitemap must contain exactly the public canonical URLs');
const robots = readFileSync(resolve(directory, 'robots.txt'), 'utf8');
assert.ok(indexable ? robots.includes(`Sitemap: ${siteOrigin}/sitemap.xml`) : robots.includes('Disallow: /'), 'incorrect robots file');
assert.ok(readFileSync(resolve(directory, 'editor/index.html'), 'utf8').includes('noindex,follow'), 'editor must remain outside the search index');
assert.ok(readFileSync(resolve(directory, 'llms.txt'), 'utf8').includes('# FurniDraw'), 'linked agent guide must exist');
console.log(`SEO audit passed: ${routes.length} pages, ${anchors} internal links and ${assets} asset references checked.`);
