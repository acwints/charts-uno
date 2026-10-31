import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_ORIGIN, seoPages, type SeoPage } from '../src/content/seoPages.ts';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(webRoot, 'src/pages/SeoPage.css'), 'utf8');

const tokens = `
.seo-body {
  margin: 0;
  background: #101014;
  color: #f4f4f5;
  --bg-primary: #101014;
  --bg-secondary: #1c1c22;
  --bg-tertiary: #2a2a32;
  --text-primary: #f4f4f5;
  --text-secondary: #d5d7e0;
  --text-muted: #a3a8b8;
  --accent: #4c6fff;
  --accent-hover: #3d5ce0;
  --accent-text: #b9c8ff;
  --accent-foreground: #ffffff;
  --chart-1: #7aa2ff;
  --font-display: "Instrument Serif", Georgia, serif;
  --font-body: Manrope, "Segoe UI", sans-serif;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --radius-md: 8px;
  font-family: var(--font-body);
}
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inline(value: string): string {
  return escapeHtml(value).replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function sample(page: SeoPage): string {
  const max = Math.max(...page.sample.map((row) => row.value), 1);
  const rows = page.sample.map((row) => {
    const width = Math.round((row.value / max) * 100);
    return `<li><span class="seo-bar-label">${escapeHtml(row.label)}</span><span class="seo-bar-track"><span class="seo-bar-fill" style="width:${width}%"></span></span><span class="seo-bar-value">${row.value}</span></li>`;
  }).join('');
  return `<figure class="seo-sample"><figcaption>${escapeHtml(page.sampleCaption)}</figcaption><ul class="seo-bars">${rows}</ul></figure>`;
}

function blocks(page: SeoPage): string {
  return page.blocks.map((block) => {
    if (block.type === 'h2') return `<h2>${escapeHtml(block.text ?? '')}</h2>`;
    if (block.type === 'p') return `<p>${inline(block.text ?? '')}</p>`;
    if (block.type === 'pre') return `<pre>${escapeHtml(block.text ?? '')}</pre>`;
    if (block.type === 'ol' || block.type === 'ul') {
      const items = (block.items ?? []).map((item) => `<li>${inline(item)}</li>`).join('');
      return `<${block.type}>${items}</${block.type}>`;
    }
    const faqs = (block.faqs ?? []).map((faq) => `<dt>${escapeHtml(faq.q)}</dt><dd>${escapeHtml(faq.a)}</dd>`).join('');
    return `<dl class="seo-faq">${faqs}</dl>`;
  }).join('\n');
}

function jsonLd(page: SeoPage): string {
  const faqs = page.blocks.flatMap((block) => block.faqs ?? []);
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a.replaceAll('**', '') },
    })),
  };
  return JSON.stringify(payload).replaceAll('<', '\\u003c');
}

export function renderSeoDocument(page: SeoPage): string {
  const others = seoPages.filter((item) => item.slug !== page.slug);
  const nav = seoPages.map((item) => `<a href="/${item.slug}">${escapeHtml(item.h1)}</a>`).join('');
  const related = others.map((item) => `<a href="/${item.slug}">${escapeHtml(item.h1)}</a>`).join('');
  const url = `${SEO_ORIGIN}/${page.slug}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Chartsuno">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SEO_ORIGIN}/icon-512.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <link rel="icon" href="/favicon.svg">
  <link rel="stylesheet" href="/fonts/fonts.css">
  <script type="application/ld+json">${jsonLd(page)}</script>
  <style>${tokens}${css}</style>
</head>
<body class="seo-body">
  <article class="seo">
    <header class="seo-mast">
      <a class="seo-brand" href="/">Chartsuno</a>
      <nav class="seo-nav" aria-label="Guides">${nav}</nav>
    </header>
    <p class="seo-kicker">Chartsuno</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="seo-lede">${escapeHtml(page.lede)}</p>
    ${sample(page)}
    ${blocks(page)}
    <a class="seo-cta" href="${escapeHtml(page.ctaHref)}">${escapeHtml(page.ctaLabel)}</a>
    <p class="seo-related">More guides: ${related}</p>
  </article>
</body>
</html>
`;
}

export function renderSitemap(): string {
  const urls = ['/', ...seoPages.map((page) => `/${page.slug}`), '/feed', '/terms', '/privacy'];
  const body = urls.map((path) => `  <url><loc>${SEO_ORIGIN}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderRobots(): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /settings\nDisallow: /dashboard\nDisallow: /s/\n\nSitemap: ${SEO_ORIGIN}/sitemap.xml\n`;
}

const publicDir = join(webRoot, 'public');
for (const page of seoPages) {
  const html = renderSeoDocument(page);
  if (html.includes('TODO') || html.includes('apps.apple.com')) {
    throw new Error(`Landing page ${page.slug} has a draft marker or an App Store link`);
  }
  if (!html.includes('10 charts a month') || !html.includes('without an account')) {
    throw new Error(`Landing page ${page.slug} is missing the free-account facts`);
  }
  if (page.slug === 'iphone-chart-maker' && !html.includes('not on the App Store yet')) {
    throw new Error('iPhone page must say the app is not on the App Store yet');
  }
  if (page.slug === 'iphone-chart-maker' && !html.includes('href="/"')) {
    throw new Error('iPhone page CTA must open the web app');
  }
  const dir = join(publicDir, page.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}
writeFileSync(join(publicDir, 'sitemap.xml'), renderSitemap());
writeFileSync(join(publicDir, 'robots.txt'), renderRobots());
console.log(`Wrote ${seoPages.length} landing pages, sitemap.xml, and robots.txt`);
