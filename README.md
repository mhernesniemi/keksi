# keksi

Lean cookie consent for Astro, SvelteKit and other server-rendered sites. Built around Finnish and EU law, with
texts in English, Finnish and Swedish.

keksi loads the trackers itself, and only after consent. You don't add their script tags: you put their ids in the
config, so there's nothing to block.

- Google Analytics 4, Google Ads, Meta Pixel and YouTube. The short list is deliberate.
- About 5 KB gzipped, inline. No extra requests, no dependencies.
- Rendered on the server. Works on static pages, with no layout shift.
- The cookie policy table is generated from the same data.

## Setup

```sh
pnpm add keksi
```

```ts
// keksi.config.ts
import { defineConfig } from 'keksi';

export default defineConfig({
  ga: 'G-XXXXXXX',
  googleAds: 'AW-123456789',
  meta: '1234567890',
  youtube: true,
  policyUrl: '/evasteet',
});
```

**Astro:** add the component right after `<body>` in your layout.

```astro
---
import { Keksi } from 'keksi/astro';
import config from '../../keksi.config';
---
<body>
  <Keksi config={config} />
  ...
</body>
```

**SvelteKit:** add the hook. It renders keksi outside the Svelte root and keeps it out of the client bundle.

```ts
// src/hooks.server.ts
import { keksiHandle } from 'keksi/sveltekit';
import config from '../keksi.config';

export const handle = keksiHandle(config);
```

Any element with `data-keksi-open` reopens the settings. Put one in the footer:

```html
<button type="button" data-keksi-open>Evästeasetukset</button>
```

**Necessary cookies** from your framework or own code, such as a session, are listed under "Necessary". Find them
with the scanner, which visits the site without consent:

```sh
npx keksi scan https://staging.example.fi
```

It writes `keksi.cookies.json`, with purposes for common cookies filled in. Write the rest, then import the file:

```ts
import necessary from './keksi.cookies.json' with { type: 'json' };

export default defineConfig({ ga: 'G-XXXXXXX', necessary });
```

Rerunning keeps your purposes. `keksi scan <url> --check` fails when there are new entries, for CI. The scanner only
lists; it never blocks anything. Cookies set after login aren't visited, so add those by hand.

**Cookie policy page:** `<CookieTable config={config} />` from `keksi/astro`, or `cookieTable(config)` for an HTML
string.

## Tracking events

`gtag()` and `fbq()` are always defined, so you can call them anytime:

```ts
gtag('event', 'generate_lead');
fbq('track', 'Lead');
```

- Calls made before consent are queued. They're sent only if the visitor consents on that page.
- Google gets Consent Mode v2 signals (basic mode).
- GA4 and Meta Pixel track single-page navigation themselves.

## YouTube

```html
<keksi-youtube video="aqz-KE-bpKQ" label="Esittelyvideo" poster="/img/poster.jpg"></keksi-youtube>
```

- Shows a placeholder until the visitor clicks it, then loads that one video from `youtube-nocookie.com`.
- With marketing consent, videos load directly.
- `poster` is optional and should be self-hosted. Thumbnails from YouTube would contact Google before consent.

## API

```ts
window.keksi.consent; // { analytics, marketing } or null
window.keksi.open();
window.keksi.save({ marketing: true });
window.keksi.acceptAll();
window.keksi.rejectAll();
document.addEventListener('keksi:change', (e) => e.detail);
```

## Testing

```ts
import { consentCookie, watchTracking } from 'keksi/playwright';

test('nothing tracks before consent', async ({ page }) => {
  const tracking = watchTracking(page, config, { allow: ['session'] });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await tracking.check(); // throws on tracker requests or stored data
});

// Skip the banner in other tests
await context.addCookies([consentCookie(config, baseURL, { analytics: true })]);
```

## Customizing

- **Styles** have zero specificity, so your CSS wins. Variables: `--keksi-bg`, `--keksi-fg`, `--keksi-line`,
  `--keksi-radius`, `--keksi-focus`.
- **Language:** follows the page's language, otherwise Finnish. Pass `lang` to set it.
- **Texts:** `texts: { fi: { intro: '…' } }`.
- **CSP:** pass `nonce`.
- **Other frameworks:** `renderKeksi(config, { lang })` returns the HTML to put after `<body>`.
- **Consent cookie:** `cookie: { name, domain, days }`. Kept for 365 days by default.

## Legal basis

| Requirement | Basis | keksi |
|---|---|---|
| No non-essential storage before consent | Act 917/2014 §205 | Trackers load only after consent |
| Purpose, duration and third parties disclosed | §205, CJEU *Planet49* | Providers on the banner, cookies and durations in settings and on the policy page |
| Separate choices, rejecting as easy as accepting | GDPR Art. 4(11), 7; Traficom 2024 | A switch per category, "Reject all" on the banner |
| Withdrawal is easy and has real effect | GDPR Art. 7(3) | Deletes the category's cookies and localStorage on your domain, then reloads |
| Consent can be demonstrated | GDPR Art. 7(1) | Consent cookie with id, time and version. Adding or removing a provider asks again |
| Transfers outside the EU disclosed | GDPR Art. 13(1)(f) | DPF transfer stated per provider |

Cookies that Google and Meta set on their own domains can't be deleted from your site. The policy page lists them as
third-party cookies.

## Development

```sh
pnpm install
pnpm build      # prints the runtime size
pnpm test
pnpm test:e2e   # Astro and SvelteKit examples
```

To add a provider: add its data to `src/providers.ts`, a config key with the same id to `KeksiConfig`, and its
loading to `load()` in `src/runtime.ts`.
