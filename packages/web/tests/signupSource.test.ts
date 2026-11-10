import { expect, test } from 'vitest';
import { pendingSignupSource, rememberSignupSource } from '../src/services/signupSource';

test('the first landing keeps a hostname, path, and utm fields and drops a later page', () => {
  sessionStorage.clear();
  rememberSignupSource(
    '?utm_source=newsletter&utm_campaign=person@gmail.com&utm_medium=cpc',
    'https://news.google.com/search?q=charts',
    '/csv-to-chart?utm_source=newsletter',
  );
  expect(pendingSignupSource()).toEqual({
    referrer_host: 'news.google.com',
    landing_path: '/csv-to-chart',
    utm_source: 'newsletter',
    utm_medium: 'cpc',
  });
  rememberSignupSource('?utm_source=overwrite', 'https://evil.example/phish', '/account');
  expect(pendingSignupSource().utm_source).toBe('newsletter');
  expect(pendingSignupSource().landing_path).toBe('/csv-to-chart');
});
