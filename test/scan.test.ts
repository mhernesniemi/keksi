import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { durationOf, merge, purposeOf, scan } from '../src/scan.js';

describe('scan helpers', () => {
  it('rounds lifetimes to policy units', () => {
    const now = 1_000_000;
    expect(durationOf(-1, now)).toBe('session');
    expect(durationOf(now + 30 * 60, now)).toBe('30min');
    expect(durationOf(now + 7 * 86400, now)).toBe('7d');
    expect(durationOf(now + 90 * 86400, now)).toBe('3mo');
    expect(durationOf(now + 400 * 86400, now)).toBe('1y');
  });

  it('knows common framework cookies', () => {
    expect(purposeOf('NEXT_LOCALE')).toMatchObject({ en: 'Remembers your language.' });
    expect(purposeOf('sveltekit:scroll')).toBeDefined();
    expect(purposeOf('mystery')).toBeUndefined();
  });

  it('keeps written purposes and reports changes', () => {
    const { list, added, missing } = merge(
      [
        { name: 'sid', duration: '1d', purpose: { en: 'Login' } },
        { name: 'old', duration: 'session', purpose: 'Gone' },
      ],
      [
        { name: 'sid', duration: '7d', purpose: { en: '' } },
        { name: 'new', duration: 'session', purpose: { en: '' } },
      ],
    );
    expect(list).toEqual([
      { name: 'sid', duration: '7d', purpose: { en: 'Login' } },
      { name: 'old', duration: 'session', purpose: 'Gone' },
      { name: 'new', duration: 'session', purpose: { en: '' } },
    ]);
    expect(added.map((c) => c.name)).toEqual(['new']);
    expect(missing.map((c) => c.name)).toEqual(['old']);
  });
});

describe('scan', () => {
  it('lists what the site stores without consent, minus keksi and trackers', async () => {
    const server = createServer((req, res) => {
      const cookies =
        req.url === '/about'
          ? ['csrftoken=abc; Path=/; Max-Age=604800']
          : ['session=1; Path=/; HttpOnly', 'keksi=x; Path=/', '_ga=GA1; Path=/'];
      res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': cookies });
      res.end(`<a href="/about">About</a><script>localStorage.setItem('theme', 'dark')</script>`);
    });
    await new Promise<void>((r) => server.listen(0, r));
    const url = `http://localhost:${(server.address() as AddressInfo).port}/`;
    try {
      const found = await scan(url);
      expect(found.map((c) => [c.name, c.duration, c.storage ?? 'cookie']).sort()).toEqual([
        ['csrftoken', '7d', 'cookie'],
        ['session', 'session', 'cookie'],
        ['theme', 'persistent', 'localStorage'],
      ]);
      expect(found.find((c) => c.name === 'csrftoken')!.purpose).toMatchObject({ en: 'Protects forms against forgery.' });
      expect(found.find((c) => c.name === 'theme')!.purpose).toEqual({ en: '', fi: '', sv: '' });
    } finally {
      server.close();
    }
  }, 30_000);
});
