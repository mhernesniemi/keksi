import type { Provider } from './types.js';

const GOOGLE = { company: 'Google Ireland Limited', privacyPolicy: 'https://policies.google.com/privacy', transfer: 'dpf' as const };
const META = { company: 'Meta Platforms Ireland Limited', privacyPolicy: 'https://www.facebook.com/privacy/policy/', transfer: 'dpf' as const };

export const providers: Provider[] = [
  {
    id: 'ga',
    name: 'Google Analytics',
    ...GOOGLE,
    category: 'analytics',
    purpose: {
      fi: 'Kävijätilastot: kävijämäärät, liikenteen lähteet ja sivujen käyttö.',
      sv: 'Besöksstatistik: antal besökare, trafikkällor och hur sidorna används.',
      en: 'Visitor statistics: visitor numbers, traffic sources and page usage.',
    },
    cookies: [
      { name: '_ga', duration: '2y' },
      { name: '_ga_*', duration: '2y' },
    ],
    hosts: ['google-analytics.com', 'analytics.google.com', 'googletagmanager.com'],
  },
  {
    id: 'googleAds',
    name: 'Google Ads',
    ...GOOGLE,
    category: 'marketing',
    purpose: {
      fi: 'Mainonnan tehon mittaaminen (konversiot) ja mainosten kohdentaminen sivuston kävijöille.',
      sv: 'Mätning av annonsernas effekt (konverteringar) och riktad annonsering till besökare.',
      en: 'Measuring ad performance (conversions) and showing ads to site visitors.',
    },
    cookies: [
      { name: '_gcl_au', duration: '90d' },
      { name: '_gcl_aw', duration: '90d' },
      { name: '_gcl_dc', duration: '90d' },
      { name: '_gcl_gs', duration: '90d' },
      { name: '_gac_*', duration: '90d' },
      { name: '_gcl_ls', duration: 'persistent', storage: 'localStorage' },
      { name: 'IDE', duration: '13mo', host: 'doubleclick.net' },
      { name: 'DSID', duration: '14d', host: 'doubleclick.net' },
      { name: 'test_cookie', duration: '15min', host: 'doubleclick.net' },
    ],
    hosts: ['googletagmanager.com', 'googleadservices.com', 'doubleclick.net', 'googlesyndication.com'],
  },
  {
    id: 'meta',
    name: 'Meta Pixel',
    ...META,
    category: 'marketing',
    purpose: {
      fi: 'Mainonnan tehon mittaaminen ja mainosten kohdentaminen Facebookissa ja Instagramissa.',
      sv: 'Mätning av annonsernas effekt och riktad annonsering på Facebook och Instagram.',
      en: 'Measuring ad performance and targeting ads on Facebook and Instagram.',
    },
    cookies: [
      { name: '_fbp', duration: '90d' },
      { name: '_fbc', duration: '90d' },
      { name: 'fr', duration: '90d', host: 'facebook.com' },
    ],
    hosts: ['facebook.net', 'facebook.com'],
  },
  {
    id: 'posthog',
    name: 'PostHog',
    company: 'PostHog Inc.',
    privacyPolicy: 'https://posthog.com/privacy',
    category: 'analytics',
    purpose: {
      fi: 'Tuoteanalytiikka: sivujen katselut, klikkaukset ja käyttötavat. Voi tallentaa istuntoja, jos istuntotallenteet ovat käytössä.',
      sv: 'Produktanalys: sidvisningar, klick och användningsmönster. Kan spela in sessioner om sessionsinspelning är aktiverad.',
      en: 'Product analytics: page views, clicks and usage patterns. Can record sessions if session replay is enabled.',
    },
    cookies: [
      { name: 'ph_*_posthog', duration: '1y' },
      { name: 'ph_*_posthog_cpm', duration: '1y' },
      { name: 'ph_*_posthog', duration: 'persistent', storage: 'localStorage' },
      { name: 'ph_*_posthog__flags', duration: 'persistent', storage: 'localStorage' },
      { name: 'ph_*_posthog', duration: 'session', storage: 'sessionStorage' },
      { name: 'ph_*_primary_window_exists', duration: 'session', storage: 'sessionStorage' },
      { name: 'ph_*_session_registered_properties', duration: 'session', storage: 'sessionStorage' },
      { name: 'ph_*_window_id', duration: 'session', storage: 'sessionStorage' },
    ],
    hosts: ['posthog.com'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    ...GOOGLE,
    category: 'marketing',
    purpose: {
      fi: 'Upotettujen videoiden toistaminen. YouTube voi käyttää tietoja mainontaan.',
      sv: 'Uppspelning av inbäddade videor. YouTube kan använda uppgifterna för annonsering.',
      en: 'Playing embedded videos. YouTube may use the data for advertising.',
    },
    cookies: [
      { name: 'YSC', duration: 'session', host: 'youtube.com' },
      { name: 'VISITOR_INFO1_LIVE', duration: '6mo', host: 'youtube.com' },
      { name: 'VISITOR_PRIVACY_METADATA', duration: '6mo', host: 'youtube.com' },
      { name: '__Secure-YNID', duration: '6mo', host: 'youtube.com' },
      { name: '__Secure-ROLLOUT_TOKEN', duration: '6mo', host: 'youtube.com' },
      { name: 'PREF', duration: '8mo', host: 'youtube.com' },
      { name: 'yt-remote-*, ytidb::*, yt-player-*', duration: 'persistent', host: 'youtube-nocookie.com', storage: 'localStorage' },
    ],
    hosts: ['youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'googlevideo.com'],
  },
];
