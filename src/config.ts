import { type Texts, texts } from './i18n.js';
import { providers } from './providers.js';
import type { Category, KeksiConfig, Locale, Provider, RuntimeData } from './types.js';

export function defineConfig(config: KeksiConfig): KeksiConfig {
  return config;
}

const list = (v?: string | string[]): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const posthogHost = (config: KeksiConfig) => (config.posthog?.host ?? 'https://eu.i.posthog.com').replace(/\/$/, '');

export function activeProviders(config: KeksiConfig): Provider[] {
  return providers
    .filter((p) =>
      p.id === 'youtube' ? config.youtube : p.id === 'posthog' ? config.posthog?.key : list(config[p.id]).length,
    )
    .map((p) => (p.id === 'posthog' && /\/\/us\./.test(posthogHost(config)) ? { ...p, transfer: 'us' } : p));
}

export function categoriesOf(config: KeksiConfig): Category[] {
  return (['analytics', 'marketing'] as const).filter((c) => activeProviders(config).some((p) => p.category === c));
}

/** False when YouTube is the only provider: a click on a video is the consent, so the banner doesn't show by itself. */
export function needsBanner(config: KeksiConfig): boolean {
  return activeProviders(config).some((p) => p.id !== 'youtube');
}

export function policyOf(config: KeksiConfig, locale: Locale): string | undefined {
  return typeof config.policyUrl === 'string' ? config.policyUrl : config.policyUrl?.[locale];
}

export function textsFor(config: KeksiConfig, locale: Locale): Texts {
  return { ...texts[locale], ...config.texts?.[locale] };
}

/** Changes when a provider is added or removed, which asks everyone again. Ids and texts can change freely. */
export function version(config: KeksiConfig): string {
  let h = 0x811c9dc5;
  for (const ch of activeProviders(config).map((p) => p.id).join()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(36);
}

export function runtimeData(config: KeksiConfig, locale: Locale): RuntimeData {
  const active = activeProviders(config);
  const del = (c: Category) =>
    active.filter((p) => p.category === c).flatMap((p) => p.cookies.filter((k) => !k.host).map((k) => k.name));
  const t = textsFor(config, locale);
  return {
    v: version(config),
    name: config.cookie?.name ?? 'keksi',
    domain: config.cookie?.domain,
    days: config.cookie?.days ?? 365,
    ga: list(config.ga),
    ads: list(config.googleAds),
    meta: list(config.meta),
    ph: config.posthog?.key ? { key: config.posthog.key, host: posthogHost(config) } : undefined,
    yt: !!config.youtube,
    banner: needsBanner(config),
    policy: policyOf(config, locale),
    del: { analytics: del('analytics'), marketing: del('marketing') },
    t: { ytText: t.ytText, ytButton: t.ytButton, ytOpen: t.ytOpen, more: t.more },
  };
}
