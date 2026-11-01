import { expect, test } from 'vitest';
import { CREDIT_HOME, CREDIT_LABEL, creditHref, svgWithCredit, tableChartSvg } from '../src/services/chartCredit';

test('credit link uses the signed-in invite code and falls back when logged out', () => {
  expect(creditHref('Abcd1234')).toBe('https://www.chartsuno.com/?ref=Abcd1234');
  expect(creditHref(null)).toBe(CREDIT_HOME);
  expect(creditHref('')).toBe(CREDIT_HOME);
  expect(creditHref('short')).toBe(CREDIT_HOME);
  expect(creditHref('https://evil.test')).toBe(CREDIT_HOME);
});

test('svg download carries a Made with Chartsuno link and ignores a foreign href', () => {
  const marked = svgWithCredit(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80"/></svg>',
    'https://www.chartsuno.com/?ref=Abcd1234',
  );
  expect(marked).toContain(`>${CREDIT_LABEL}<`);
  expect(marked).toContain('href="https://www.chartsuno.com/?ref=Abcd1234"');
  expect(marked).toContain('viewBox="0 0 120 108"');

  const rejected = svgWithCredit(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"></svg>',
    'https://evil.test/?ref=Abcd1234',
  );
  expect(rejected).toContain(`href="${CREDIT_HOME}"`);
  expect(rejected).not.toContain('evil.test');
});

test('a table export is still an svg with the credit', () => {
  const svg = tableChartSvg(
    { labels: ['North'], series: [{ name: 'Orders', data: [42] }] },
    CREDIT_HOME,
  );
  expect(svg.startsWith('<?xml')).toBe(true);
  expect(svg).toContain('North');
  expect(svg).toContain('42');
  expect(svg).toContain(`>${CREDIT_LABEL}<`);
  expect(svg).toContain(`href="${CREDIT_HOME}"`);
});
