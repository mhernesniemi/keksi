import { renderKeksi } from './render.js';
import type { KeksiConfig, Locale } from './types.js';

const LOCALES: Locale[] = ['fi', 'sv', 'en'];

interface Options {
  /** Defaults to the page's `<html lang>`, then `fi`. */
  lang?: Locale;
  nonce?: string;
}

type Resolve = (event: any, opts?: { transformPageChunk?: (input: { html: string; done: boolean }) => string }) => any;

/** SvelteKit `handle` hook that renders keksi right after `<body>`, outside the Svelte root. */
export function keksiHandle(config: KeksiConfig, { lang, nonce }: Options = {}) {
  const cache = new Map<Locale, string>();
  const render = (l: Locale) => cache.get(l) ?? cache.set(l, renderKeksi(config, { lang: l, nonce })).get(l)!;

  return ({ event, resolve }: { event: any; resolve: Resolve }) => {
    let pageLang = lang;
    return resolve(event, {
      transformPageChunk: ({ html }) => {
        pageLang ??= LOCALES.find((l) => new RegExp(`<html[^>]*\\slang="${l}`).test(html));
        return html.replace(/<body[^>]*>/, (body) => body + render(pageLang ?? 'fi'));
      },
    });
  };
}
