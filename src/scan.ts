import { providers } from './providers.js';
import type { NecessaryCookie } from './types.js';

export interface ScanOptions {
  /** Most pages to visit, following same-origin links. */
  pages?: number;
  /** Consent cookie name, if changed in the config. */
  cookieName?: string;
}

const known = (purpose: string, fi: string, sv: string) => ({ en: purpose, fi, sv });
const SESSION = known('Keeps you signed in.', 'Pitää sinut kirjautuneena.', 'Håller dig inloggad.');
const CSRF = known('Protects forms against forgery.', 'Suojaa lomakkeita väärennöksiltä.', 'Skyddar formulär mot förfalskning.');
const SECURITY = known(
  'Protects the site against bots and attacks.',
  'Suojaa sivustoa boteilta ja hyökkäyksiltä.',
  'Skyddar webbplatsen mot botar och attacker.',
);

/** Purposes for common framework and hosting cookies. `*` suffix = prefix. */
const purposes: Record<string, NecessaryCookie['purpose']> = {
  NEXT_LOCALE: known('Remembers your language.', 'Muistaa valitsemasi kielen.', 'Kommer ihåg ditt språk.'),
  'next-auth.session-token': SESSION,
  '__Secure-next-auth.session-token': SESSION,
  'authjs.session-token': SESSION,
  '__Secure-authjs.session-token': SESSION,
  'next-auth.csrf-token': CSRF,
  '__Host-next-auth.csrf-token': CSRF,
  'authjs.csrf-token': CSRF,
  '__Host-authjs.csrf-token': CSRF,
  'next-auth.callback-url': known('Returns you to the right page after signing in.', 'Palauttaa oikealle sivulle kirjautumisen jälkeen.', 'Återför dig till rätt sida efter inloggning.'),
  __cf_bm: SECURITY,
  cf_clearance: SECURITY,
  _cfuvid: SECURITY,
  PHPSESSID: SESSION,
  'connect.sid': SESSION,
  session: SESSION,
  csrftoken: CSRF,
  _csrf: CSRF,
  'sveltekit:*': known('Restores scroll position and page state when you navigate back.', 'Palauttaa vierityskohdan ja sivun tilan, kun palaat takaisin.', 'Återställer scrollposition och sidans läge när du går tillbaka.'),
};

const trackerNames = providers.flatMap((p) => p.cookies.flatMap((c) => c.name.split(', ')));
const trackerHosts = providers.flatMap((p) => p.hosts);
const matches = (patterns: string[], name: string) =>
  patterns.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));

export function purposeOf(name: string): NecessaryCookie['purpose'] | undefined {
  const k = Object.keys(purposes).find((p) => matches([p], name));
  return k ? purposes[k] : undefined;
}

/** Rounds a cookie lifetime to the units the policy page shows. */
export function durationOf(expires: number, now = Date.now() / 1000): string {
  if (expires < 0) return 'session';
  const minutes = (expires - now) / 60;
  const days = minutes / 1440;
  if (days >= 365) return `${Math.round(days / 365)}y`;
  if (days >= 30) return `${Math.round(days / 30.4)}mo`;
  if (days >= 1) return `${Math.round(days)}d`;
  return `${Math.max(1, Math.round(minutes))}min`;
}

/** Visits the site without consent and returns what it stores, minus keksi's own and known trackers. */
export async function scan(url: string, { pages = 20, cookieName = 'keksi' }: ScanOptions = {}): Promise<NecessaryCookie[]> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const origin = new URL(url).origin;
  const host = new URL(url).hostname;
  const found = new Map<string, NecessaryCookie>();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const queue = [new URL(url).href];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length && i < pages; i++) {
      await page.goto(queue[i]!, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {});
      const { links, local, session } = await page.evaluate(() => ({
        links: [...document.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).href),
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
      }));
      for (const key of local) found.set(`l:${key}`, { name: key, duration: 'persistent', storage: 'localStorage' });
      for (const key of session) found.set(`s:${key}`, { name: key, duration: 'session', storage: 'sessionStorage' });
      for (const link of links) {
        const u = new URL(link);
        u.hash = '';
        if (u.origin === origin && !seen.has(u.href) && !/\.(pdf|zip|jpe?g|png|webp|svg|mp4)$/i.test(u.pathname)) {
          seen.add(u.href);
          queue.push(u.href);
        }
      }
    }
    for (const c of await context.cookies()) {
      const domain = c.domain.replace(/^\./, '');
      const own = host === domain || host.endsWith(`.${domain}`);
      found.set(`c:${c.name}`, { name: c.name, duration: durationOf(c.expires), ...(own ? {} : { host: domain }) });
    }
  } finally {
    await browser.close();
  }
  return [...found.values()]
    .filter((c) => c.name !== cookieName && !matches(trackerNames, c.name))
    .filter((c) => !c.host || !trackerHosts.some((t) => c.host === t || c.host!.endsWith(`.${t}`)))
    .map((c) => ({ ...c, purpose: purposeOf(c.name) ?? { en: '', fi: '', sv: '' } }));
}

const key = (c: NecessaryCookie) => `${c.storage ?? 'cookie'}:${c.name}`;

/** Keeps hand-written purposes, updates durations, adds new entries and reports ones no longer seen. */
export function merge(existing: NecessaryCookie[], found: NecessaryCookie[]) {
  const old = new Map(existing.map((c) => [key(c), c]));
  const now = new Set(found.map(key));
  const added = found.filter((c) => !old.has(key(c)));
  const missing = existing.filter((c) => !now.has(key(c)));
  const list = [
    ...existing.map((c) => {
      const f = found.find((x) => key(x) === key(c));
      return f ? { ...c, duration: f.duration } : c;
    }),
    ...added,
  ];
  return { list, added, missing };
}
