import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { runtime } from './build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cache = `${root}node_modules/.cache/keksi-preview`;
const port = Number(process.env.PORT ?? 4400);
mkdirSync(cache, { recursive: true });

const config = {
  ga: 'G-PREVIEW',
  googleAds: 'AW-PREVIEW',
  meta: '0',
  posthog: { key: 'phc_preview' },
  youtube: true,
  policyUrl: '/cookies',
};

// Rebuilt per request, so a refresh shows the current src/.
async function load() {
  const out = await build({
    entryPoints: [`${root}src/index.ts`],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    define: { __RUNTIME__: JSON.stringify(await runtime()) },
  });
  const file = `${cache}/keksi-${Date.now()}.mjs`;
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const css = `
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#fafaf9;line-height:1.6}
a{color:inherit}
.bar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;padding:.5rem 1rem;background:#0f172a;color:#e2e8f0;font-size:13px}
.bar a,.bar button{padding:.2rem .6rem;border:1px solid #334155;border-radius:999px;background:none;color:inherit;font:inherit;text-decoration:none;cursor:pointer}
.bar [aria-current]{background:#e2e8f0;color:#0f172a}
.bar span{margin-left:auto;opacity:.6}
header,main,footer{max-width:68rem;margin:0 auto;padding:1.5rem 1rem}
header{display:flex;justify-content:space-between;align-items:center}
header nav{display:flex;gap:1.5rem;font-size:15px}
header nav a{text-decoration:none;color:#475569}
.logo{font-weight:700;font-size:18px;text-decoration:none}
.hero{display:grid;gap:2.5rem;grid-template-columns:1.1fr 1fr;align-items:center;padding-block:3rem}
@media (max-width:48rem){.hero{grid-template-columns:1fr}}
h1{font-size:clamp(2rem,5vw,3.25rem);line-height:1.1;letter-spacing:-.02em;margin:0 0 1rem}
.lead{font-size:18px;color:#475569;margin:0 0 1.5rem}
.cta{display:inline-block;padding:.7rem 1.25rem;border-radius:999px;background:#6d28d9;color:#fff;text-decoration:none;font-weight:600}
.art{aspect-ratio:4/3;border-radius:1rem;background:linear-gradient(135deg,#f0abfc,#fb7185 55%,#fdba74)}
.cards{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));padding-block:1rem 3rem}
.card{padding:1.25rem;border:1px solid #e7e5e4;border-radius:.75rem;background:#fff}
.card h3{margin:0 0 .25rem;font-size:16px}
.card p{margin:0;color:#64748b;font-size:14px}
.policy table{background:#fff}
footer{display:flex;justify-content:space-between;border-top:1px solid #e7e5e4;color:#64748b;font-size:14px}
footer button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
`;

function page(k, path, lang) {
  const q = (l) => `?lang=${l}`;
  const langs = ['fi', 'sv', 'en'].map((l) => `<a href="${path}${q(l)}"${l === lang ? ' aria-current="true"' : ''}>${l}</a>`).join('');
  const body =
    path === '/cookies'
      ? `<main class="policy"><h1>Cookies</h1>${k.cookieTable(config, { lang })}</main>`
      : `<main><section class="hero"><div><h1>Software that ships on time.</h1>
<p class="lead">A mock landing page for previewing the keksi banner against a real-looking layout.</p>
<a class="cta" href="#">Contact sales</a></div><div class="art"></div></section>
<section class="cards">${['Fast', 'Accessible', 'Private'].map((t) => `<div class="card"><h3>${t}</h3><p>Placeholder copy to fill the grid behind the banner.</p></div>`).join('')}</section>
<keksi-youtube video="aqz-KE-bpKQ" label="Big Buck Bunny"></keksi-youtube></main>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>keksi preview</title><style>${css}</style></head><body>${k.renderKeksi(config, { lang })}
<div class="bar">${langs}<button type="button" onclick="document.cookie='keksi=; Max-Age=0; Path=/';location.reload()">Reset consent</button><span>Refresh to pick up changes in src/</span></div>
<header><a class="logo" href="/${q(lang)}">Esimerkki</a><nav><a href="/${q(lang)}">Home</a><a href="/cookies${q(lang)}">Cookies</a></nav></header>
${body}<footer><span>© Esimerkki Oy</span><button type="button" data-keksi-open>Cookie settings</button></footer></body></html>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/' && url.pathname !== '/cookies') return res.writeHead(404).end();
  try {
    const lang = ['fi', 'sv', 'en'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(await load(), url.pathname, lang));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err?.stack ?? err));
  }
}).listen(port, () => console.log(`keksi preview: http://localhost:${port}/`));
