import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { seoPages } from '../src/content/seoPages';

test('landing pages state the real free-account limits and do not send people to the App Store', () => {
  expect(seoPages.map((page) => page.slug)).toEqual([
    'bar-chart-maker',
    'csv-to-chart',
    'iphone-chart-maker',
    'pie-chart-maker',
    'line-graph-maker',
    'chart-from-google-sheets',
    'scatter-plot-maker',
    'chart-from-excel',
    'chartsuno-vs-datawrapper',
    'area-chart-maker',
    'histogram-maker',
    'chartsuno-vs-canva-charts',
  ]);

  for (const page of seoPages) {
    const html = readFileSync(`public/${page.slug}/index.html`, 'utf8');
    expect(html).toContain(`<title>${page.title}</title>`);
    expect(html).toContain(`<h1>${page.h1}</h1>`);
    expect(html).toContain(`<meta name="description" content="${page.description}">`);
    expect(html).toContain(`<link rel="canonical" href="https://www.chartsuno.com/${page.slug}">`);
    expect(html).toContain('10 charts a month');
    expect(html).toContain('without an account');
    expect(html).not.toContain('TODO');
    expect(html).not.toContain('apps.apple.com');
    expect(page.ctaHref.startsWith('/')).toBe(true);
    expect(page.ctaHref).not.toContain('apple.com');
  }

  const iphone = readFileSync('public/iphone-chart-maker/index.html', 'utf8');
  expect(iphone).toContain('not on the App Store yet');
  expect(iphone).toContain('href="/"');
  expect(iphone).toContain('Open Chartsuno in your browser');

  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  for (const page of seoPages) {
    expect(sitemap).toContain(`https://www.chartsuno.com/${page.slug}`);
  }
  expect(sitemap).toContain('https://www.chartsuno.com/changelog');
  expect(sitemap.match(/<loc>/g)).toHaveLength(seoPages.length + 5);
  const area = seoPages.find((page) => page.slug === 'area-chart-maker');
  const histogram = seoPages.find((page) => page.slug === 'histogram-maker');
  const canva = seoPages.find((page) => page.slug === 'chartsuno-vs-canva-charts');
  expect(area?.ctaHref).toBe('/?auth=1');
  expect(histogram?.ctaLabel).toContain('Sign up');
  expect(canva?.ctaHref).toBe('/?auth=1');
  expect(readFileSync('public/histogram-maker/index.html', 'utf8')).toContain('does not auto-bin');
  expect(readFileSync('public/chartsuno-vs-canva-charts/index.html', 'utf8')).toContain('does not open .xlsx');
  expect(readFileSync('public/robots.txt', 'utf8')).toContain('Sitemap: https://www.chartsuno.com/sitemap.xml');
  expect(readFileSync('public/robots.txt', 'utf8')).toContain('Disallow: /s/');
});
