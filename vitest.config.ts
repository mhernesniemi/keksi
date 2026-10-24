import { defineConfig } from 'vitest/config';
// @ts-expect-error untyped build script
import { runtime } from './scripts/build.mjs';

export default defineConfig({
  define: { __RUNTIME__: JSON.stringify(await runtime()) },
  test: { include: ['test/**/*.test.ts'] },
});
