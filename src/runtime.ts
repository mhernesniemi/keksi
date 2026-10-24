import type { Category, Consent, RuntimeData } from './types.js';

export interface KeksiApi {
  /** `null` until the visitor decides. */
  readonly consent: Consent | null;
  open(): void;
  /** Unlisted categories keep their current value. */
  save(consent: Partial<Consent>): void;
  acceptAll(): void;
  rejectAll(): void;
  /** Re-reads the banner from the DOM, e.g. after a client-side page swap. */
  sync(): void;
}

type Queue = ((...a: unknown[]) => void) & { queue: IArguments[]; callMethod?: (...a: unknown[]) => void };

declare global {
  interface Window {
    keksi?: KeksiApi;
    dataLayer?: unknown[];
    gtag?: (...a: unknown[]) => void;
    fbq?: Queue;
    _fbq?: Queue;
  }
}

const CATS: Category[] = ['analytics', 'marketing'];
const NONE: Consent = { analytics: false, marketing: false };

// gtag.js and fbevents.js only accept real `arguments` objects in their queues.
function args(..._: unknown[]): IArguments {
  return arguments;
}

export function boot(d: RuntimeData, w: Window & typeof globalThis = window): KeksiApi {
  if (typeof w.keksi?.sync === 'function') {
    w.keksi.sync();
    return w.keksi;
  }
  const doc = w.document;
  const $ = <T extends HTMLElement>(id: string) => doc.getElementById(id) as T | null;
  let state = read();
  let gtagLoaded = false;
  let metaLoaded = false;
  const configured = new Set<string>();

  const consentDefault = args('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  if (d.ga.length || d.ads.length) {
    const dl = (w.dataLayer ??= []);
    w.gtag = function () {
      dl.push(arguments);
    };
    dl.push(consentDefault);
  }
  if (d.meta.length) {
    const f = function () {
      f.callMethod ? f.callMethod.apply(f, [...arguments]) : f.queue.push(arguments);
    } as Queue;
    Object.assign(f, { push: f, loaded: true, version: '2.0', queue: [] });
    w.fbq = w._fbq = f;
  }

  function read(): { id: string; c: Consent } | null {
    const raw = doc.cookie
      .split('; ')
      .find((c) => c.startsWith(`${d.name}=`))
      ?.slice(d.name.length + 1);
    const [v, , id, flags] = raw?.split('.') ?? [];
    if (v !== d.v || !id || !flags) return null;
    return { id, c: { analytics: flags.includes('a'), marketing: flags.includes('m') } };
  }

  function write(c: Consent): { id: string; c: Consent } {
    const id =
      state?.id ?? Array.from(w.crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const flags = (c.analytics ? 'a' : '') + (c.marketing ? 'm' : '') || '-';
    doc.cookie =
      `${d.name}=${d.v}.${Date.now().toString(36)}.${id}.${flags}; Path=/; Max-Age=${d.days * 86400}; SameSite=Lax` +
      (d.domain ? `; Domain=${d.domain}` : '') +
      (w.location.protocol === 'https:' ? '; Secure' : '');
    return { id, c };
  }

  function script(src: string): void {
    const s = doc.createElement('script');
    s.async = true;
    s.src = src;
    doc.head.append(s);
  }

  function load(c: Consent): void {
    const ids = [...(c.analytics ? d.ga : []), ...(c.marketing ? d.ads : [])].filter((id) => !configured.has(id));
    if (ids.length) {
      const m = c.marketing ? 'granted' : 'denied';
      const cmds = [
        args('consent', 'update', {
          analytics_storage: c.analytics ? 'granted' : 'denied',
          ad_storage: m,
          ad_user_data: m,
          ad_personalization: m,
        }),
      ];
      if (!configured.size) cmds.push(args('js', new Date()));
      for (const id of ids) cmds.push(args('config', id)), configured.add(id);
      if (gtagLoaded) for (const cmd of cmds) w.dataLayer!.push(cmd);
      else {
        // Ahead of any events the page queued before consent, so they reach the configured tags.
        const dl = w.dataLayer!;
        dl.splice(dl.indexOf(consentDefault) + 1, 0, ...cmds);
        script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids[0]!)}`);
        gtagLoaded = true;
      }
    }
    if (c.marketing && d.meta.length && !metaLoaded) {
      metaLoaded = true;
      w.fbq!.queue.unshift(...d.meta.map((id) => args('init', id)), args('track', 'PageView'));
      script('https://connect.facebook.net/en_US/fbevents.js');
    }
    if (c.marketing) for (const el of doc.querySelectorAll<YouTube>('keksi-youtube')) el.show(true);
  }

  function clean(cats: Category[]): void {
    const names = cats.flatMap((c) => d.del[c]);
    const hit = (n: string) => names.some((p) => (p.endsWith('*') ? n.startsWith(p.slice(0, -1)) : n === p));
    const parts = w.location.hostname.split('.');
    const domains = ['', ...parts.map((_, i) => `; Domain=${parts.slice(i).join('.')}`)];
    for (const c of doc.cookie.split('; ')) {
      const n = c.split('=')[0]!;
      if (hit(n)) for (const dm of domains) doc.cookie = `${n}=; Max-Age=0; Path=/${dm}`;
    }
    try {
      for (const k of Object.keys(w.localStorage)) if (hit(k)) w.localStorage.removeItem(k);
    } catch {}
  }

  function save(c: Consent): void {
    const prev = state?.c;
    state = write(c);
    sync();
    doc.dispatchEvent(new w.CustomEvent('keksi:change', { detail: { ...c } }));
    clean(CATS.filter((k) => !c[k]));
    // Loaded tags can't be unloaded, so a withdrawal starts a clean page.
    if (CATS.some((k) => prev?.[k] && !c[k])) w.location.reload();
    else load(c);
  }

  function sync(): void {
    const banner = $('keksi-banner');
    if (banner) banner.hidden = !!state;
  }

  function open(): void {
    const dialog = $<HTMLDialogElement>('keksi-dialog');
    if (!dialog) return;
    for (const k of CATS) {
      const input = dialog.querySelector<HTMLInputElement>(`[name=${k}]`);
      if (input) input.checked = !!state?.c[k];
    }
    dialog.showModal();
  }

  doc.addEventListener('click', (e) => {
    const el = (e.target as Element).closest?.('[data-keksi],[data-keksi-open]');
    if (!el) return;
    if (el.hasAttribute('data-keksi-open')) {
      e.preventDefault();
      return open();
    }
    const action = el.getAttribute('data-keksi');
    if (action === 'accept') save({ analytics: true, marketing: true });
    else if (action === 'reject') save(NONE);
    else if (action === 'save') {
      const checked = (k: Category) => !!$('keksi-dialog')?.querySelector<HTMLInputElement>(`[name=${k}]`)?.checked;
      save({ analytics: checked('analytics'), marketing: checked('marketing') });
    }
  });
  doc.addEventListener('astro:after-swap', sync);

  class YouTube extends w.HTMLElement {
    connectedCallback() {
      this.show(!!state?.c.marketing);
    }

    show(load: boolean, autoplay = false) {
      const id = encodeURIComponent(this.getAttribute('video') ?? '');
      const label = this.getAttribute('label');
      if (load) {
        if (this.querySelector('iframe')) return;
        const f = doc.createElement('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${id}${autoplay ? '?autoplay=1' : ''}`;
        f.title = label ?? 'YouTube';
        f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        this.replaceChildren(f);
        if (autoplay) f.focus();
        return;
      }
      const box = doc.createElement('div');
      box.className = 'keksi-yt';
      const poster = this.getAttribute('poster');
      if (poster) box.style.background = `linear-gradient(#000a,#000a),center/cover url(${JSON.stringify(poster)})`;
      const text = doc.createElement('p');
      text.textContent = d.t.ytText;
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = d.t.ytButton;
      if (label) button.setAttribute('aria-label', `${d.t.ytButton}: ${label}`);
      button.onclick = () => this.show(true, true);
      const link = doc.createElement('a');
      link.href = `https://www.youtube.com/watch?v=${id}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = d.t.ytOpen;
      box.append(text, button, link);
      this.replaceChildren(box);
    }
  }
  if (d.yt && !w.customElements.get('keksi-youtube')) w.customElements.define('keksi-youtube', YouTube);

  const api: KeksiApi = {
    get consent() {
      return state ? { ...state.c } : null;
    },
    open,
    save: (c) => save({ ...(state?.c ?? NONE), ...c }),
    acceptAll: () => save({ analytics: true, marketing: true }),
    rejectAll: () => save(NONE),
    sync,
  };
  w.keksi = api;
  sync();
  if (state) load(state.c);
  return api;
}
