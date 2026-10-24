import { activeProviders, categoriesOf, runtimeData, textsFor } from './config.js';
import type { Texts } from './i18n.js';
import { css } from './styles.js';
import type { Category, Duration, KeksiConfig, Locale, NecessaryCookie } from './types.js';

declare const __RUNTIME__: string;

export interface RenderOptions {
  lang?: Locale;
  /** For a CSP with nonces; applied to the inline `<style>` and `<script>`. */
  nonce?: string;
}

const e = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Banner, settings dialog and runtime. Place it right after `<body>`. Empty when no provider needs consent. */
export function renderKeksi(config: KeksiConfig, { lang = 'fi', nonce }: RenderOptions = {}): string {
  const cats = categoriesOf(config);
  if (!cats.length) return '';
  const t = textsFor(config, lang);
  const active = activeProviders(config);
  const policy = typeof config.policyUrl === 'string' ? config.policyUrl : config.policyUrl?.[lang];
  const n = nonce ? ` nonce="${e(nonce)}"` : '';
  const btn = (action: string, label: string, type = 'button') =>
    `<button type="${type}" class="keksi-btn" data-keksi="${action}">${e(label)}</button>`;
  const uses = cats
    .map((c) => `<li><strong>${e(t[c])}:</strong> ${e(active.filter((p) => p.category === c).map((p) => p.name).join(', '))}</li>`)
    .join('');
  const json = JSON.stringify(runtimeData(config, lang)).replace(/</g, '\\u003c');

  return (
    `<style${n}>${css}</style>` +
    `<section id="keksi-banner" class="keksi" aria-labelledby="keksi-title" hidden>` +
    `<h2 id="keksi-title">${e(t.title)}</h2><p>${e(t.intro)}</p><ul>${uses}</ul>` +
    `<p>${e(t.transfer)}${policy ? ` <a href="${e(policy)}">${e(t.more)}</a>` : ''}</p>` +
    `<div class="keksi-actions">${btn('accept', t.accept)}${btn('reject', t.reject)}` +
    `<button type="button" class="keksi-btn" data-keksi-open>${e(t.settings)}</button></div></section>` +
    `<dialog id="keksi-dialog" class="keksi-dialog" aria-labelledby="keksi-dialog-title"><form method="dialog">` +
    `<div class="keksi-head"><h2 id="keksi-dialog-title">${e(t.settingsTitle)}</h2>` +
    `<button class="keksi-close" aria-label="${e(t.close)}">×</button></div>` +
    sections(config, lang, 3, true) +
    `<div class="keksi-actions">${btn('save', t.save, 'submit')}${btn('accept', t.accept, 'submit')}${btn('reject', t.reject, 'submit')}</div>` +
    `</form></dialog>` +
    `<script type="application/json" id="keksi-data">${json}</script><script${n}>${__RUNTIME__}</script>`
  );
}

export interface CookieTableOptions {
  lang?: Locale;
  headingLevel?: 2 | 3 | 4;
}

/** Cookie policy section generated from the same data as the banner. */
export function cookieTable(config: KeksiConfig, { lang = 'fi', headingLevel = 2 }: CookieTableOptions = {}): string {
  return `<div class="keksi-policy">${sections(config, lang, headingLevel, false)}</div>`;
}

type Row = Omit<NecessaryCookie, 'purpose'> & { purpose?: string };

interface Item {
  name: string;
  purpose?: string;
  cookies: Row[];
  company?: string;
  privacyPolicy?: string;
  transfer?: 'dpf';
}

function sections(config: KeksiConfig, lang: Locale, h: number, dialog: boolean): string {
  const t = textsFor(config, lang);
  const active = activeProviders(config);
  const { name, days } = runtimeData(config, lang);
  const local = (v?: NecessaryCookie['purpose']) => (typeof v === 'object' ? (v[lang] ?? Object.values(v).find(Boolean)) : v);
  const site: Item = {
    name: t.thisSite,
    cookies: [
      { name, duration: days % 365 ? `${days}d` : `${days / 365}y`, purpose: t.consentPurpose },
      ...(config.necessary ?? []).map((c) => ({ ...c, purpose: local(c.purpose) })),
    ],
  };

  return (['necessary', ...categoriesOf(config)] as const)
    .map((c) => {
      const items: Item[] =
        c === 'necessary'
          ? [site]
          : active.filter((p) => p.category === c).map((p) => ({ ...p, purpose: p.purpose[lang] }));
      const head =
        c === 'necessary'
          ? `<h${h}>${e(t.necessary)}</h${h}><span>${e(t.alwaysOn)}</span>`
          : dialog
            ? `<h${h}><label for="keksi-c-${c}">${e(t[c])}</label></h${h}>` +
              `<input type="checkbox" role="switch" id="keksi-c-${c}" name="${c}" aria-describedby="keksi-i-${c}">`
            : `<h${h}>${e(t[c])}</h${h}>`;
      const list = items
        .map(
          (p) =>
            `<div class="keksi-provider"><h${h + 1}>${e(p.name)}</h${h + 1}>${p.purpose ? `<p>${e(p.purpose)}</p>` : ''}` +
            (p.company && p.privacyPolicy
              ? `<p>${e(p.company)} · <a href="${e(p.privacyPolicy)}" target="_blank" rel="noopener">${e(t.privacyPolicy)}</a></p>` +
                (p.transfer ? `<p>${e(t.dpf)}</p>` : '')
              : '') +
            table(p.cookies, t) +
            `</div>`,
        )
        .join('');
      const body = dialog ? `<details><summary>${e(t.providers)} (${items.length})</summary>${list}</details>` : list;
      return (
        `<section class="keksi-cat"><div class="keksi-cat-head">${head}</div>` +
        `<p id="keksi-i-${c}">${e(t[`${c as Category | 'necessary'}Info`])}</p>${body}</section>`
      );
    })
    .join('');
}

function table(cookies: Row[], t: Texts): string {
  const purpose = cookies.some((c) => c.purpose);
  const rows = cookies
    .map(
      (c) =>
        `<tr><td><code>${e(c.name)}</code>${c.storage ? ` (${c.storage})` : ''}</td>` +
        (purpose ? `<td>${e(c.purpose ?? '')}</td>` : '') +
        `<td>${e(duration(c.duration, t))}</td><td>${e(c.host ?? t.thisSite)}</td></tr>`,
    )
    .join('');
  return (
    `<table><thead><tr><th scope="col">${e(t.name)}</th>` +
    (purpose ? `<th scope="col">${e(t.purpose)}</th>` : '') +
    `<th scope="col">${e(t.duration)}</th><th scope="col">${e(t.setBy)}</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

export function duration(d: Duration | string, t: Texts): string {
  if (d === 'session' || d === 'persistent') return t[d];
  const m = d.match(/^(\d+)(y|mo|d|min)$/);
  if (!m) return d;
  const [, n, unit] = m;
  const [one, many] = t[unit as 'y' | 'mo' | 'd' | 'min'].split('|');
  return `${n} ${n === '1' ? one : many}`;
}
