import type { Page } from '@playwright/test';
import { runtimeData } from './config.js';
import { glob } from './glob.js';
import { providers } from './providers.js';
import type { Consent, KeksiConfig } from './types.js';

export interface TrackingOptions {
  /** Cookies and storage keys your site sets without consent, besides those in `necessary`. `*` = wildcard. */
  allow?: string[];
}

/**
 * Records requests to the built-in and configured providers from now on. `check()` throws when any were made or when the page
 * stored anything besides the consent cookie, `necessary` and `allow`.
 */
export function watchTracking(page: Page, config: KeksiConfig, { allow = [] }: TrackingOptions = {}) {
  const trackerHosts = [...providers, ...(config.providers ?? [])].flatMap((p) => p.hosts ?? []);
  if (config.posthog?.host) trackerHosts.push(new URL(config.posthog.host).hostname);
  const requests: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (trackerHosts.some((t) => host === t || host.endsWith(`.${t}`))) requests.push(r.url());
  });
  const patterns = [runtimeData(config, 'fi').name, ...(config.necessary ?? []).map((c) => c.name), ...allow];
  const allowed = { has: (name: string) => patterns.some((p) => glob(p, name)) };

  return {
    requests,
    async check(): Promise<void> {
      const cookies = (await page.context().cookies()).map((c) => `${c.name} (${c.domain})`);
      const storage = await page
        .evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])
        .catch(() => [] as string[]);
      const stored = [...cookies.filter((c) => !allowed.has(c.split(' ')[0]!)), ...storage.filter((k) => !allowed.has(k))];
      const problems = [
        ...requests.map((u) => `request: ${u}`),
        ...stored.map((s) => `stored: ${s}`),
      ];
      if (problems.length) throw new Error(`Tracking without consent:\n  ${problems.join('\n  ')}`);
    },
  };
}

/** Consent cookie for `context.addCookies`, to skip the banner in other tests. */
export function consentCookie(config: KeksiConfig, url: string, consent: Partial<Consent> = {}) {
  const d = runtimeData(config, 'fi');
  const flags = (consent.analytics ? 'a' : '') + (consent.marketing ? 'm' : '') || '-';
  return { name: d.name, value: `${d.v}.${Date.now().toString(36)}.test.${flags}`, url };
}
