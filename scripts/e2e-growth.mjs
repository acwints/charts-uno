/**
 * Local end-to-end check: signup entry, account creation, chart save, share page.
 * Google's token exchange needs a real Google account, so this drives the
 * authorize redirect and then creates the account through the review-login
 * route (the same account-creation path the API uses for a first sign-in).
 */
import { chromium } from 'playwright';

const web = process.env.E2E_WEB || 'http://localhost:5173';
const api = process.env.E2E_API || 'http://localhost:8080';
const email = process.env.REVIEW_LOGIN_EMAIL;
const password = process.env.REVIEW_LOGIN_PASSWORD;
if (!email || !password) throw new Error('REVIEW_LOGIN_EMAIL and REVIEW_LOGIN_PASSWORD are required');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];

function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (!ok) failures.push(line);
}

try {
  await page.goto(`${web}/?auth=1`, { waitUntil: 'networkidle' });
  const dialog = page.getByRole('dialog', { name: 'Sign in or create an account' });
  await dialog.waitFor({ timeout: 15000 });
  check('signup modal opens from ?auth=1', await dialog.isVisible());
  check('signup offers Google', await dialog.getByRole('button', { name: 'Continue with Google' }).isVisible());

  let oauthUrl = '';
  await page.route('https://accounts.google.com/**', async (route) => {
    oauthUrl = route.request().url();
    await route.abort();
  });
  await dialog.getByRole('button', { name: 'Continue with Google' }).click();
  await page.waitForTimeout(1500);
  check('Google authorize URL is started', oauthUrl.includes('accounts.google.com') && oauthUrl.includes('response_type=code') && oauthUrl.includes('redirect_uri='));

  await page.goto(`${web}/new`, { waitUntil: 'domcontentloaded' });
  const created = await page.evaluate(async ({ email, password, api }) => {
    const response = await fetch(`${api}/api/auth/review/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deliver: 'cookie' }),
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, { email, password, api });
  check('account creation returns a session', created.ok, `status ${created.status}`);

  await page.goto(`${web}/new`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Account menu' }).waitFor({ timeout: 15000 });
  check('signed-in shell replaces the sign-in button', true);

  const data = 'Month,Signups\nJan,120\nFeb,180\nMar,360\n';
  await page.locator('.paste-textarea').fill(data);
  await page.getByRole('button', { name: 'Generate Chart' }).click();
  const title = page.locator('.control-input-title');
  await title.waitFor({ timeout: 20000 });
  await title.fill('Q3 signups doubled');
  await page.getByRole('button', { name: 'Save Chart' }).click();
  await page.waitForURL(/\/chart\/[0-9a-f-]{36}/, { timeout: 15000 });
  const chartId = page.url().split('/chart/')[1];
  check('chart is saved', /\/chart\/[0-9a-f-]{36}/.test(page.url()), page.url());

  const shareResponse = page.waitForResponse((response) =>
    response.url().includes('/share') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Copy share link' }).click();
  const shared = await shareResponse;
  const shareBody = await shared.json();
  check('share link is created', shared.ok() && Boolean(shareBody.token), `status ${shared.status()}`);

  const shareUrl = `${web}/s/${shareBody.token}`;
  const sharePage = await page.goto(shareUrl, { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  check('share page returns HTML', sharePage?.status() === 200, `status ${sharePage?.status()}`);
  check('share page shows the chart title', html.includes('Q3 signups doubled'));
  check('share page has the signup CTA', html.includes('Made with Chartsuno: make your own free'));
  check('share page has Open Graph title and image', html.includes('property="og:title"') && html.includes('/og.png'));
  check('share URL is not the editor route', page.url().includes('/s/') && !page.url().includes('/chart/'));
  const privateChart = await fetch(`${api}/api/charts/${chartId}`);
  check('chart id stays private without the share token', privateChart.status === 403, `status ${privateChart.status}`);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ['bar-chart-maker', 'csv-to-chart', 'iphone-chart-maker', 'pie-chart-maker', 'line-graph-maker', 'chart-from-google-sheets']) {
    const response = await page.goto(`${web}/${slug}`, { waitUntil: 'domcontentloaded' });
    const body = await page.locator('h1').innerText();
    const cta = page.locator('.seo-cta');
    const href = await cta.getAttribute('href');
    check(`${slug} is crawlable HTML`, response?.headers()['content-type']?.includes('text/html') && response.status() === 200, body);
    check(`${slug} CTA stays on the web app`, href === '/' || href === '/?auth=1', href || '');
  }
  const iphoneCta = await page.locator('.seo-cta').innerText();
  check('iPhone CTA is the browser, not the store', iphoneCta.includes('browser') && !(await page.content()).includes('apps.apple.com'));
} catch (error) {
  console.error(error);
  failures.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll growth checks passed');
