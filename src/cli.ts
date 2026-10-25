import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { merge, scan } from './scan.js';
import type { NecessaryCookie } from './types.js';

const HELP = `Usage: keksi scan <url> [options]

Lists the cookies and storage your site sets without consent, for the "Necessary" section.

Options:
  --out <file>     Output file (default: keksi.cookies.json)
  --pages <n>      Most pages to visit (default: 20)
  --cookie <name>  Consent cookie name, if changed (default: keksi)
  --check          Write nothing; exit 1 if the file is missing entries
                   or a tracker cookie is set without consent
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'keksi.cookies.json' },
    pages: { type: 'string', default: '20' },
    cookie: { type: 'string', default: 'keksi' },
    check: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const [command, url] = positionals;
if (values.help || command !== 'scan' || !url) {
  process.stdout.write(HELP);
  process.exit(values.help ? 0 : 1);
}

const existing: NecessaryCookie[] = existsSync(values.out) ? JSON.parse(readFileSync(values.out, 'utf8')) : [];
const { necessary: found, trackers } = await scan(url, { pages: Number(values.pages), cookieName: values.cookie });
const { list, added, missing } = merge(existing, found);
const label = (c: NecessaryCookie) => `${c.name}${c.storage ? ` (${c.storage})` : ''}`;
const blank = (c: NecessaryCookie) => !c.purpose || (typeof c.purpose === 'object' && !Object.values(c.purpose).some(Boolean));

for (const c of trackers) console.error(`! ${label(c)}: tracker cookie set without consent`);
for (const c of added) console.log(`+ ${label(c)}`);
for (const c of missing) console.log(`? ${label(c)}: not seen, remove it unless it's set after login or on unscanned pages`);

if (values.check) {
  if (trackers.length) {
    console.error(`${trackers.length} tracker cookie${trackers.length === 1 ? '' : 's'} set without consent.`);
    process.exit(1);
  }
  if (added.length) {
    console.error(`${values.out} is missing ${added.length} entr${added.length === 1 ? 'y' : 'ies'}. Run keksi scan ${url}`);
    process.exit(1);
  }
  console.log(`${values.out} is up to date.`);
} else {
  writeFileSync(values.out, `${JSON.stringify(list, null, 2)}\n`);
  const todo = list.filter(blank);
  console.log(`Wrote ${list.length} entr${list.length === 1 ? 'y' : 'ies'} to ${values.out}.`);
  if (todo.length) console.log(`Add a purpose for: ${todo.map(label).join(', ')}`);
  console.log('Review each entry: only storage the site needs to work belongs here. Remove the rest from your code.');
  if (trackers.length) process.exit(1);
}
