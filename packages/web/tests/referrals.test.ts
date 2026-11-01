import { expect, test } from 'vitest';
import { pendingReferral, referralShareUrl, rememberReferral } from '../src/services/referrals';

test('referral link is the public site with the code', () => {
  expect(referralShareUrl('Abcd1234')).toBe('https://www.chartsuno.com/?ref=Abcd1234');
});

test('a landing ref is kept for the later sign-in and junk is ignored', () => {
  sessionStorage.clear();
  rememberReferral('?ref=Abcd1234');
  expect(pendingReferral()).toBe('Abcd1234');
  rememberReferral('?ref=bad');
  expect(pendingReferral()).toBe('Abcd1234');
  rememberReferral('');
  expect(pendingReferral()).toBe('Abcd1234');
});
