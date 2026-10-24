import { Window as HappyWindow } from 'happy-dom';
import { describe, expect, it, vi } from 'vitest';
import { runtimeData } from '../src/config.js';
import { renderKeksi } from '../src/render.js';
import { boot } from '../src/runtime.js';
import type { KeksiConfig } from '../src/types.js';

const config: KeksiConfig = { ga: 'G-TEST', googleAds: 'AW-1', meta: '42', youtube: true, policyUrl: '/evasteet' };
const data = runtimeData(config, 'fi');

function setup(cookie?: string, body = '') {
  const w = new HappyWindow({ url: 'https://www.example.fi/shop' }) as unknown as Window & typeof globalThis;
  if (cookie) w.document.cookie = `${cookie}; Path=/`;
  w.document.body.innerHTML = renderKeksi(config).replace(/<script[\s\S]*<\/script>/, '') + body;
  const reload = vi.fn();
  Object.defineProperty(w.location, 'reload', { value: reload });
  const api = boot(data, w);
  const scripts = () => [...w.document.head.querySelectorAll('script')].map((s) => s.src);
  const banner = () => w.document.getElementById('keksi-banner')!;
  const click = (sel: string) => (w.document.querySelector(sel) as HTMLElement).click();
  return { w, api, reload, scripts, banner, click };
}

const commands = (w: Window) => (w.dataLayer as IArguments[]).map((a) => [...a].slice(0, 2).join(' '));

describe('runtime', () => {
  it('shows the banner and loads nothing without a decision', () => {
    const { w, api, scripts, banner } = setup();
    expect(banner().hidden).toBe(false);
    expect(api.consent).toBeNull();
    expect(scripts()).toEqual([]);
    expect(commands(w)).toEqual(['consent default']);
  });

  it('loads Google and Meta after accepting all', () => {
    const { w, api, scripts, banner, click } = setup();
    const changes: unknown[] = [];
    w.document.addEventListener('keksi:change', (e) => changes.push((e as CustomEvent).detail));
    click('#keksi-banner [data-keksi=accept]');
    expect(banner().hidden).toBe(true);
    expect(api.consent).toEqual({ analytics: true, marketing: true });
    expect(changes).toEqual([{ analytics: true, marketing: true }]);
    expect(scripts()).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-TEST',
      'https://connect.facebook.net/en_US/fbevents.js',
    ]);
    expect(commands(w)).toEqual(['consent default', 'consent update', 'js ' + String((w.dataLayer as IArguments[])[2]![1]), 'config G-TEST', 'config AW-1']);
    expect(w.fbq!.queue.map((a) => [...a].join(' '))).toEqual(['init 42', 'track PageView']);
    expect(w.document.cookie).toMatch(new RegExp(`keksi=${data.v}\\.\\w+\\.[0-9a-f]{16}\\.am`));
  });

  it('loads only analytics when only analytics is chosen', () => {
    const { w, api, scripts, click } = setup();
    api.open();
    (w.document.querySelector('[name=analytics]') as HTMLInputElement).checked = true;
    click('[data-keksi=save]');
    expect(api.consent).toEqual({ analytics: true, marketing: false });
    expect(scripts()).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST']);
    expect(commands(w)).toContain('config G-TEST');
    expect(commands(w)).not.toContain('config AW-1');
    const update = (w.dataLayer as IArguments[])[1]![2];
    expect(update).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' });
  });

  it('puts events queued before consent after the config', () => {
    const { w, api } = setup();
    w.gtag!('event', 'generate_lead');
    w.fbq!('track', 'Lead');
    api.acceptAll();
    expect(commands(w).slice(-1)).toEqual(['event generate_lead']);
    expect(w.fbq!.queue.map((a) => [...a].join(' '))).toEqual(['init 42', 'track PageView', 'track Lead']);
  });

  it('adds marketing later without reloading', () => {
    const { w, api, reload, scripts } = setup();
    api.save({ analytics: true });
    api.save({ marketing: true });
    expect(reload).not.toHaveBeenCalled();
    expect(scripts()).toHaveLength(2);
    expect(commands(w).filter((c) => c.startsWith('config'))).toEqual(['config G-TEST', 'config AW-1']);
  });

  it('loads at once for a returning visitor', () => {
    const { scripts, banner } = setup(`keksi=${data.v}.x.abc.a`);
    expect(banner().hidden).toBe(true);
    expect(scripts()).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST']);
  });

  it('asks again when the providers changed', () => {
    const { api, banner, scripts } = setup('keksi=old.x.abc.am');
    expect(api.consent).toBeNull();
    expect(banner().hidden).toBe(false);
    expect(scripts()).toEqual([]);
  });

  it('deletes stored data and reloads on withdrawal', () => {
    const w0 = setup(`keksi=${data.v}.x.abc.am`);
    w0.w.document.cookie = '_ga=GA1.1; Path=/';
    w0.w.document.cookie = '_ga_TEST=GS1; Path=/';
    w0.w.document.cookie = '_fbp=fb.1; Path=/';
    w0.w.document.cookie = 'session=keep; Path=/';
    w0.w.localStorage.setItem('_gcl_ls', '1');
    w0.api.rejectAll();
    // happy-dom keeps expired cookies with empty values; the e2e tests check real deletion.
    const left = w0.w.document.cookie.split('; ').filter((c) => !c.endsWith('='));
    expect(left.map((c) => c.split('=')[0]).sort()).toEqual(['keksi', 'session']);
    expect(w0.w.localStorage.getItem('_gcl_ls')).toBeNull();
    expect(w0.reload).toHaveBeenCalledOnce();
    expect(w0.api.consent).toEqual({ analytics: false, marketing: false });
  });

  it('opens the dialog with the current choices', () => {
    const { w, click } = setup(`keksi=${data.v}.x.abc.m`, '<a href="#" data-keksi-open>Evästeasetukset</a>');
    click('a[data-keksi-open]');
    const dialog = w.document.getElementById('keksi-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect((dialog.querySelector('[name=analytics]') as HTMLInputElement).checked).toBe(false);
    expect((dialog.querySelector('[name=marketing]') as HTMLInputElement).checked).toBe(true);
  });

  it('shows a placeholder for YouTube and loads the video on click', () => {
    const { w } = setup(undefined, '<keksi-youtube video="abc123" label="Esittely"></keksi-youtube>');
    const el = w.document.querySelector('keksi-youtube')!;
    expect(el.querySelector('iframe')).toBeNull();
    const button = el.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Näytä video: Esittely');
    button.click();
    expect(el.querySelector('iframe')!.src).toBe('https://www.youtube-nocookie.com/embed/abc123?autoplay=1');
    expect(w.document.head.querySelectorAll('script')).toHaveLength(0);
  });

  it('embeds YouTube directly with marketing consent', () => {
    const { w, api } = setup(undefined, '<keksi-youtube video="abc123"></keksi-youtube>');
    api.save({ marketing: true });
    expect(w.document.querySelector('keksi-youtube iframe')!.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    );
  });
});

