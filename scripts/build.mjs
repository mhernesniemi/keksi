import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function runtime() {
  const out = await build({
    entryPoints: [`${root}src/entry.ts`],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    write: false,
  });
  return out.outputFiles[0].text.trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await runtime();
  rmSync(`${root}dist`, { recursive: true, force: true });
  await build({
    entryPoints: [`${root}src/index.ts`, `${root}src/playwright.ts`, `${root}src/sveltekit.ts`, `${root}src/scan.ts`],
    outdir: `${root}dist`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    external: ['@playwright/test'],
    define: { __RUNTIME__: JSON.stringify(code) },
  });
  await build({
    entryPoints: [`${root}src/cli.ts`],
    outfile: `${root}dist/cli.js`,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: ['@playwright/test'],
    banner: { js: '#!/usr/bin/env node' },
  });
  execFileSync('tsc', ['-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });
  const gz = (await import('node:zlib')).gzipSync(code).length;
  console.log(`runtime: ${code.length} B, ${gz} B gzipped`);
}
