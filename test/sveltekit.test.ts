import { describe, expect, it } from 'vitest';
import { keksiHandle } from '../src/sveltekit.js';

const page = (lang: string) => `<html lang="${lang}"><head></head><body data-x="1"><div>app</div></body></html>`;

async function run(html: string, options?: Parameters<typeof keksiHandle>[1]) {
  let out = '';
  await keksiHandle({ ga: 'G-1' }, options)({
    event: {},
    resolve: (_e, opts) => {
      out = opts!.transformPageChunk!({ html, done: true });
    },
  });
  return out;
}

describe('keksiHandle', () => {
  it('renders right after <body> in the page language', async () => {
    const out = await run(page('sv'));
    expect(out).toMatch(/^<html lang="sv"><head><\/head><body data-x="1"><style>/);
    expect(out).toContain('Godkänn alla');
    expect(out).toContain('<div>app</div></body>');
  });

  it('falls back to Finnish and honours an explicit language', async () => {
    expect(await run(page('de'))).toContain('Hyväksy kaikki');
    expect(await run(page('sv'), { lang: 'en' })).toContain('Accept all');
  });
});
