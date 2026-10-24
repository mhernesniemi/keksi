# keksi

Lean cookie consent for Astro, SvelteKit and other server-rendered sites, covering Google Analytics 4, Google Ads,
Meta Pixel and YouTube embeds. Texts in Finnish, Swedish and English, built around Finnish and EU law.

The provider list is deliberately short. keksi supports a few common trackers well rather than every tracker
loosely, and new providers are added when they're needed.

keksi loads the trackers itself, and only after consent. You don't add their script tags; you write their ids into
the config. Nothing has to be blocked or intercepted, because nothing is on the page until keksi adds it.

- About 5 KB gzipped per page, inline: banner, settings, styles and a 2.4 KB runtime. No requests, no dependencies.
- Rendered on the server, works with static pages, no layout shift. With no providers configured it renders nothing.
- The cookie policy table comes from the same data, so it can't drift from what the site loads.

## Setup

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

Render it right after `<body>`, and give the footer a way to reopen the settings:

```astro
---
// Astro layout
import { renderKeksi } from 'keksi';
import config from '../../keksi.config';
---
<body>
  <Fragment set:html={renderKeksi(config, { lang: 'fi' })} />
  ...
  <button type="button" data-keksi-open>Evästeasetukset</button>
</body>
```

```ts
// SvelteKit: src/hooks.server.ts. Keeps keksi out of the client bundle and outside the Svelte root.
import type { Handle } from '@sveltejs/kit/hooks';
import { renderKeksi } from 'keksi';
import config from '../keksi.config';

const keksi = renderKeksi(config, { lang: 'fi' });

export const handle: Handle = ({ event, resolve }) =>
  resolve(event, { transformPageChunk: ({ html }) => html.replace(/<body([^>]*)>/, `<body$1>${keksi}`) });
```

Policy page:

```astro
<Fragment set:html={cookieTable(config, { lang: 'fi' })} />
```

In SvelteKit, return `cookieTable(...)` from a prerendered `+page.server.ts` and render it with `{@html}`.

## Using the trackers

`gtag()` and `fbq()` exist from the start, so page code can call them at any time:

```ts
gtag('event', 'generate_lead');
fbq('track', 'Lead');
```

Calls made before consent wait in the queue. If the visitor consents on that page, they're sent after the tags are
configured. Otherwise they're never sent. Single-page navigation is tracked by GA4 and Meta Pixel themselves.

Google gets Consent Mode v2 signals: everything `denied` by default, updated to match the choice. Only basic mode,
because gtag.js isn't loaded at all before consent.

## YouTube

```html
<keksi-youtube video="aqz-KE-bpKQ" label="Esittelyvideo"></keksi-youtube>
```

The element shows a placeholder with a "Show video" button, plus an "Open on YouTube" link. The click loads that
one video from `youtube-nocookie.com`. With marketing consent, videos load directly. Add `poster="/img/poster.jpg"`
for a self-hosted thumbnail. Thumbnails from YouTube are not used, since those requests would go to Google before
consent.

## API

```ts
window.keksi.consent; // { analytics, marketing } or null
window.keksi.open();
window.keksi.save({ marketing: true });
window.keksi.acceptAll();
window.keksi.rejectAll();
document.addEventListener('keksi:change', (e) => e.detail);
```

## Withdrawal

When a category is withdrawn, keksi deletes that category's cookies and localStorage keys on this site, on every
parent domain, and then reloads, because tags that are already running can't be unloaded. Cookies set by Google or
Meta on their own domains (`IDE`, `fr`, YouTube's) can't be deleted from your site. They are listed on the policy page
as third-party cookies.

## Testing

Use these in your own Playwright tests. The examples use them too:

```ts
import { consentCookie, watchTracking } from 'keksi/playwright';

test('nothing tracks before consent', async ({ page }) => {
  const tracking = watchTracking(page, config, { allow: ['session'] });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await tracking.check(); // throws on requests to Google, Meta or YouTube, or on stored data
});

// Skip the banner in other tests
await context.addCookies([consentCookie(config, baseURL, { analytics: true })]);
```

## Theming and texts

The styles have zero specificity, so any site rule wins. Set `--keksi-bg`, `--keksi-fg`, `--keksi-line`,
`--keksi-radius` and `--keksi-focus`, or style `.keksi`, `.keksi-dialog` and `.keksi-btn`. Override texts per
language with `texts: { fi: { intro: '…' } }`. Pass `nonce` to `renderKeksi` for a CSP with nonces.

## Consent record

The `keksi` cookie holds the version, time, a random id and the choices, for 365 days (`cookie.days`). The version
changes when a provider is added or removed, so everyone is asked again. Ids and texts can change under the same
version.

## What the law requires and how keksi meets it

| Requirement | Basis | keksi |
|---|---|---|
| No non-essential storage or access before consent | Act 917/2014 §205 | Trackers aren't loaded until consent |
| Purpose, duration and third parties disclosed | §205, CJEU *Planet49* | Providers on the first layer, cookies and durations in settings and on the policy page |
| Separate choices per purpose, rejecting as easy as accepting | GDPR Art. 4(11), 7; Traficom 2024 decisions | One switch per category, "Reject all" on the first layer, same button style |
| Withdrawal as easy as consent, with real effect | GDPR Art. 7(3) | `data-keksi-open` anywhere, deletes stored data |
| Able to show consent was given | GDPR Art. 7(1) | Consent cookie with id, time and version |
| Transfers outside the EU disclosed | GDPR Art. 13(1)(f) | DPF transfer stated per provider |

## Adding a provider

Add its disclosure and cookies to `src/providers.ts`, a config key with the same id to `KeksiConfig`, and its loading
to `load()` in `src/runtime.ts`.

## Development

```sh
pnpm install
pnpm build       # dist/, prints the runtime size
pnpm test        # unit tests
pnpm test:e2e    # both examples in Chromium
```
