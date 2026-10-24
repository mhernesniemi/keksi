import { expect, test } from '@playwright/test';
import { consentCookie, watchTracking } from '../src/playwright.js';
import type { KeksiConfig } from '../src/types.js';

/** Shared browser tests for the examples. */
export function consentSuite(config: KeksiConfig): void {
  test.beforeEach(async ({ page }) => {
    await page.route(/googletagmanager|google-analytics|doubleclick|facebook|posthog|youtube|ytimg/, (r) => r.fulfill({ status: 204 }));
  });

  test('nothing tracks before a decision', async ({ page }) => {
    const tracking = watchTracking(page, config);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Evästeet' })).toBeVisible();
    await page.getByRole('link', { name: 'Evästeet', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await tracking.check();
  });

  test('rejecting keeps the site clean across pages', async ({ page }) => {
    const tracking = watchTracking(page, config);
    await page.goto('/');
    await page.getByRole('button', { name: 'Hylkää kaikki' }).click();
    await expect(page.getByRole('region', { name: 'Evästeet' })).toBeHidden();
    await page.goto('/evasteet');
    await expect(page.getByRole('region', { name: 'Evästeet' })).toBeHidden();
    await page.waitForLoadState('networkidle');
    await tracking.check();
  });

  test('accepting loads Google, Meta and embeds, and again on the next page', async ({ page }) => {
    const tracking = watchTracking(page, config);
    await page.goto('/');
    await page.getByRole('button', { name: 'Hyväksy kaikki' }).click();
    const loaded = [
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
      'https://connect.facebook.net/en_US/fbevents.js',
      'https://eu-assets.i.posthog.com/static/array.js',
    ];
    await expect.poll(() => tracking.requests).toEqual([...loaded, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ']);
    tracking.requests.length = 0;
    await page.goto('/evasteet');
    await expect.poll(() => tracking.requests).toEqual(loaded);
  });

  test('page events wait for consent and follow the config', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Lähetä yhteydenotto' }).click();
    await page.getByRole('button', { name: 'Hyväksy kaikki' }).click();
    const queue = await page.evaluate(() => (window.dataLayer as IArguments[]).map((a) => String(a[0]) + ' ' + String(a[1])));
    expect(queue.filter((c) => !c.startsWith('js'))).toEqual([
      'consent default',
      'consent update',
      'config G-TEST123',
      'config AW-123456',
      'event generate_lead',
    ]);
  });

  test('settings save single categories', async ({ page }) => {
    const tracking = watchTracking(page, config);
    await page.goto('/');
    await page.getByRole('button', { name: 'Asetukset', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Evästeasetukset' });
    await dialog.getByRole('switch', { name: 'Analytiikka' }).check();
    await dialog.getByRole('button', { name: 'Tallenna valinnat' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => tracking.requests).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
      'https://eu-assets.i.posthog.com/static/array.js',
    ]);
  });

  test('withdrawing deletes first-party cookies and reloads', async ({ page, context, baseURL }) => {
    await context.addCookies([consentCookie(config, baseURL!, { analytics: true, marketing: true })]);
    await page.goto('/');
    await page.evaluate(() => {
      document.cookie = '_ga=GA1.1.1; Path=/';
      document.cookie = '_ga_TEST123=GS1; Path=/';
      document.cookie = '_fbp=fb.1; Path=/';
      document.cookie = 'session=keep; Path=/';
      localStorage.setItem('_gcl_ls', '{}');
    });
    await page.getByRole('button', { name: 'Evästeasetukset' }).click();
    const reload = page.waitForEvent('load');
    await page.getByRole('dialog').getByRole('button', { name: 'Hylkää kaikki' }).click();
    await reload;
    const names = (await context.cookies()).map((c) => c.name).sort();
    expect(names).toEqual(['keksi', 'session']);
    expect(await page.evaluate(() => localStorage.getItem('_gcl_ls'))).toBeNull();
    await watchTracking(page, config, { allow: ['session'] }).check();
  });

  test('YouTube shows a placeholder until clicked', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('keksi-youtube');
    await expect(video.locator('iframe')).toHaveCount(0);
    await video.getByRole('button', { name: 'Näytä video: Big Buck Bunny' }).click();
    await expect(video.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1');
    await expect(page.getByRole('region', { name: 'Evästeet' })).toBeVisible();
  });

  test('the policy page lists every cookie', async ({ page }) => {
    await page.goto('/evasteet');
    for (const name of ['keksi', 'ph_*_posthog', '_ga', '_gcl_au', 'IDE', '_fbp', 'VISITOR_INFO1_LIVE']) {
      await expect(page.locator('.keksi-policy code').getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('Escape closes the settings without deciding', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Asetukset', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('region', { name: 'Evästeet' })).toBeVisible();
    expect(await page.evaluate(() => window.keksi!.consent)).toBeNull();
  });
}
