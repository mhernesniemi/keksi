import { describe, expect, it } from 'vitest';
import { cookieTable, renderKeksi } from '../src/render.js';
import { version } from '../src/config.js';

describe('render', () => {
  it('renders nothing when no provider needs consent', () => {
    expect(renderKeksi({})).toBe('');
    expect(renderKeksi({ ga: [] })).toBe('');
  });

  it('lists the providers per category on the first layer', () => {
    const html = renderKeksi({ ga: 'G-1', googleAds: 'AW-1', meta: '1', policyUrl: '/evasteet' });
    expect(html).toContain('<li><strong>Analytiikka:</strong> Google Analytics</li>');
    expect(html).toContain('<li><strong>Markkinointi:</strong> Google Ads, Meta Pixel</li>');
    expect(html).toContain('<a href="/evasteet">Lue lisää</a>');
    expect(html).toContain('data-keksi="reject"');
    expect(html).toMatch(/<section id="keksi-banner"[^>]*hidden>/);
  });

  it('only shows categories in use', () => {
    const html = renderKeksi({ meta: '1' });
    expect(html).not.toContain('name="analytics"');
    expect(html).toContain('name="marketing"');
  });

  it('localizes, overrides texts and adds a nonce', () => {
    const html = renderKeksi({ ga: 'G-1', texts: { sv: { title: 'Kakor och sånt' } } }, { lang: 'sv', nonce: 'n1' });
    expect(html).toContain('Kakor och sånt');
    expect(html).toContain('Godkänn alla');
    expect(html).toContain('<script nonce="n1">');
    expect(html).toContain('<style nonce="n1">');
  });

  it('escapes config values', () => {
    const html = renderKeksi({ ga: '</script><b>', policyUrl: '"><x>' });
    expect(html).not.toContain('</script><b>');
    expect(html).toContain('href="&#34;&#62;&#60;x&#62;"');
  });

  it('generates the cookie policy table', () => {
    const html = cookieTable({ ga: 'G-1', googleAds: 'AW-1', youtube: true });
    expect(html).toContain('<h2>Välttämättömät</h2>');
    expect(html).toContain('<code>keksi</code></td><td>Tallentaa evästevalintasi.</td><td>1 vuosi</td><td>Tämä sivusto</td>');
    expect(html).toContain('<code>_ga</code></td><td>2 vuotta</td>');
    expect(html).toContain('<code>IDE</code></td><td>13 kuukautta</td><td>doubleclick.net</td>');
    expect(html).toContain('(localStorage)');
    expect(html).toContain('tietosuojakehyksen (DPF)');
    expect(html).not.toContain('Meta Pixel');
    expect(cookieTable({ ga: 'G-1' }, { lang: 'en', headingLevel: 3 })).toContain('<h3>Analytics</h3>');
  });

  it('lists necessary cookies with their purpose', () => {
    const config = {
      ga: 'G-1',
      necessary: [
        { name: 'session', duration: 'session', purpose: { fi: 'Kirjautuminen', en: 'Login' } },
        { name: 'theme', duration: 'persistent', storage: 'localStorage' as const, purpose: { fi: '' } },
      ],
    };
    const html = cookieTable(config);
    expect(html).toContain('<th scope="col">Tarkoitus</th>');
    expect(html).toContain('<code>keksi</code></td><td>Tallentaa evästevalintasi.</td><td>1 vuosi</td>');
    expect(html).toContain('<code>session</code></td><td>Kirjautuminen</td><td>istunto</td>');
    expect(html).toContain('<code>theme</code> (localStorage)</td><td></td><td>kunnes poistetaan</td>');
    expect(cookieTable(config, { lang: 'sv' })).toContain('<td>Kirjautuminen</td>');
    expect(renderKeksi(config)).toContain('<code>session</code>');
    expect(version(config)).toBe(version({ ga: 'G-1' }));
  });

  it('discloses PostHog, with the US transfer in the settings for the US host', () => {
    const eu = renderKeksi({ posthog: { key: 'phc_1' } }, { lang: 'en' });
    expect(eu).toContain('<li><strong>Analytics:</strong> PostHog</li>');
    expect(eu).toContain('<code>ph_*_posthog</code>');
    expect(eu.replace(/<script[\s\S]*$/, '')).not.toContain('United States');
    const us = renderKeksi({ posthog: { key: 'phc_1', host: 'https://us.i.posthog.com' } }, { lang: 'en' });
    expect(us).toContain('<p>You can change your choice at any time.');
    expect(us).toContain('<p>Data is transferred to the United States.</p>');
  });

  it('keeps the banner hidden by itself with YouTube only', () => {
    const data = (html: string) => JSON.parse(html.match(/id="keksi-data">(.*?)<\/script>/)![1]!);
    expect(data(renderKeksi({ youtube: true })).banner).toBe(false);
    expect(data(renderKeksi({ youtube: true, ga: 'G-1' })).banner).toBe(true);
  });

  it('discloses custom providers like built-in ones', () => {
    const config = {
      providers: [
        {
          name: 'Leadfeeder',
          company: 'Dealfront GmbH',
          privacyPolicy: 'https://example.com/privacy',
          category: 'marketing' as const,
          purpose: { fi: 'Yritysten tunnistus', en: 'Company identification' },
          cookies: [{ name: '_lfa', duration: '2y' as const }],
        },
      ],
    };
    const html = renderKeksi(config, { lang: 'sv' });
    expect(html).toContain('<li><strong>Marknadsföring:</strong> Leadfeeder</li>');
    expect(html).toContain('<p>Yritysten tunnistus</p>');
    expect(cookieTable(config)).toContain('<code>_lfa</code></td><td>2 vuotta</td>');
    expect(version(config)).not.toBe(version({}));
  });

  it('changes the version when providers or consentVersion change', () => {
    expect(version({ ga: 'G-1' })).toBe(version({ ga: ['G-2', 'G-3'] }));
    expect(version({ ga: 'G-1' })).not.toBe(version({ ga: 'G-1', meta: '1' }));
    expect(version({ ga: 'G-1' })).not.toBe(version({ ga: 'G-1', consentVersion: '2' }));
    const custom = (category: 'analytics' | 'marketing') => ({
      providers: [{ name: 'X', company: 'X', privacyPolicy: '/', category, purpose: 'x', cookies: [] }],
    });
    expect(version(custom('analytics'))).not.toBe(version(custom('marketing')));
  });
});
