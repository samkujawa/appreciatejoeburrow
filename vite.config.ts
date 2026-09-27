import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { parseHeadersFile } from './scripts/headers.ts';

// `npm run preview` serves the same security headers as production, so CSP problems
// show up locally instead of after a deploy.
const productionHeaders = parseHeadersFile(readFileSync('public/_headers', 'utf8'))['/*'];

export default defineConfig({
  build: {
    target: 'es2022',
    cssCodeSplit: false,
  },
  preview: {
    headers: productionHeaders ?? {},
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
