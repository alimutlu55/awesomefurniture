import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Plugin } from 'vite';
import { english } from '../src/presentation/marketing/copy';
import { languages, homePath } from '../src/presentation/marketing/translations';
import { guides } from '../src/presentation/marketing/guides';
import { homeBody, guideBody } from '../src/presentation/marketing/page';
import { seoHead, siteOrigin, escapeHtml } from '../src/presentation/marketing/seo';

export const publicPaths = () => [...languages.map(c => homePath(c.lang)), ...guides.map(g => `/${g.slug}/`)];
export const isIndexableBuild = (branch = process.env.WORKERS_CI_BRANCH) => !branch || branch === 'main';
export function renderMarketing(template: string, path: string, indexable = true): string {
  const guide = guides.find(g => `/${g.slug}/` === path);
  const copy = languages.find(c => homePath(c.lang) === path) ?? english;
  return template.replace(/<html lang="[^"]+"/, `<html lang="${copy.lang}"`)
    .replace(/<!--fd:head:start-->[\s\S]*?<!--fd:head:end-->/,
      `<!--fd:head:start-->${seoHead(copy, guide, indexable)}<!--fd:head:end-->`)
    .replace(/<!--fd:body:start-->[\s\S]*?<!--fd:body:end-->/,
      `<!--fd:body:start-->${guide ? guideBody(copy, guide) : homeBody(copy)}<!--fd:body:end-->`);
}

export function sitemap(): string {
  const pages = publicPaths().map(path => {
    const home = languages.some(c => homePath(c.lang) === path);
    const alternates = home ? [...languages.map(c =>
      `<xhtml:link rel="alternate" hreflang="${c.lang}" href="${siteOrigin + homePath(c.lang)}"/>`),
    `<xhtml:link rel="alternate" hreflang="x-default" href="${siteOrigin}/"/>`].join('') : '';
    return `<url><loc>${escapeHtml(siteOrigin + path)}</loc>${alternates}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${pages.join('\n')}</urlset>\n`;
}

/** Emit real HTML per URL; visitors and crawlers receive the same fully rendered content. */
export function marketingSite(): Plugin {
  let output = resolve('dist');
  return {
    name: 'furnidraw-public-site',
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://local.test').pathname;
        if (path === '/editor/' || path === '/editor') {
          request.url = '/editor.html' + (request.url?.slice(path.length) ?? ''); next(); return;
        }
        const canonical = path.endsWith('/') ? path : path + '/';
        if (path !== '/' && !publicPaths().includes(canonical)) { next(); return; }
        if (path !== canonical) { response.writeHead(301, { Location: canonical }); response.end(); return; }
        try {
          const source = await readFile(resolve(server.config.root, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(path, renderMarketing(source, path, isIndexableBuild()));
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
        } catch (error) { next(error); }
      });
    },
    transformIndexHtml(html, context) {
      if (!html.includes('<!--fd:head:start-->')) return html;
      const path = new URL(context.originalUrl ?? context.path, 'http://local.test').pathname;
      return renderMarketing(html, path, isIndexableBuild());
    },
    writeBundle: {
      sequential: true, order: 'post',
      async handler() {
        const template = await readFile(resolve(output, 'index.html'), 'utf8');
        for (const path of publicPaths()) {
          const file = resolve(output, path.slice(1), 'index.html');
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, renderMarketing(template, path, isIndexableBuild()));
        }
        // /editor/ is the canonical editor address; retain /editor.html for old bookmarks.
        await mkdir(resolve(output, 'editor'), { recursive: true });
        await writeFile(resolve(output, 'editor/index.html'), await readFile(resolve(output, 'editor.html'), 'utf8'));
        await writeFile(resolve(output, 'sitemap.xml'), sitemap());
        await writeFile(resolve(output, 'robots.txt'), isIndexableBuild()
          ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteOrigin}/sitemap.xml\n`
          : 'User-agent: *\nDisallow: /\n');
      },
    },
  };
}
