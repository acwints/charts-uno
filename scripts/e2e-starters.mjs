/**
 * Signed-in user with no charts can open a starter in the editor.
 * Account creation uses the review-login route on the local API only.
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
  check('sign-in dialog still opens', await dialog.isVisible());

  const created = await page.evaluate(async ({ email, password, api }) => {
    const response = await fetch(`${api}/api/auth/review/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deliver: 'cookie' }),
    });
    return { ok: response.ok, status: response.status };
  }, { email, password, api });
  check('empty account session', created.ok, `status ${created.status}`);

  await page.goto(`${web}/dashboard`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'No charts yet' }).waitFor({ timeout: 15000 });
  const starters = page.getByRole('button', { name: /open a sample|Monthly revenue|Weekly visits|Signups and churn|Tickets by channel/ });
  check('four starters are offered', await page.getByRole('button', { name: /Monthly revenue/ }).isVisible()
    && await page.getByRole('button', { name: /Weekly visits/ }).isVisible()
    && await page.getByRole('button', { name: /Signups and churn/ }).isVisible()
    && await page.getByRole('button', { name: /Tickets by channel/ }).isVisible());
  void starters;

  await page.getByRole('button', { name: /Monthly revenue/ }).click();
  await page.waitForURL('**/chart', { timeout: 10000 });
  const title = page.locator('.control-input-title');
  await title.waitFor({ timeout: 10000 });
  check('starter opens in the editor', await title.inputValue() === 'Monthly revenue', await title.inputValue());

  await page.goto(`${web}/dashboard`, { waitUntil: 'networkidle' });
  check('unsaved starter did not create a chart', await page.getByRole('heading', { name: 'No charts yet' }).isVisible());
  await page.getByRole('link', { name: 'Create New Chart' }).click();
  await page.waitForURL('**/new', { timeout: 10000 });
  check('existing create flow still opens', page.url().endsWith('/new'));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${web}/dashboard`, { waitUntil: 'networkidle' });
  const box = await page.getByRole('button', { name: /Monthly revenue/ }).boundingBox();
  check('starter tap target is at least 44px', Boolean(box && box.height >= 44 && box.width >= 44), box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'missing');
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
console.log('\nStarter checks passed');