describe('posthog', () => {
  const ph: KeksiConfig = { posthog: { key: 'phc_test' } };
  const phData = runtimeData(ph, 'en');

  function boot2(cookie?: string) {
    const w = new HappyWindow({ url: 'https://www.example.fi/' }) as unknown as Window & typeof globalThis;
    if (cookie) w.document.cookie = `${cookie}; Path=/`;
    Object.defineProperty(w.location, 'reload', { value: vi.fn() });
    const api = boot(phData, w);
    return { w, api, scripts: () => [...w.document.head.querySelectorAll('script')].map((s) => s.src) };
  }

  it('queues calls until analytics consent, then loads from the EU host', () => {
    const { w, api, scripts } = boot2();
    (w.posthog!.capture as (...a: unknown[]) => void)('signup', { plan: 'pro' });
    expect(scripts()).toEqual([]);
    api.save({ analytics: true });
    expect(scripts()).toEqual(['https://eu-assets.i.posthog.com/static/array.js']);
    expect(w.posthog!._i).toEqual([['phc_test', { api_host: 'https://eu.i.posthog.com', defaults: '2026-08-30' }, 'posthog']]);
    expect([...w.posthog!]).toEqual([['capture', 'signup', { plan: 'pro' }]]);
  });

  it('stays unloaded with marketing only', () => {
    const { api, scripts } = boot2();
    api.save({ marketing: true });
    expect(scripts()).toEqual([]);
  });

  it('deletes its cookie and storage on withdrawal', () => {
    const { w, api } = boot2(`keksi=${phData.v}.x.abc.a`);
    w.document.cookie = 'ph_phc_test_posthog=%7B%7D; Path=/';
    w.localStorage.setItem('ph_phc_test_posthog', '{}');
    w.sessionStorage.setItem('ph_phc_test_window_id', 'w');
    w.localStorage.setItem('other', 'keep');
    api.rejectAll();
    expect(w.document.cookie).not.toMatch(/ph_phc_test_posthog=%7B/);
    expect(w.localStorage.getItem('ph_phc_test_posthog')).toBeNull();
    expect(w.sessionStorage.getItem('ph_phc_test_window_id')).toBeNull();
    expect(w.localStorage.getItem('other')).toBe('keep');
  });
});
