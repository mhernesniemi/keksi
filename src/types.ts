import type { Texts } from './i18n.js';

export type Locale = 'fi' | 'sv' | 'en';
export type Category = 'analytics' | 'marketing';
export type ProviderId = 'ga' | 'googleAds' | 'meta' | 'posthog' | 'youtube';
export type Consent = Record<Category, boolean>;

export interface KeksiConfig {
  /** GA4 measurement ids, e.g. `G-XXXXXXX`. */
  ga?: string | string[];
  /** Google Ads tag ids, e.g. `AW-123456789`. */
  googleAds?: string | string[];
  /** Meta Pixel ids. */
  meta?: string | string[];
  /** PostHog project token and ingestion host (default `https://eu.i.posthog.com`). */
  posthog?: { key: string; host?: string };
  /** Enables `<keksi-youtube>` embeds. */
  youtube?: boolean;
  /** Cookie policy page, linked from the banner. */
  policyUrl?: string | Partial<Record<Locale, string>>;
  cookie?: {
    name?: string;
    /** Share consent across subdomains, e.g. `example.fi`. */
    domain?: string;
    days?: number;
  };
  /** Cookies your site or framework sets without consent, usually from `keksi scan`. Listed under "Necessary". */
  necessary?: NecessaryCookie[];
  texts?: Partial<Record<Locale, Partial<Texts>>>;
}

export interface NecessaryCookie {
  name: string;
  /** A `Duration`; plain string so JSON imports type-check. */
  duration: string;
  purpose?: string | Partial<Record<Locale, string>>;
  host?: string;
  /** `localStorage` or `sessionStorage`; omitted for cookies. */
  storage?: string;
}

/** `session`, `persistent`, or a number with unit: `2y`, `13mo`, `90d`, `15min`. */
export type Duration = 'session' | 'persistent' | `${number}${'y' | 'mo' | 'd' | 'min'}`;

export interface CookieInfo {
  name: string;
  duration: Duration;
  /** Third-party host that sets it. Omitted = set on this site, deleted on withdrawal. */
  host?: string;
  storage?: 'localStorage' | 'sessionStorage';
}

export interface Provider {
  id: ProviderId;
  name: string;
  category: Category;
  company: string;
  privacyPolicy: string;
  purpose: Record<Locale, string>;
  /** Transfer outside the EU: under the DPF, or to the US with no basis stated. */
  transfer?: 'dpf' | 'us';
  cookies: CookieInfo[];
  /** Hosts it contacts, for the Playwright check. */
  hosts: string[];
}

/** What the inline runtime needs, serialized into the page. */
export interface RuntimeData {
  v: string;
  name: string;
  domain?: string;
  days: number;
  ga: string[];
  ads: string[];
  meta: string[];
  ph?: { key: string; host: string };
  yt: boolean;
  /** First-party cookie and storage names per category, `*` = wildcard. */
  del: Record<Category, string[]>;
  t: Pick<Texts, 'ytText' | 'ytButton' | 'ytOpen'>;
}
